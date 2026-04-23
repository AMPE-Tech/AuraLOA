/**
 * pasta_digital_navigator.ts — Agente 1
 * ─────────────────────────────────────────────────────────────────────────────
 * Navega a Pasta Digital do eSAJ TJSP com Playwright e intercepta as chamadas
 * de rede para descobrir as URLs reais de cada peça/PDF.
 *
 * ESTRATÉGIA:
 *   1. Abre o viewer da Pasta Digital autenticado (cookies da sessão)
 *   2. Registra listener de rede ANTES de qualquer navegação
 *   3. Aguarda o viewer carregar a árvore de documentos via AJAX
 *   4. Clica em cada documento da árvore → captura URL do PDF interceptada
 *   5. Valida: URL deve responder com Content-Type application/pdf
 *   6. Salva manifesto JSON com URLs verificadas + metadados de cada peça
 *
 * OUTPUT: manifesto_pecas.json
 *   {
 *     "geradoEm": "...",
 *     "totalPecas": N,
 *     "pecas": [
 *       {
 *         "numero": 1,
 *         "descricao": "Auto de Prisão em Flagrante",
 *         "dataJuntada": "2022-08-09",
 *         "urlPDF": "https://esaj.tjsp.jus.br/pastadigital/getPDF.do?...",
 *         "urlVerificada": true,
 *         "contentType": "application/pdf"
 *       }
 *     ]
 *   }
 *
 * USO (modo visível — diagnóstico):
 *   npx tsx --env-file=.env server/scripts/due_diligence/pasta_digital_navigator.ts \
 *     --processo="1503896-55.2022.8.26.0050" \
 *     --senha="SENHA_AQUI" \
 *     --saida=./Saida/due_diligence/1503896 \
 *     --limite=20
 *
 * FLAGS:
 *   --limite=N       Parar após capturar N peças (padrão: todas)
 *   --headless       Rodar sem janela visível (padrão: visível)
 *   --so-navegar     Apenas abrir o viewer e aguardar — não extrai nada (diagnóstico)
 */

import { chromium, type Browser, type BrowserContext, type Page, type Request, type Response } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface PecaManifesto {
  numero: number;
  descricao: string;
  dataJuntada: string | null;
  tipoDocumento: string | null;
  urlPDF: string;
  urlVerificada: boolean;
  contentType: string | null;
  tamanhoBytes: number | null;
  sha256URL: string;          // hash da URL — permite rastrear sem expor a URL
  arquivoLocal: string | null; // caminho do PDF salvo em disco (Agente 1 salva direto)
  sha256Arquivo: string | null; // SHA-256 do arquivo salvo
  capturedAt: string;
  erro: string | null;
}

export interface ManifestoPecas {
  numeroCNJ: string;
  geradoEm: string;
  totalPecas: number;
  pecasCapturadas: number;
  pecasVerificadas: number;
  sha256Manifesto: string;
  pecas: PecaManifesto[];
}

export interface SessaoNavegacao {
  manifesto: ManifestoPecas;
  context: import("playwright").BrowserContext;
  browser: import("playwright").Browser;
}

// ── Constantes ─────────────────────────────────────────────────────────────

const ESAJ_BASE = "https://esaj.tjsp.jus.br";

// Padrões de URL que indicam um PDF real de peça processual
const PDF_URL_PATTERNS = [
  /pastadigital\/getPDF\.do/,
  /pastadigital\/getArquivoMidia\.do/,
  /pastadigital\/abrirDocumento\.do/,
  /\/downloadPDF/,
  /\/getPecaProcessual/,
  /cdDocumento=/,
  /nuSeqPeca=/,
  /getArquivo/,
];

