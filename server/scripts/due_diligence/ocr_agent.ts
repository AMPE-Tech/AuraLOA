/**
 * ocr_agent.ts — Agente 3-OCR + Análise Macro
 * ─────────────────────────────────────────────────────────────────────────────
 * Lê os PDFs escaneados baixados pelo Agente 1, extrai texto via Claude Vision
 * (Haiku), e gera análise macro das decisões importantes via Claude Sonnet.
 *
 * FLUXO:
 *   Parte A — OCR (40 páginas sequenciais):
 *     1. Lê checkpoint_download.json — localiza PDFs válidos em ordem
 *     2. Para cada página: Playwright renderiza o PDF no browser → screenshot PNG
 *     3. Envia PNG para Claude Haiku com prompt de extração de texto jurídico
 *     4. Salva texto extraído em textos/peca_NNNNN_pNNN.txt
 *     5. Atualiza ocr_checkpoint.json com status de cada página
 *
 *   Parte B — Análise Macro (10 "páginas" de decisões importantes):
 *     1. Agrega todo o texto OCR das 40 páginas
 *     2. Envia para Claude Sonnet com prompt de análise jurídica
 *     3. Gera relatório estruturado: partes, cronologia de decisões,
 *        nulidades potenciais, subsídios para a defesa
 *     4. Salva como analise_macro.md e analise_macro.json
 *
 * MODELOS:
 *   - OCR por página: claude-haiku-4-5-20251001 (~$0.01-0.03/página)
 *   - Análise macro: claude-sonnet-4-6 (~$0.50 total)
 *
 * USO:
 *   npx tsx --env-file=.env server/scripts/due_diligence/ocr_agent.ts \
 *     --saida=./Saida/due_diligence/1503896 \
 *     --paginas=40 \
 *     --macro=true
 *
 * FLAGS:
 *   --paginas=N    Número de páginas sequenciais para OCR (padrão: 40)
 *   --macro        Gerar análise macro após OCR (padrão: true)
 *   --so-macro     Apenas análise macro (sem rodar OCR novamente)
 *   --retomar      Pular páginas já processadas (lê ocr_checkpoint.json)
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { chromium, type Page, type BrowserContext } from "playwright";
import Anthropic from "@anthropic-ai/sdk";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface DownloadStatus {
  numero: number;
  arquivoLocal: string | null;
  sha256Arquivo: string | null;
  tamanhoBytes: number | null;
  ehPDFValido: boolean;
}

interface CheckpointDownload {
  numeroCNJ: string;
  pecas: DownloadStatus[];
}

interface PecaManifesto {
  numero: number;
  urlPDF: string;
  urlVerificada: boolean;
  tamanhoBytes: number | null;
}

interface ManifestoPecas {
  numeroCNJ: string;
  pecas: PecaManifesto[];
}

export interface PaginaOCR {
  numeroPeca: number;
  numeroPagina: number;         // página dentro do documento
  paginaGlobal: number;         // número sequencial no pipeline (1, 2, 3...)
  arquivoPDF: string;
  sha256PDF: string;
  sha256Imagem: string | null;  // hash do PNG enviado ao Claude
  textoExtraido: string;
  totalCharacters: number;
  totalPalavras: number;
  qualidade: "VALIDO" | "SUSPEITO" | "INVALIDO";
  motivoInvalido: string | null;
  modeloOCR: string;
  tokensUsados: number;
  custoEstimadoUSD: number;
  processadaEm: string;
}

export interface OCRCheckpoint {
  numeroCNJ: string;
  geradoEm: string;
  totalPaginasProcessadas: number;
  validas: number;
  invalidas: number;
  custoTotalUSD: number;
  sha256Checkpoint: string;
  metodoAcesso: "OFICIAL" | "ALTERNATIVO";  // cadeia de custódia
  motivoAlternativo?: string;               // preenchido só se ALTERNATIVO
  paginas: PaginaOCR[];
}

export interface AnaliseMacro {
  numeroCNJ: string;
  geradoEm: string;
  totalPaginasAnalisadas: number;
  modeloAnalise: string;
  tokensUsados: number;
  custoEstimadoUSD: number;
  sha256TextoBase: string;      // hash do texto enviado para análise
  sha256Analise: string;        // hash da análise gerada
  // Seções estruturadas
  partes: string;
  cronologiaDecisoes: string;
  nulidadesPotenciais: string;
  subsidiosDefesa: string;
  recomendacoesUrgentes: string;
  textoCompleto: string;        // markdown completo da análise
}

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
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

// Custo estimado Claude Haiku por token (preços aproximados 2026)
const CUSTO_HAIKU_INPUT_PER_1K = 0.00025;
const CUSTO_HAIKU_OUTPUT_PER_1K = 0.00125;
const CUSTO_SONNET_INPUT_PER_1K = 0.003;
const CUSTO_SONNET_OUTPUT_PER_1K = 0.015;

function estimarCusto(inputTokens: number, outputTokens: number, modelo: "haiku" | "sonnet"): number {
  if (modelo === "haiku") {
    return (inputTokens / 1000) * CUSTO_HAIKU_INPUT_PER_1K +
           (outputTokens / 1000) * CUSTO_HAIKU_OUTPUT_PER_1K;
  }
  return (inputTokens / 1000) * CUSTO_SONNET_INPUT_PER_1K +
         (outputTokens / 1000) * CUSTO_SONNET_OUTPUT_PER_1K;
}

// ── Parte A: OCR via Claude Haiku ─────────────────────────────────────────

// ── Sessão autenticada do eSAJ (compartilhada entre páginas) ─────────────

let _contextoEsaj: BrowserContext | null = null;
let _browserEsaj: import("playwright").Browser | null = null;

// Retorna o contexto autenticado e o método usado (para cadeia de custódia)
let _metodoAcesso: "OFICIAL" | "ALTERNATIVO" = "OFICIAL";
let _motivoAlternativo: string | undefined;

async function tentarAutenticacaoOficial(
  numeroCNJ: string,
  senha: string,
  browser: import("playwright").Browser,
  logFn: (msg: string) => void
): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 900 },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    (window as any).chrome = { runtime: {} };
  });

  const page = await context.newPage();
  const partes = numeroCNJ.match(/^(\d{7}-\d{2}\.\d{4})\.\d\.\d{2}\.(\d{4})$/);
  const numPrincipal = partes?.[1] || numeroCNJ.substring(0, 15);
  const foro = partes?.[2] || "0050";

  await page.goto("https://esaj.tjsp.jus.br/cpopg/open.do", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const campoNumero = page.locator('input[name="numeroDigitoAnoUnificado"]');
  await campoNumero.waitFor({ state: "visible", timeout: 15000 });
  await campoNumero.click();
  await page.waitForTimeout(400);
  await campoNumero.type(numPrincipal, { delay: 150 });
  await page.waitForTimeout(600);
  const campoForo = page.locator('input[name="foroNumeroUnificado"]');
  await campoForo.click();
  await campoForo.type(foro, { delay: 150 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Consultar" }).click();
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  await page.waitForTimeout(2000);

  const linkProcesso = page.locator(`a[href*="${numPrincipal.substring(0, 7)}"]`).first();
  if (await linkProcesso.isVisible().catch(() => false)) {
    await linkProcesso.click();
    await page.waitForTimeout(3000);
  }

  const modalSenha = page.locator("input#senhaProcesso").first();
  if (await modalSenha.isVisible().catch(() => false)) {
    if (!senha) throw new Error("Modal de senha exibido mas senha não fornecida");
    logFn(`[OCR] Modal de senha — autenticando com senha do processo...`);
    await modalSenha.click();
    await page.waitForTimeout(400);
    await modalSenha.type(senha, { delay: 130 });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Verificar se a autenticação foi aceita
    const erroSenha = await page.locator("text=Senha incorreta, text=senha inválida, text=Acesso negado").first().isVisible().catch(() => false);
    if (erroSenha) throw new Error("Senha do processo rejeitada pelo eSAJ");
  } else if (senha) {
    logFn(`[OCR] Aviso: senha fornecida mas modal não apareceu — processo pode ser público`);
  }

  logFn(`[OCR] ✓ Autenticação OFICIAL concluída (com senha do processo)`);
  await page.close();
  return context;
}

async function obterContextoESAJ(
  numeroCNJ: string,
  senha: string,
  logFn: (msg: string) => void
): Promise<BrowserContext> {
  if (_contextoEsaj) return _contextoEsaj;

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled", "--start-maximized"],
  });
  _browserEsaj = browser;

  // ── MÉTODO OFICIAL: com senha do processo (cadeia de custódia) ────────────
  const MAX_TENTATIVAS = 3;
  let ultimoErro = "";

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    logFn(`[OCR] Autenticação OFICIAL — tentativa ${tentativa}/${MAX_TENTATIVAS}...`);
    try {
      const context = await tentarAutenticacaoOficial(numeroCNJ, senha, browser, logFn);
      _contextoEsaj = context;
      _metodoAcesso = "OFICIAL";
      logFn(`[OCR] ✓ Sessão eSAJ estabelecida — MÉTODO OFICIAL`);
      return context;
    } catch (err: any) {
      ultimoErro = err.message;
      logFn(`[OCR] ✗ Tentativa ${tentativa} falhou: ${ultimoErro}`);
      if (tentativa < MAX_TENTATIVAS) {
        logFn(`[OCR] Aguardando 5s antes da próxima tentativa...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  // ── MÉTODO ALTERNATIVO: sem senha (fallback — somente após 3 falhas) ──────
  logFn(`[OCR] ⚠️  Método oficial falhou ${MAX_TENTATIVAS} vezes. Ativando MÉTODO ALTERNATIVO.`);
  logFn(`[OCR] ⚠️  ATENÇÃO: acesso sem senha — impacto na cadeia de custódia registrado.`);
  logFn(`[OCR] Último erro: ${ultimoErro}`);

  _motivoAlternativo = `Método oficial falhou após ${MAX_TENTATIVAS} tentativas. Último erro: ${ultimoErro}`;

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    (window as any).chrome = { runtime: {} };
  });

  _contextoEsaj = context;
  _metodoAcesso = "ALTERNATIVO";
  logFn(`[OCR] Sessão eSAJ estabelecida — MÉTODO ALTERNATIVO (sem senha)`);
  return context;
}

async function fecharSessaoESAJ(): Promise<void> {
  if (_browserEsaj) {
    await _browserEsaj.close();
    _browserEsaj = null;
    _contextoEsaj = null;
  }
}

/**
 * Renderiza uma página do PDF LOCAL via file:// no Chromium (PDFium) e captura screenshot.
 * Estratégia: baixar localmente → renderizar com Chrome nativo → OCR.
 * Não depende de URLs do eSAJ (que expiram por sessão).
 */
// Tamanho mínimo de screenshot que indica conteúdo real renderizado.
// PDFs escaneados renderizados corretamente produzem imagens PNG de 80KB+.
// Screenshots < 40KB indicam página ainda não renderizada ou genuinamente vazia.
const MIN_SCREENSHOT_BYTES = 40 * 1024;

/**
 * Abre o viewer eSAJ autenticado com a URL original do documento e captura screenshot.
 *
 * O viewer eSAJ usa uma versão customizada do PDF.js (com suporte ao FlateDecode
 * não-padrão do TJSP). É a ÚNICA engine que renderiza estes PDFs corretamente.
 *
 * REQUER sessão ativa do browser com autenticação eSAJ ainda válida (usar via
 * pipeline_completo.ts com manterSessaoAberta:true, ou dentro da mesma sessão do Agente 1).
 *
 * Espera adaptativa:
 *   1. Carrega viewer com URL do documento
 *   2. Aguarda canvas do PDF.js renderizar (seletor .page canvas)
 *   3. Se canvas não aparecer em 12s, tira screenshot e verifica tamanho
 *   4. Se screenshot < 40KB, aguarda mais 8s (máximo 2 tentativas)
 */
async function capturarPaginaViewer(
  urlPDF: string,         // URL original getPDF.do do eSAJ (válida na sessão atual)
  numeroPagina: number,
  dirTemp: string,
  context: BrowserContext,
  logFn: (msg: string) => void,
  senha: string = ""      // senha do processo para auto-fill do modal sigiloso
): Promise<{ imagemPath: string; sha256: string } | null> {
  const page = await context.newPage();

  try {
    const viewerBase = "https://esaj.tjsp.jus.br/pastadigital/js/viewer/web/viewer.html";
    const fileParam = encodeURIComponent(urlPDF.replace("https://esaj.tjsp.jus.br", ""));
    const viewerUrl = `${viewerBase}?file=${fileParam}#page=${numeroPagina}`;

    await page.goto(viewerUrl, { waitUntil: "networkidle", timeout: 30000 });

    // ── Auto-fill modal de senha (eSAJ pede senha novamente ao abrir viewer) ──
    // O modal aparece com input#senhaProcesso quando o documento é de processo sigiloso.
    // Se não tratado, o viewer fica bloqueado e o screenshot sai branco/vazio.
    const modalSenha = page.locator("input#senhaProcesso, input[name='senhaProcesso']").first();
    const temModal = await modalSenha.isVisible({ timeout: 3000 }).catch(() => false);
    if (temModal && senha) {
      logFn(`[OCR] Modal de senha detectado no viewer — preenchendo automaticamente...`);
      await modalSenha.fill(senha);
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      logFn(`[OCR] ✓ Senha preenchida — viewer liberado`);
    }

    // Esperar o canvas do PDF.js aparecer (indica que o PDF começou a renderizar)
    // Para páginas 2+, o #page=N no fragment faz o PDF.js rolar até a página correta.
    // Usamos seletor específico da página pelo data-page-number para evitar erro de clip
    // quando a página alvo está abaixo do viewport.
    const seletorPagina = `.page[data-page-number="${numeroPagina}"] canvas, .page[data-page-number="${numeroPagina}"]`;
    const seletorFallback = ".page canvas, #viewer .page";
    await page.waitForSelector(seletorPagina, { timeout: 12000 })
      .catch(() => page.waitForSelector(seletorFallback, { timeout: 5000 }).catch(() => {}));
    // Aguardar renderização das imagens dentro do canvas
    await page.waitForTimeout(5000);

    const nomeImagem = `ocr_viewer_p${String(numeroPagina).padStart(3, "0")}_${Date.now()}.png`;
    const imagemPath = path.join(dirTemp, nomeImagem);

    // Usar element.screenshot() que faz scroll automático para o elemento —
    // evita o erro "Clipped area is empty" que ocorre quando a página está fora do viewport.
    // Para páginas 2+, o elemento está abaixo do fold e boundingBox() retorna
    // coordenadas fora da tela, quebrando o clip. Element screenshot resolve isso.
    let screenshot: Buffer;
    const pageLocator = page.locator(`.page[data-page-number="${numeroPagina}"]`).first();
    const hasPageEl = await pageLocator.count().catch(() => 0) > 0;

    if (hasPageEl) {
      screenshot = await pageLocator.screenshot({ type: "png" }).catch(() => page.screenshot({ type: "png" }));
    } else {
      // fallback: screenshot da primeira página visível
      const firstPageEl = page.locator("#viewer .page").first();
      const hasFirst = await firstPageEl.count().catch(() => 0) > 0;
      screenshot = hasFirst
        ? await firstPageEl.screenshot({ type: "png" }).catch(() => page.screenshot({ type: "png" }))
        : await page.screenshot({ type: "png" });
    }

    logFn(`[OCR] Screenshot tentativa 1: ${(screenshot.length/1024).toFixed(0)}KB`);

    // Se muito pequeno, aguarda mais (PDF ainda carregando) e tenta novamente
    if (screenshot.length < MIN_SCREENSHOT_BYTES) {
      logFn(`[OCR] Screenshot pequeno — aguardando mais 8s para o PDF.js do eSAJ renderizar...`);
      await page.waitForTimeout(8000);

      if (hasPageEl) {
        screenshot = await pageLocator.screenshot({ type: "png" }).catch(() => page.screenshot({ type: "png" }));
      } else {
        screenshot = await page.screenshot({ type: "png" });
      }
      logFn(`[OCR] Screenshot tentativa 2: ${(screenshot.length/1024).toFixed(0)}KB`);
    }

    fs.writeFileSync(imagemPath, screenshot);
    const sha256 = sha256Buffer(screenshot);
    logFn(`[OCR] Screenshot final: ${(screenshot.length/1024).toFixed(0)}KB — SHA:${sha256.substring(0,12)}`);
    return { imagemPath, sha256 };
  } catch (err: any) {
    logFn(`[OCR] Erro ao capturar via viewer eSAJ: ${err.message}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Obtém o número real de páginas de um PDF local usando pdf-parse.
 * Retorna estimativa por tamanho em caso de falha.
 */
async function obterNumeroPaginas(arquivoPDF: string, tamanhoBytes: number): Promise<number> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const buf = fs.readFileSync(arquivoPDF);
    const data = await pdfParse(buf);
    return Math.max(1, data.numpages);
  } catch {
    // Fallback: heurística por tamanho (200KB/página média)
    const tamanhoKB = tamanhoBytes / 1024;
    return Math.min(30, Math.max(1, Math.floor(tamanhoKB / 200)));
  }
}

async function extrairTextoDeImagem(
  imagemPath: string,
  numeroPagina: number,
  client: Anthropic,
): Promise<{ texto: string; inputTokens: number; outputTokens: number }> {
  const imgBuffer = fs.readFileSync(imagemPath);
  const base64 = imgBuffer.toString("base64");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: base64 },
          },
          {
            type: "text",
            text: `Você é um especialista em OCR de documentos judiciais criminais brasileiros.

Esta é a página ${numeroPagina} de um processo criminal do TJSP (processo 1503896-55.2022.8.26.0050).
O réu é Glaidson Tadeu Rosa. A análise serve para apoiar a DEFESA.

Extraia TODO o texto visível, preservando a estrutura original. Dê atenção especial a:
- DATAS de atos processuais (prisão, apreensão, interrogatório, decisões)
- NOMES de autoridades (juiz, promotor, delegado, perito, testemunhas)
- NÚMEROS de identificação (CPF, RG, processo, boletim de ocorrência, auto)
- REFERÊNCIAS A PROVAS (laudos, apreensões, escutas, relatórios de inteligência)
- CARIMBOS e assinaturas (indicam autenticidade e cadeia de custódia)
- FUNDAMENTAÇÃO LEGAL citada (artigos de lei, jurisprudência)
- IRREGULARIDADES FORMAIS visíveis (rasuras, datas inconsistentes, campos em branco)

Regras de transcrição:
- Se a página estiver em branco ou mostrar apenas erro do viewer: responda [PÁGINA EM BRANCO]
- Se ilegível por qualidade de digitalização: responda [PÁGINA ILEGÍVEL]
- Não interprete — transcreva fielmente
- Texto difícil de ler: use [ilegível] no trecho
- Preserve numeração, parágrafos e estrutura de tabelas

Texto da página ${numeroPagina}:`,
          },
        ],
      },
    ],
  });

  const texto = response.content[0].type === "text" ? response.content[0].text : "";
  return { texto, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}

// ── Parte B: Análise Macro via Claude Sonnet ──────────────────────────────

async function gerarAnaliseMacro(
  numeroCNJ: string,
  paginasOCR: PaginaOCR[],
  dirSaida: string,
  client: Anthropic,
  logFn: (msg: string) => void
): Promise<AnaliseMacro> {
  const paginasValidas = paginasOCR.filter(p => p.qualidade === "VALIDO");

  if (paginasValidas.length === 0) {
    throw new Error("[OCR] Nenhuma página com texto válido para análise macro.");
  }

  // Montar texto completo com marcadores de origem (REGRA: todo dado tem fonte)
  const textoAgregado = paginasValidas.map(p =>
    `\n\n--- PEÇA ${p.numeroPeca} | PÁGINA ${p.numeroPagina} | GLOBAL ${p.paginaGlobal} ---\n${p.textoExtraido}`
  ).join("");

  const sha256TextoBase = createHash("sha256").update(textoAgregado, "utf-8").digest("hex");

  logFn(`[OCR] Gerando análise macro com Claude Sonnet...`);
  logFn(`[OCR] Texto base: ${textoAgregado.length} chars, ${paginasValidas.length} páginas — SHA-256: ${sha256TextoBase.substring(0, 16)}...`);

  const prompt = `Você é um advogado criminalista sênior especializado em direito processual penal brasileiro, com expertise em:
- Cadeia de custódia de provas (Art. 158-A a 158-F do CPP)
- Nulidades processuais absolutas e relativas (Art. 563 a 573 do CPP)
- Crimes financeiros e lavagem de dinheiro (Lei 9.613/98)
- Defesa em processos de grande complexidade com múltiplos réus

PROCESSO: ${numeroCNJ}
TRIBUNAL: Tribunal de Justiça de São Paulo (TJSP)
RÉU: Glaidson Tadeu Rosa
DEFENSORA: Dra. Márcia Mirtes

MANDATO DA DEFENSORA:
1. PRIMÁRIO: Verificar se a cadeia de custódia das provas está formalmente correta
2. SECUNDÁRIO: Identificar elementos para subsidiar a Resposta à Acusação

A seguir estão ${paginasValidas.length} páginas extraídas via OCR dos autos.
Cada página está identificada com peça e posição nos autos — cite sempre a fonte.

REGRAS ABSOLUTAS — INTEGRIDADE JURÍDICA:
- Cite SEMPRE a peça e página de origem (ex: "Peça 5, Pág. 3")
- Se não encontrar informação para uma seção: "[DADOS INSUFICIENTES — páginas analisadas não contêm esta informação]"
- NUNCA invente, suponha ou extrapole além do texto
- Inferências devem ser marcadas com [INFERÊNCIA] + base documental
- Dados sem fonte = dados inválidos para fins jurídicos

---

${textoAgregado}

---

## ANÁLISE MACRO DO PROCESSO ${numeroCNJ}

### SEÇÃO 1 — PARTES E IDENTIFICAÇÃO
Liste todas as partes identificadas: réu(s), vítimas, autoridades (juiz, promotor, delegado, peritos), testemunhas. Inclua cargos, datas e documentos de identificação visíveis.

### SEÇÃO 2 — CRONOLOGIA DE ATOS PROCESSUAIS
Liste em ordem cronológica TODOS os atos processuais encontrados.
Formato: DATA | TIPO DE ATO | AUTORIDADE RESPONSÁVEL | CONTEÚDO RESUMIDO | FONTE (Peça/Pág)
Destaque: prisões, apreensões, interrogatórios, laudos, decisões de mérito.

### SEÇÃO 3 — CADEIA DE CUSTÓDIA (FOCO PRIMÁRIO DO MANDATO)
Analise cada prova mencionada nos documentos sob o prisma da cadeia de custódia (Art. 158-A CPP):
- A prova foi coletada por agente competente? (cite nome e cargo)
- Há registro de hora, local e condições da coleta?
- Há lacração, numeração e rastreabilidade do material?
- Houve transferências de custódia documentadas?
- Existe laudo assinado por perito oficial habilitado?
Para cada prova: STATUS DA CUSTÓDIA: REGULAR / IRREGULAR / INCONCLUSIVO + justificativa + fonte.

### SEÇÃO 4 — NULIDADES E VÍCIOS PROCESSUAIS
Identifique nulidades absolutas ou relativas, irregularidades formais, violações constitucionais (CF/88 Art. 5º) ou convencionais (CADH):
- Nulidade | Fundamento legal | Descrição | Fonte documental
Categorias prioritárias: provas ilícitas, cerceamento de defesa, ausência de intimação, incompetência, vícios de forma.

### SEÇÃO 5 — SUBSÍDIOS PARA RESPOSTA À ACUSAÇÃO (FOCO SECUNDÁRIO)
Identifique nos documentos:
- Contradições entre provas ou versões
- Ausência de elementos essenciais da acusação
- Direitos não observados durante a investigação
- Elementos que enfraquecem o nexo causal entre réu e fatos imputados
- Precedentes do STF/STJ aplicáveis [INFERÊNCIA — necessita confirmação]

### SEÇÃO 6 — RECOMENDAÇÕES URGENTES PARA A DEFESA
Até 5 ações processuais prioritárias, em ordem de urgência, baseadas EXCLUSIVAMENTE nos documentos analisados. Inclua prazo estimado quando identificável nos autos.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const textoCompleto = response.content[0].type === "text" ? response.content[0].text : "";
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const custo = estimarCusto(inputTokens, outputTokens, "sonnet");

  logFn(`[OCR] Análise macro gerada: ${textoCompleto.length} chars — tokens: ${inputTokens}in/${outputTokens}out — custo: $${custo.toFixed(4)}`);

  // Extrair seções do markdown
  const extrairSecao = (titulo: string): string => {
    const regex = new RegExp(`### SEÇÃO \\d+ — ${titulo}\\n([\\s\\S]*?)(?=### SEÇÃO|$)`, "i");
    const m = textoCompleto.match(regex);
    return m ? m[1].trim() : "[Seção não encontrada na análise]";
  };

  const analise: AnaliseMacro = {
    numeroCNJ,
    geradoEm: new Date().toISOString(),
    totalPaginasAnalisadas: paginasValidas.length,
    modeloAnalise: "claude-sonnet-4-6",
    tokensUsados: inputTokens + outputTokens,
    custoEstimadoUSD: custo,
    sha256TextoBase,
    sha256Analise: createHash("sha256").update(textoCompleto, "utf-8").digest("hex"),
    partes: extrairSecao("PARTES E IDENTIFICAÇÃO"),
    cronologiaDecisoes: extrairSecao("CRONOLOGIA DE ATOS PROCESSUAIS"),
    nulidadesPotenciais: extrairSecao("NULIDADES E VÍCIOS PROCESSUAIS"),
    subsidiosDefesa: extrairSecao("SUBSÍDIOS PARA RESPOSTA À ACUSAÇÃO"),
    recomendacoesUrgentes: extrairSecao("RECOMENDAÇÕES URGENTES PARA A DEFESA"),
    textoCompleto,
  };

  // Salvar markdown
  const mdPath = path.join(dirSaida, "analise_macro.md");
  const mdConteudo = `# Análise Macro — Processo ${numeroCNJ}

**Gerado em:** ${analise.geradoEm}
**Modelo:** ${analise.modeloAnalise}
**Páginas analisadas:** ${analise.totalPaginasAnalisadas}
**SHA-256 texto base:** ${sha256TextoBase}
**SHA-256 desta análise:** ${analise.sha256Analise}

> ⚠️ Esta análise foi gerada com base em ${paginasValidas.length} páginas (de ${paginasOCR.length} processadas).
> Todas as afirmações têm fonte documental citada. Dados sem fonte = [DADOS INSUFICIENTES].

---

${textoCompleto}
`;

  fs.writeFileSync(mdPath, mdConteudo, "utf-8");
  fs.writeFileSync(
    path.join(dirSaida, "analise_macro.json"),
    JSON.stringify(analise, null, 2),
    "utf-8"
  );

  logFn(`[OCR] Análise macro salva: ${mdPath}`);
  return analise;
}

// ── Agente Principal ──────────────────────────────────────────────────────

export async function rodarOCR(
  dirSaida: string,
  numeroCNJ: string,
  senha: string,
  opcoes: {
    maxPaginas?: number;
    gerarMacro?: boolean;
    soMacro?: boolean;
    retomar?: boolean;
    contextoExistente?: BrowserContext;   // sessão aberta pelo Agente 1 (Opção A)
    logFn?: (msg: string) => void;
  } = {}
): Promise<{ checkpoint: OCRCheckpoint; analise?: AnaliseMacro }> {
  const {
    maxPaginas = 40,
    gerarMacro = true,
    soMacro = false,
    retomar = false,
    contextoExistente,
    logFn = log,
  } = opcoes;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("[OCR] ANTHROPIC_API_KEY não encontrada no ambiente");
  const client = new Anthropic({ apiKey });

  const checkpointDownloadPath = path.join(dirSaida, "checkpoint_download.json");
  if (!fs.existsSync(checkpointDownloadPath)) {
    throw new Error(`[OCR] checkpoint_download.json não encontrado.\nExecute os Agentes 1 e 2 primeiro.`);
  }

  const checkpointDownload: CheckpointDownload = JSON.parse(
    fs.readFileSync(checkpointDownloadPath, "utf-8")
  );

  // Carregar manifesto do Agente 1 para ter as URLs originais do viewer
  const manifestoPath = path.join(dirSaida, "manifesto_pecas.json");
  const manifesto: ManifestoPecas | null = fs.existsSync(manifestoPath)
    ? JSON.parse(fs.readFileSync(manifestoPath, "utf-8"))
    : null;

  // Índice de URL por número de peça
  const urlPorPeca = new Map<number, string>();
  if (manifesto) {
    for (const p of manifesto.pecas) {
      if (p.urlVerificada && p.urlPDF.includes("getPDF.do")) {
        urlPorPeca.set(p.numero, p.urlPDF);
      }
    }
  }

  const pecasValidas = checkpointDownload.pecas.filter(
    p => p.ehPDFValido && p.arquivoLocal && p.sha256Arquivo
  );

  logFn(`[OCR] PDFs disponíveis: ${pecasValidas.length} — meta: ${maxPaginas} páginas`);

  const ocrCheckpointPath = path.join(dirSaida, "ocr_checkpoint.json");
  let paginasJaProcessadas = new Map<string, PaginaOCR>();

  if (retomar && fs.existsSync(ocrCheckpointPath)) {
    const cp: OCRCheckpoint = JSON.parse(fs.readFileSync(ocrCheckpointPath, "utf-8"));
    for (const p of cp.paginas) {
      paginasJaProcessadas.set(`${p.numeroPeca}-${p.numeroPagina}`, p);
    }
    logFn(`[OCR] Retomando — ${paginasJaProcessadas.size} páginas já processadas`);
  }

  const dirTextos = path.join(dirSaida, "textos_ocr");
  const dirTempImgs = path.join(dirSaida, "ocr_temp_imgs");
  fs.mkdirSync(dirTextos, { recursive: true });
  fs.mkdirSync(dirTempImgs, { recursive: true });

  const paginasResultado: PaginaOCR[] = [];
  let paginaGlobal = 0;
  let custoTotal = 0;

  if (!soMacro) {
    logFn(`[OCR] ════ PARTE A: OCR — ${maxPaginas} páginas ════`);

    // Usar sessão existente (Opção A — pipeline contínuo) ou criar nova
    let esajContext: BrowserContext | null = null;
    if (contextoExistente) {
      logFn(`[OCR] Usando sessão autenticada do Agente 1 (pipeline contínuo)`);
      esajContext = contextoExistente;
      _contextoEsaj = contextoExistente;
      _metodoAcesso = "OFICIAL";
    } else {
      try {
        esajContext = await obterContextoESAJ(numeroCNJ, senha, logFn);
      } catch (err: any) {
        logFn(`[OCR] ERRO ao autenticar no eSAJ: ${err.message}`);
      }
    }

    outer: for (const peca of pecasValidas) {
      const arquivoLocal = peca.arquivoLocal!;
      const urlPDF = urlPorPeca.get(peca.numero) || "";

      // Obter número real de páginas (pdf-parse) ou estimativa por tamanho
      const totalPaginas = await obterNumeroPaginas(arquivoLocal, peca.tamanhoBytes || 0);

      logFn(`[OCR] Peça ${peca.numero}: ${path.basename(arquivoLocal)} — ${totalPaginas} páginas${urlPDF ? " (URL viewer disponível)" : " (sem URL viewer)"}`);

      for (let numPag = 1; numPag <= totalPaginas; numPag++) {
        if (paginaGlobal >= maxPaginas) break outer;

        paginaGlobal++;
        const chave = `${peca.numero}-${numPag}`;

        // Verificar se já foi processada (modo retomar)
        if (retomar && paginasJaProcessadas.has(chave)) {
          const anterior = paginasJaProcessadas.get(chave)!;
          paginasResultado.push(anterior);
          logFn(`[OCR] ↷ Peça ${peca.numero} Pág ${numPag} já processada (${anterior.qualidade})`);
          continue;
        }

        logFn(`[OCR] Pág global ${paginaGlobal}/${maxPaginas} — Peça ${peca.numero} Pág ${numPag}...`);

        const resultado: PaginaOCR = {
          numeroPeca: peca.numero,
          numeroPagina: numPag,
          paginaGlobal,
          arquivoPDF: peca.arquivoLocal!,
          sha256PDF: peca.sha256Arquivo!,
          sha256Imagem: null,
          textoExtraido: "",
          totalCharacters: 0,
          totalPalavras: 0,
          qualidade: "INVALIDO",
          motivoInvalido: null,
          modeloOCR: "claude-haiku-4-5-20251001",
          tokensUsados: 0,
          custoEstimadoUSD: 0,
          processadaEm: new Date().toISOString(),
        };

        try {
          // Capturar screenshot do viewer autenticado do eSAJ
          if (!esajContext) {
            resultado.motivoInvalido = "Sessão eSAJ não disponível";
            paginasResultado.push(resultado);
            salvarOCRCheckpoint(ocrCheckpointPath, numeroCNJ, paginasResultado, custoTotal);
            continue;
          }

          // Estratégia: viewer eSAJ (PDF.js com suporte FlateDecode TJSP) quando
          // URL disponível (sessão ativa). O viewer é a ÚNICA engine que renderiza
          // estes PDFs. file:// local não funciona (FlateDecode não-padrão).
          const imgResult = urlPDF
            ? await capturarPaginaViewer(urlPDF, numPag, dirTempImgs, esajContext, logFn, senha)
            : null;

          if (!imgResult && urlPDF) {
            logFn(`[OCR] Viewer falhou — URL pode ter expirado. Execute via pipeline_completo.ts para sessão fresca.`);
          }

          if (!imgResult) {
            resultado.motivoInvalido = "Falha ao capturar screenshot do viewer";
            paginasResultado.push(resultado);
            salvarOCRCheckpoint(ocrCheckpointPath, numeroCNJ, paginasResultado, custoTotal);
            continue;
          }

          resultado.sha256Imagem = imgResult.sha256;

          // OCR via Claude Haiku com a imagem PNG do viewer
          const { texto, inputTokens, outputTokens } = await extrairTextoDeImagem(
            imgResult.imagemPath, numPag, client
          );

          // Limpar imagem temporária
          try { fs.unlinkSync(imgResult.imagemPath); } catch {}

          const custo = estimarCusto(inputTokens, outputTokens, "haiku");
          custoTotal += custo;
          resultado.tokensUsados = inputTokens + outputTokens;
          resultado.custoEstimadoUSD = custo;

          // Validar qualidade do texto
          if (!texto || texto.trim().length === 0 || texto.includes("[PÁGINA ILEGÍVEL]")) {
            resultado.qualidade = "INVALIDO";
            resultado.motivoInvalido = "Página ilegível ou sem texto";
          } else if (texto.trim().length < 50) {
            resultado.qualidade = "SUSPEITO";
            resultado.motivoInvalido = `Texto muito curto (${texto.trim().length} chars)`;
            resultado.textoExtraido = texto;
          } else {
            resultado.qualidade = "VALIDO";
            resultado.textoExtraido = texto;
            resultado.totalCharacters = texto.length;
            resultado.totalPalavras = texto.trim().split(/\s+/).filter(Boolean).length;

            // Salvar texto
            const nomeArq = `peca_${String(peca.numero).padStart(5,"0")}_p${String(numPag).padStart(3,"0")}.txt`;
            fs.writeFileSync(path.join(dirTextos, nomeArq), texto, "utf-8");
          }

          logFn(`[OCR] ${resultado.qualidade === "VALIDO" ? "✓" : "✗"} Peça ${peca.numero} Pág ${numPag}: ${resultado.qualidade} — ${resultado.totalPalavras} palavras — $${custo.toFixed(4)}`);

        } catch (err: any) {
          resultado.motivoInvalido = `Erro OCR: ${err.message}`;
          logFn(`[OCR] ✗ Peça ${peca.numero} Pág ${numPag}: ERRO — ${err.message}`);
        }

        paginasResultado.push(resultado);

        // Salvar checkpoint parcial após cada página
        salvarOCRCheckpoint(ocrCheckpointPath, checkpointDownload.numeroCNJ, paginasResultado, custoTotal, _metodoAcesso, _motivoAlternativo);
      }
    }
  } else {
    // Modo --so-macro: carregar resultados existentes
    if (!fs.existsSync(ocrCheckpointPath)) {
      throw new Error("[OCR] ocr_checkpoint.json não encontrado para modo --so-macro");
    }
    const cp: OCRCheckpoint = JSON.parse(fs.readFileSync(ocrCheckpointPath, "utf-8"));
    paginasResultado.push(...cp.paginas);
    custoTotal = cp.custoTotalUSD;
    logFn(`[OCR] Modo --so-macro: carregadas ${cp.paginas.length} páginas do checkpoint`);
  }

  const checkpoint = salvarOCRCheckpoint(
    ocrCheckpointPath,
    checkpointDownload.numeroCNJ,
    paginasResultado,
    custoTotal,
    _metodoAcesso,
    _motivoAlternativo
  );

  logFn(`\n[OCR] ════ Resultado OCR ════`);
  logFn(`[OCR] Páginas processadas: ${checkpoint.totalPaginasProcessadas}`);
  logFn(`[OCR] Válidas: ${checkpoint.validas} | Inválidas: ${checkpoint.invalidas}`);
  logFn(`[OCR] Custo OCR: $${checkpoint.custoTotalUSD.toFixed(4)}`);

  // Parte B: Análise Macro
  let analise: AnaliseMacro | undefined;

  if (gerarMacro || soMacro) {
    const paginasValidas2 = paginasResultado.filter(p => p.qualidade === "VALIDO");
    if (paginasValidas2.length > 0) {
      logFn(`\n[OCR] ════ PARTE B: Análise Macro ════`);
      analise = await gerarAnaliseMacro(
        checkpointDownload.numeroCNJ,
        paginasResultado,
        dirSaida,
        client,
        logFn
      );
      logFn(`[OCR] Custo análise macro: $${analise.custoEstimadoUSD.toFixed(4)}`);
      logFn(`[OCR] Custo total estimado: $${(checkpoint.custoTotalUSD + analise.custoEstimadoUSD).toFixed(4)}`);
    } else {
      logFn(`[OCR] ⚠️  Nenhuma página válida para análise macro`);
    }
  }

  return { checkpoint, analise };
}

function salvarOCRCheckpoint(
  caminhoArquivo: string,
  numeroCNJ: string,
  paginas: PaginaOCR[],
  custoTotal: number,
  metodoAcesso: "OFICIAL" | "ALTERNATIVO" = "OFICIAL",
  motivoAlternativo?: string
): OCRCheckpoint {
  const checkpoint: OCRCheckpoint = {
    numeroCNJ,
    geradoEm: new Date().toISOString(),
    totalPaginasProcessadas: paginas.length,
    validas: paginas.filter(p => p.qualidade === "VALIDO").length,
    invalidas: paginas.filter(p => p.qualidade === "INVALIDO").length,
    custoTotalUSD: custoTotal,
    sha256Checkpoint: createHash("sha256").update(JSON.stringify(paginas)).digest("hex"),
    metodoAcesso,
    ...(motivoAlternativo ? { motivoAlternativo } : {}),
    paginas,
  };
  // Escrita atômica
  const tmp = caminhoArquivo + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(checkpoint, null, 2), "utf-8");
    fs.renameSync(tmp, caminhoArquivo);
  } catch {
    try { fs.writeFileSync(caminhoArquivo, JSON.stringify(checkpoint, null, 2), "utf-8"); } catch {}
  }
  return checkpoint;
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const dirSaida = args["saida"] || "./Saida/due_diligence/1503896";
  const numeroCNJ = args["cnj"] || "1503896-55.2022.8.26.0050";
  const senha = args["senha"] || process.env.TJSP_SENHA || "";
  const maxPaginas = args["paginas"] ? parseInt(args["paginas"]) : 40;
  const gerarMacro = args["macro"] !== "false";
  const soMacro = args["so-macro"] === "true";
  const retomar = args["retomar"] === "true";

  // Criar diretório de imagens temporárias
  const dirTemp = path.join(dirSaida, "ocr_temp_imgs");
  fs.mkdirSync(dirTemp, { recursive: true });

  log("═══════════════════════════════════════════════════════════");
  log("  AuraDUE — OCR Agent: Claude Haiku + Sonnet");
  log(`  CNJ: ${numeroCNJ}`);
  log(`  Meta: ${maxPaginas} páginas OCR + análise macro`);
  log("═══════════════════════════════════════════════════════════");

  const { checkpoint, analise } = await rodarOCR(dirSaida, numeroCNJ, senha, {
    maxPaginas,
    gerarMacro,
    soMacro,
    retomar,
  });

  log("═══════════════════════════════════════════════════════════");
  log(`  Páginas OCR válidas:  ${checkpoint.validas} / ${checkpoint.totalPaginasProcessadas}`);
  log(`  Custo OCR:            $${checkpoint.custoTotalUSD.toFixed(4)}`);
  if (analise) {
    log(`  Análise macro:        ✓ (${analise.totalPaginasAnalisadas} páginas)`);
    log(`  Custo análise:        $${analise.custoEstimadoUSD.toFixed(4)}`);
    log(`  Custo total:          $${(checkpoint.custoTotalUSD + analise.custoEstimadoUSD).toFixed(4)}`);
    log(`  Arquivo:              ${dirSaida}/analise_macro.md`);
  }
  log("═══════════════════════════════════════════════════════════");
}

const _isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("ocr_agent.ts");
if (_isMain) {
  main().catch((err) => {
    console.error("[FATAL]", err.message);
    process.exit(1);
  });
}