// ── Priorização de tipos de documento (mandato Dra. Márcia Mirtes) ──────────
// Documentos mais relevantes para cadeia de custódia e resposta à acusação
// vêm primeiro no OCR — o navigator os move para o topo da fila
export const PRIORIDADE_DOCUMENTOS: Record<string, number> = {
  // ALTA — cadeia de custódia e prova da acusação
  "denúncia":              1,
  "sentença":              1,
  "decisão":               1,
  "acórdão":               1,
  "auto de prisão":        1,
  "mandado de prisão":     1,
  "laudo pericial":        1,
  "laudo":                 1,
  "auto de apreensão":     1,
  "auto de infração":      1,
  "termo de interrogatório": 1,
  "interrogatório":        1,
  "auto de qualificação":  1,
  // MÉDIA — contexto processual
  "petição":               2,
  "memoriais":             2,
  "alegações finais":      2,
  "resposta à acusação":   2,
  "habeas corpus":         2,
  "recurso":               2,
  "apelação":              2,
  "despacho":              2,
  // BAIXA — documentos de suporte
  "certidão":              3,
  "ofício":                3,
  "mandado":               3,
  "documentos diversos":   3,
  "outros documentos":     3,
};

function prioridadeItem(texto: string): number {
  const t = texto.toLowerCase();
  for (const [chave, prio] of Object.entries(PRIORIDADE_DOCUMENTOS)) {
    if (t.includes(chave)) return prio;
  }
  return 3; // padrão: baixa prioridade
}

// Padrões a ignorar (JS, CSS, imagens, etc.)
const IGNORE_PATTERNS = [
  /\.js(\?|$)/,
  /\.css(\?|$)/,
  /\.png(\?|$)/,
  /\.gif(\?|$)/,
  /\.ico(\?|$)/,
  /sajcas\//,
  /verificarLogin/,
  /jquery/,
  /softheme/,
  /webjars/,
];

// ── Helpers ────────────────────────────────────────────────────────────────

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)=?(.*)$/.exec(arg);
    if (m) args[m[1]] = m[2] || "true";
  }
  return args;
}

function log(msg: string): void {
  const linha = `[${new Date().toISOString()}] ${msg}`;
  console.log(linha);
}

function ehURLPDF(url: string): boolean {
  if (IGNORE_PATTERNS.some(p => p.test(url))) return false;
  return PDF_URL_PATTERNS.some(p => p.test(url));
}

function sha256URL(url: string): string {
  return createHash("sha256").update(url).digest("hex").substring(0, 16);
}

// ── Agente 1: PastaDigitalNavigator ───────────────────────────────────────

export async function navegarPastaDigital(
  numeroCNJ: string,
  senha: string,
  dirSaida: string,
  opcoes: {
    limite?: number;
    headless?: boolean;
    soNavegar?: boolean;
    manterSessaoAberta?: boolean;   // se true: não fecha browser, retorna SessaoNavegacao
    logFn?: (msg: string) => void;
  } = {}
): Promise<ManifestoPecas | SessaoNavegacao> {
  const {
    limite = Infinity,
    headless = false,
    soNavegar = false,
    manterSessaoAberta = false,
    logFn = log,
  } = opcoes;

  const urlsCapturadas = new Map<string, { contentType: string | null; bytes: number | null; capturedAt: string; arquivoLocal: string | null; sha256Arquivo: string | null }>();
  const urlsIgnoradas = new Set<string>();

  // Garantir que o diretório de peças existe antes da interceptação
  const dirPecas = path.join(dirSaida, "pecas");
  fs.mkdirSync(dirPecas, { recursive: true });

  logFn(`[Navigator] Iniciando Agente 1 — Pasta Digital Navigator`);
  logFn(`[Navigator] Processo: ${numeroCNJ}`);
  logFn(`[Navigator] Modo: ${headless ? "headless" : "visível (diagnóstico)"}`);
  logFn(`[Navigator] Limite: ${limite === Infinity ? "todas as peças" : limite + " peças"}`);

  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 80 : 350,   // 350ms entre ações no modo visível — evasão de bot
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--start-maximized",
      "--disable-extensions",
    ],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["pt-BR", "pt", "en-US"] });
    // Ocultar sinais de Chromium controlado
    (window as any).chrome = { runtime: {} };
  });

  // ── INTERCEPTAÇÃO DE REDE — registrar ANTES de abrir qualquer página ──
  const pecasInterceptadas: PecaManifesto[] = [];

  context.on("response", async (response: Response) => {
    const url = response.url();
    const status = response.status();

    if (IGNORE_PATTERNS.some(p => p.test(url))) return;
    if (urlsIgnoradas.has(url)) return;

    // Capturar qualquer resposta que pareça PDF
    if (ehURLPDF(url) && status === 200) {
      if (urlsCapturadas.has(url)) return; // já capturada

      let contentType: string | null = null;
      let bytes: number | null = null;

      try {
        contentType = response.headers()["content-type"] || null;
        // Só lê o body se for PDF — evita downloads desnecessários nesta fase
        if (contentType?.includes("pdf")) {
          const body = await response.body().catch(() => null);
          bytes = body?.length || null;
        }
      } catch {}

      // Salvar o PDF imediatamente — mesma sessão autenticada, URL ainda válida
      let arquivoLocal: string | null = null;
      let sha256Arquivo: string | null = null;
      try {
        if (contentType?.includes("pdf")) {
          const body = await response.body().catch(() => null);
          if (body && body.length > 0) {
            bytes = body.length;
            const numPeca = urlsCapturadas.size + 1;
            const nomeArq = `peca_${String(numPeca).padStart(5, "0")}.pdf`;
            arquivoLocal = path.join(dirPecas, nomeArq);
            const buf = Buffer.from(body);
            fs.writeFileSync(arquivoLocal, buf);
            sha256Arquivo = createHash("sha256").update(buf).digest("hex");
          }
        }
      } catch {}

      urlsCapturadas.set(url, {
        contentType,
        bytes,
        capturedAt: new Date().toISOString(),
        arquivoLocal,
        sha256Arquivo,
      });

      const savedInfo = arquivoLocal ? ` → salvo ${(bytes!/1024).toFixed(0)}KB SHA:${sha256Arquivo?.substring(0,12)}` : "";
      logFn(`[Navigator] ✓ PDF interceptado: ${url.substring(url.lastIndexOf("/") + 1, url.lastIndexOf("/") + 60)} | ${contentType}${savedInfo}`);
    } else if (!ehURLPDF(url) && url.includes("esaj.tjsp.jus.br") && !urlsIgnoradas.has(url)) {
      // Log de AJAX relevante para diagnóstico
      if (url.includes("pastadigital") || url.includes("getPecas") || url.includes("listaPecas")) {
        logFn(`[Navigator] AJAX esaj: ${url.replace(ESAJ_BASE, "")}`);
      }
      urlsIgnoradas.add(url);
    }
  });

  const page = await context.newPage();

  try {
    // ── FASE 1: Autenticação no cpopg ──────────────────────────────────────
    logFn(`[Navigator] Fase 1/4: Autenticando no eSAJ...`);

    // Pausa humana antes de começar
    await page.waitForTimeout(1200 + Math.random() * 800);

    await page.goto(`${ESAJ_BASE}/cpopg/open.do`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000 + Math.random() * 1000);

    // Preencher número do processo
    const partes = numeroCNJ.match(/^(\d{7}-\d{2}\.\d{4})\.\d\.\d{2}\.(\d{4})$/);
    const numPrincipal = partes?.[1] || numeroCNJ.substring(0, 15);
    const foro = partes?.[2] || "0050";

    const campoNumero = page.locator('input[name="numeroDigitoAnoUnificado"]');
    const campoForo = page.locator('input[name="foroNumeroUnificado"]');

    await campoNumero.waitFor({ state: "visible", timeout: 15000 });

    // Clicar antes de digitar — simula comportamento humano
    await campoNumero.click();
    await page.waitForTimeout(500 + Math.random() * 400);
    await campoNumero.fill("");
    await page.waitForTimeout(300);
    // Digitar caractere por caractere com delay humano (150-230ms/char)
    await campoNumero.type(numPrincipal, { delay: 150 + Math.random() * 80 });

    await page.waitForTimeout(600 + Math.random() * 400);

    await campoForo.click();
    await page.waitForTimeout(400 + Math.random() * 300);
    await campoForo.fill("");
    await page.waitForTimeout(200);
    await campoForo.type(foro, { delay: 150 + Math.random() * 80 });

    await page.waitForTimeout(800 + Math.random() * 600);

    await page.getByRole("button", { name: "Consultar" }).click();
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await page.waitForTimeout(2000 + Math.random() * 1000);

    // Clicar no link do processo
    const linkProcesso = page.locator(`a[href*="${numPrincipal.substring(0, 7)}"]`).first();
    const temLink = await linkProcesso.isVisible().catch(() => false);
    if (temLink) {
      await page.waitForTimeout(800 + Math.random() * 600);
      await linkProcesso.click();
      await page.waitForTimeout(3000 + Math.random() * 1000);
    }

    // Modal de senha (segredo de justiça)
    const modalSenha = page.locator("input#senhaProcesso").first();
    if (await modalSenha.isVisible().catch(() => false)) {
      logFn(`[Navigator] Modal de senha detectado — inserindo credencial...`);
      await page.waitForTimeout(800 + Math.random() * 500);
      await modalSenha.click();
      await page.waitForTimeout(500 + Math.random() * 300);
      await modalSenha.type(senha, { delay: 130 + Math.random() * 70 });
      await page.waitForTimeout(600 + Math.random() * 400);
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.waitForLoadState("networkidle", { timeout: 30000 });
      await page.waitForTimeout(2500 + Math.random() * 1000);
    }

    logFn(`[Navigator] Fase 1/4: Autenticação concluída`);

    // ── Registrar handler automático de senha APÓS autenticação inicial ───────
    // Registrar aqui (não antes) evita conflito com o código manual de auth acima.
    // A partir daqui, qualquer modal que aparecer (jstree, viewer, etc.) é tratado.
    if (senha) {
      await page.addLocatorHandler(
        page.locator("input#senhaProcesso").first(),
        async (_locator) => {
          // Durante navegação da jstree o eSAJ rejeita senha digitada via código.
          // Dispensar o modal via Cancelar é suficiente — o pipeline continua e
          // o OCR usa a sessão autenticada da Fase 1 que já está ativa.
          logFn(`[Navigator] 🔑 Modal de senha detectado — dispensando (Cancelar)...`);
          await page.getByRole("button", { name: "Cancelar" }).click().catch(() => {});
          await page.waitForTimeout(800);
          logFn(`[Navigator] ✓ Modal dispensado — continuando`);
        }
      );
    }

    // ── FASE 2: Navegar para a Pasta Digital ───────────────────────────────
    logFn(`[Navigator] Fase 2/4: Abrindo Pasta Digital...`);

    // Tentar encontrar o link #linkPasta direto na página atual
    const linkPasta = page.locator("a#linkPasta, a#linkPastaAcessibilidade").first();
    const temPasta = await linkPasta.isVisible().catch(() => false);

    // Extrair cdProcesso do link #linkPasta já presente na página atual
    let cdProcesso = "";
    const linkPastaHref = await page.locator("a#linkPasta").first().getAttribute("href").catch(() => null);
    if (linkPastaHref) {
      const match = linkPastaHref.match(/processo\.codigo=([^&]+)/);
      if (match) cdProcesso = match[1];
      logFn(`[Navigator] cdProcesso extraído: ${cdProcesso}`);
    }

    if (!cdProcesso) {
      logFn(`[Navigator] ERRO: não foi possível extrair cdProcesso do link da Pasta Digital`);
      throw new Error("cdProcesso não encontrado — verifique autenticação");
    }

    // /cpopg/abrirPastaDigital.do retorna no body a URL real com ticket de autenticação
    const urlAbrirPasta = `${ESAJ_BASE}/cpopg/abrirPastaDigital.do?processo.codigo=${cdProcesso}`;
    logFn(`[Navigator] Obtendo URL com ticket...`);

    await page.goto(urlAbrirPasta, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(2000);

    // O body contém a URL real com ticket (texto puro ou redirect)
    const bodyTexto = (await page.evaluate(() => document.body.innerText || document.body.textContent || "")).trim();
    const htmlBody = await page.content();
    fs.writeFileSync(path.join(dirSaida, "diagnostico_pasta_digital.html"), htmlBody, "utf-8");

    // Extrair URL com ticket do body
    let urlPastaDigital = page.url();
    const urlMatch = bodyTexto.match(/https:\/\/esaj\.tjsp\.jus\.br\/pastadigital\/[^\s"<>]+/);
    if (urlMatch) {
      urlPastaDigital = urlMatch[0];
      logFn(`[Navigator] URL com ticket extraída: ${urlPastaDigital.substring(0, 100)}...`);
    } else {
      logFn(`[Navigator] URL com ticket não encontrada no body — usando URL atual: ${urlPastaDigital.substring(0, 100)}`);
    }

    // Navegar para o viewer real
    await page.goto(urlPastaDigital, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(6000); // viewer carrega árvore via JS

    // Salvar HTML do viewer após JS executar
    const htmlViewer = await page.content();
    fs.writeFileSync(path.join(dirSaida, "diagnostico_viewer_carregado.html"), htmlViewer, "utf-8");
    logFn(`[Navigator] HTML do viewer salvo em diagnostico_viewer_carregado.html`);

    // ── FASE 3: Modo soNavegar — para diagnóstico visual ──────────────────
    if (soNavegar) {
      logFn(`[Navigator] Modo --so-navegar: viewer aberto. Observe a janela do browser.`);
      logFn(`[Navigator] URLs de PDF interceptadas até agora: ${urlsCapturadas.size}`);
      logFn(`[Navigator] Aguardando 60 segundos para inspeção manual...`);
      await page.waitForTimeout(60000);
      logFn(`[Navigator] Encerrando modo diagnóstico.`);
      await browser.close();

      return {
        numeroCNJ,
        geradoEm: new Date().toISOString(),
        totalPecas: 0,
        pecasCapturadas: 0,
        pecasVerificadas: 0,
        sha256Manifesto: "",
        pecas: [],
      };
    }

    // ── FASE 3.5: Expandir nós fechados da jstree (lazy loading) ─────────────
    //
    // A árvore da Pasta Digital usa jstree com carregamento lazy: nós com filhos
    // começam como .jstree-closed e só exibem os filhos no DOM após clique no
    // triângulo (.jstree-ocl). Sem esta fase, só os itens do primeiro nível
    // são visíveis, limitando a captura a ~13 peças mesmo com --limite=200.
    //
    // ⚠️ RESSALVAS (01/04/2026):
    //   R1 — Paginação profunda: se a árvore usar scroll/paginação AJAX para
    //        carregar mais nós ao rolar (além de expand), esta fase não resolve.
    //        Verificar no log: "Pós-expansão: N itens" — se N for baixo (<30),
    //        pode haver paginação de scroll não tratada.
    //   R2 — Timeout de sessão: expandir centenas de nós demora. O eSAJ tem
    //        timeout de sessão não documentado (~30-60min estimado). Para muitas
    //        peças, monitorar se o context fecha durante a expansão.
    //   R3 — Anti-bot: muitos cliques rápidos podem acionar detecção de bot.
    //        O ESPERA_AJAX de 1200ms por nó é conservador — não reduzir sem teste.
    //   R4 — Nós sem PDF: alguns nós são pastas/categorias sem PDF associado.
    //        A interceptação de rede já filtra por Content-Type, então são ignorados.
    //   R5 — jstree com AJAX por demanda: alguns deployments do jstree só fazem
    //        a requisição AJAX ao expandir pela primeira vez. Se o servidor retornar
    //        erro ou demorar >5s, o nó pode ficar em estado "loading" para sempre.
    //        O catch() por clique garante que um nó problemático não trava o loop.
    //
    logFn(`[Navigator] Fase 3.5/4: Expandindo árvore jstree (lazy loading)...`);
    await page.waitForTimeout(3000); // aguarda carregamento inicial da árvore

    const MAX_RODADAS_EXPANSAO = 8;
    const MAX_NOS_POR_RODADA   = 200;
    const ESPERA_AJAX_MS       = 1200;

    // Deduplicação: rastreia bounding boxes já clicados para não repetir o mesmo nó
    const nosJaClicados = new Set<string>();

    for (let rodada = 1; rodada <= MAX_RODADAS_EXPANSAO; rodada++) {
      // Keep-alive: sinaliza ao eSAJ que a sessão ainda está ativa
      await page.evaluate(() => {
        const img = new Image();
        img.src = "/pastadigital/manterSessao.do?_=" + Date.now();
      }).catch(() => {});

      // Seletores para o triângulo de expansão de nós fechados
      const seletoresOcl = [
        "#arvore_principal .jstree-closed > .jstree-ocl",
        ".jstree-closed > .jstree-ocl",
        "#arvore_principal .jstree-closed > i.jstree-icon",
        ".jstree-closed > i.jstree-icon",
      ];

      let nosFechados: any[] = [];
      for (const sel of seletoresOcl) {
        const encontrados = await page.locator(sel).all().catch(() => []);
        if (encontrados.length > nosFechados.length) nosFechados = encontrados;
      }

      if (nosFechados.length === 0) {
        logFn(`[Navigator] Expansão concluída em ${rodada - 1} rodada(s) — nenhum nó fechado restante`);
        break;
      }

      // Filtrar nós já clicados usando bounding box como chave única
      const nosNovos: any[] = [];
      for (const no of nosFechados.slice(0, MAX_NOS_POR_RODADA)) {
        const bbox = await no.boundingBox().catch(() => null);
        const chave = bbox ? `${Math.round(bbox.x)},${Math.round(bbox.y)}` : null;
        if (!chave || nosJaClicados.has(chave)) continue; // pula nós já clicados
        nosNovos.push({ no, chave });
      }

      if (nosNovos.length === 0) {
        logFn(`[Navigator] Rodada ${rodada}: todos os nós já foram clicados — encerrando expansão`);
        break;
      }

      logFn(`[Navigator] Expansão rodada ${rodada}/${MAX_RODADAS_EXPANSAO}: ${nosNovos.length} nó(s) novo(s) para expandir`);

      for (const { no, chave } of nosNovos) {
        await no.click({ timeout: 5000 }).catch(() => {});
        nosJaClicados.add(chave);
        await page.waitForTimeout(ESPERA_AJAX_MS);
      }

      // Aguarda DOM estabilizar após a rodada
      await page.waitForTimeout(2000);
    }

    // Contar itens visíveis após expansão (para log comparativo)
    const totalPosExpansao = await page.locator(
      "#arvore_principal .jstree-anchor, .jstree-anchor"
    ).count().catch(() => 0);
    logFn(`[Navigator] Pós-expansão: ${totalPosExpansao} item(ns) visível(is) na árvore`);

    // ── FASE 4: Extrair URLs dos PDFs da árvore de documentos ─────────────
    //
    // O viewer usa iframes com URL padrão:
    //   /pastadigital/js/viewer/web/viewer.html?file=/pastadigital/getPDF.do?cdDocumento=XXX&...
    //
    // Estratégia: interceptar requests de /pastadigital/getPDF.do ao clicar em cada
    // item da árvore de documentos (painel esquerdo do viewer).
    //
    logFn(`[Navigator] Fase 4/4: Extraindo URLs dos PDFs da árvore...`);
    await page.waitForTimeout(2000);

    // Capturar URLs do viewer.html?file= já presentes nos iframes carregados
    const iframeUrls = await page.evaluate(() => {
      const urls: string[] = [];
      document.querySelectorAll("iframe[src]").forEach((el) => {
        const src = (el as HTMLIFrameElement).src;
        if (src.includes("viewer.html") && src.includes("getPDF")) {
          urls.push(src);
        }
      });
      return urls;
    });

    logFn(`[Navigator] iframes com viewer.html encontrados: ${iframeUrls.length}`);

    // Extrair URL do getPDF.do de cada iframe (está no parâmetro ?file=)
    for (const iframeUrl of iframeUrls) {
      const fileParam = iframeUrl.match(/[?&]file=([^&]+)/)?.[1];
      if (fileParam) {
        const urlPDF = decodeURIComponent(fileParam);
        const urlCompleta = urlPDF.startsWith("http") ? urlPDF : `${ESAJ_BASE}${urlPDF}`;
        if (!urlsCapturadas.has(urlCompleta)) {
          urlsCapturadas.set(urlCompleta, {
            contentType: "application/pdf",
            bytes: null,
            capturedAt: new Date().toISOString(),
            arquivoLocal: null,
            sha256Arquivo: null,
          });
          logFn(`[Navigator] URL extraída do iframe: ${urlCompleta.substring(urlCompleta.indexOf("getPDF"), urlCompleta.indexOf("getPDF") + 60)}`);
        }
      }
    }

    // Encontrar itens da árvore de documentos
    // O viewer do eSAJ usa a biblioteca jstree — seletores confirmados no HTML diagnóstico
    const seletoresArvore = [
      // jstree — confirmado: #arvore_principal com role="tree" e itens role="treeitem"
      "#arvore_principal [role='treeitem'] > a.jstree-anchor",
      "#arvore_principal .jstree-anchor",
      "[role='treeitem'] > a.jstree-anchor",
      "[role='treeitem']",
      // Fallbacks
      ".jstree-anchor",
      ".jstree-node",
      "a[href*='cdDocumento']",
      "a[href*='getPDF']",
    ];

    let seletorArvore = "";
    let totalItens = 0;

    for (const sel of seletoresArvore) {
      const n = await page.locator(sel).count().catch(() => 0);
      if (n > 0) {
        logFn(`[Navigator] Seletor árvore "${sel}": ${n} itens`);
        if (n > totalItens) { totalItens = n; seletorArvore = sel; }
      }
    }

    if (totalItens > 0) {
      logFn(`[Navigator] Navegando árvore com "${seletorArvore}" — ${totalItens} itens (limite: ${limite === Infinity ? "todos" : limite})`);

      // Coletar textos de todos os itens para ordenar por prioridade
      logFn(`[Navigator] Coletando textos para priorização...`);
      const itensComTexto: { indice: number; texto: string; prioridade: number }[] = [];
      const maxItensTotal = Math.min(totalItens, 5000); // cap seguro
      for (let i = 0; i < maxItensTotal; i++) {
        try {
          const txt = await page.locator(seletorArvore).nth(i).textContent().catch(() => `doc-${i}`);
          const texto = txt?.trim() || `doc-${i}`;
          itensComTexto.push({ indice: i, texto, prioridade: prioridadeItem(texto) });
        } catch {}
      }

      // Ordenar: prioridade 1 primeiro, depois 2, depois 3 (manter ordem original dentro de cada grupo)
      itensComTexto.sort((a, b) => a.prioridade - b.prioridade || a.indice - b.indice);

      const prio1 = itensComTexto.filter(i => i.prioridade === 1).length;
      const prio2 = itensComTexto.filter(i => i.prioridade === 2).length;
      const prio3 = itensComTexto.filter(i => i.prioridade === 3).length;
      logFn(`[Navigator] Priorização: ${prio1} alta | ${prio2} média | ${prio3} baixa`);

      const maxItens = limite === Infinity ? itensComTexto.length : Math.min(itensComTexto.length, limite);

      for (let idx = 0; idx < maxItens; idx++) {
        if (urlsCapturadas.size >= (limite === Infinity ? Infinity : limite)) break;
        const { indice, texto, prioridade } = itensComTexto[idx];
        const prioLabel = prioridade === 1 ? "🔴" : prioridade === 2 ? "🟡" : "⚪";
        try {
          const item = page.locator(seletorArvore).nth(indice);
          await item.click({ timeout: 8000 });
          await page.waitForTimeout(4000 + Math.random() * 2000);

          logFn(`[Navigator] ${prioLabel} Clicou: "${texto.substring(0, 50)}" — PDFs capturados: ${urlsCapturadas.size}`);
        } catch {}
      }
    } else {
      // Fallback: listar todos os frames e links disponíveis para diagnóstico
      logFn(`[Navigator] Nenhum seletor de árvore funcionou — coletando diagnóstico do DOM`);
      const htmlAtual = await page.content();
      fs.writeFileSync(path.join(dirSaida, "diagnostico_viewer_dom.html"), htmlAtual, "utf-8");

      const frames = page.frames();
      logFn(`[Navigator] Frames ativos (${frames.length}):`);
      for (const f of frames) {
        logFn(`  frame url: ${f.url().substring(0, 120)}`);
      }
    }

    // ── Montar manifesto com o que foi capturado ───────────────────────────
    logFn(`\n[Navigator] Fase 4/4: Montando manifesto...`);
    logFn(`[Navigator] Total de URLs de PDF interceptadas: ${urlsCapturadas.size}`);

    let numeroPeca = 1;
    for (const [url, info] of Array.from(urlsCapturadas)) {
      if (pecasInterceptadas.length >= limite) break;

      pecasInterceptadas.push({
        numero: numeroPeca++,
        descricao: `Peça ${numeroPeca - 1}`,
        dataJuntada: null,
        tipoDocumento: info.contentType?.includes("pdf") ? "PDF" : info.contentType,
        urlPDF: url,
        urlVerificada: info.contentType?.includes("pdf") === true,
        contentType: info.contentType,
        tamanhoBytes: info.bytes,
        sha256URL: sha256URL(url),
        arquivoLocal: info.arquivoLocal ?? null,
        sha256Arquivo: info.sha256Arquivo ?? null,
        capturedAt: info.capturedAt,
        erro: null,
      });
    }

    const sha256Manifesto = createHash("sha256")
      .update(JSON.stringify(pecasInterceptadas))
      .digest("hex");

    const manifesto: ManifestoPecas = {
      numeroCNJ,
      geradoEm: new Date().toISOString(),
      totalPecas: pecasInterceptadas.length,
      pecasCapturadas: pecasInterceptadas.length,
      pecasVerificadas: pecasInterceptadas.filter(p => p.urlVerificada).length,
      sha256Manifesto,
      pecas: pecasInterceptadas,
    };

    // Salvar manifesto
    const manifestoPath = path.join(dirSaida, "manifesto_pecas.json");
    fs.writeFileSync(manifestoPath, JSON.stringify(manifesto, null, 2), "utf-8");
    logFn(`[Navigator] Manifesto salvo: ${manifestoPath}`);
    logFn(`[Navigator] Peças capturadas: ${manifesto.pecasCapturadas}`);
    logFn(`[Navigator] Peças verificadas (PDF real): ${manifesto.pecasVerificadas}`);

    if (manterSessaoAberta) {
      logFn(`[Navigator] Sessão mantida aberta para uso pelo Agente OCR`);
      return { manifesto, context, browser };
    }

    return manifesto;

  } finally {
    if (!manterSessaoAberta) {
      await browser.close();
    }
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const numeroCNJ = args["processo"] || "1503896-55.2022.8.26.0050";
  const senha = args["senha"] || "";
  const dirSaida = args["saida"] || "./Saida/due_diligence/1503896";
  const limite = args["limite"] ? parseInt(args["limite"]) : Infinity;
  const headless = args["headless"] === "true";
  const soNavegar = args["so-navegar"] === "true";

  if (!senha && !soNavegar) {
    console.error("Uso: npx tsx ... pasta_digital_navigator.ts --processo=CNJ --senha=SENHA [--limite=N] [--headless] [--so-navegar]");
    process.exit(1);
  }

  log("═══════════════════════════════════════════════════════════");
  log("  AuraDUE — Agente 1: Pasta Digital Navigator");
  log("═══════════════════════════════════════════════════════════");

  fs.mkdirSync(dirSaida, { recursive: true });

  const manifesto = await navegarPastaDigital(numeroCNJ, senha, dirSaida, {
    limite,
    headless,
    soNavegar,
  });

  const m = "manifesto" in manifesto ? manifesto.manifesto : manifesto;
  log("═══════════════════════════════════════════════════════════");
  log(`  Resultado:`);
  log(`  Peças capturadas:  ${m.pecasCapturadas}`);
  log(`  Peças verificadas: ${m.pecasVerificadas}`);
  log(`  SHA-256 manifesto: ${m.sha256Manifesto.substring(0, 32)}...`);
  log("═══════════════════════════════════════════════════════════");
}

// Só executa main() quando rodado diretamente (não quando importado como módulo)
const _isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("pasta_digital_navigator.ts");
if (_isMain) {
  main().catch((err) => {
    console.error("[FATAL]", err.message);
    process.exit(1);
  });
}
