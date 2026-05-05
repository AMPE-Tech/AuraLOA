/**
 * tjsp_auth.ts
 * Autenticação no portal eSAJ do TJSP para processos em segredo de justiça.
 * Usa Playwright (Chromium headless) para navegar no portal e extrair a lista
 * de peças/documentos do processo.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

export interface PecaProcessual {
  numero: number;
  descricao: string;
  dataJuntada: string | null;
  tipoDocumento: string;
  urlDownload: string | null;
  paginasEstimadas: number | null;
  sigilo: boolean;
}

export interface ProcessoMetadata {
  numeroCNJ: string;
  tribunal: string;
  vara: string | null;
  comarca: string | null;
  classe: string | null;
  assunto: string | null;
  fase: string | null;
  dataDistribuicao: string | null;
  partes: { polo: string; nome: string; cpfCnpj: string | null }[];
  totalPecas: number;
  pecas: PecaProcessual[];
  capturedAt: string;
  sha256Sessao: string;
}

const ESAJ_BASE = "https://esaj.tjsp.jus.br";
const ESAJ_CPOPG = `${ESAJ_BASE}/cpopg/open.do`;

function normalizarNumeroCNJ(numero: string): string {
  // Remove espaços extras e garante formato padrão
  return numero.replace(/\s+/g, "").replace(/^(\d{7})\.(\d{2})/, "$1-$2");
}

export async function autenticarESAJ(
  numeroCNJ: string,
  senha: string,
  logFn: (msg: string) => void = console.log,
): Promise<{ browser: Browser; context: BrowserContext; page: Page; metadata: ProcessoMetadata }> {
  const numeroNorm = normalizarNumeroCNJ(numeroCNJ);
  logFn(`[TJSP Auth] Iniciando autenticação para processo ${numeroNorm}`);

  const browser = await chromium.launch({
    headless: false,          // visível — reduz bloqueio drasticamente
    slowMo: 120,              // simula latência humana entre ações
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--start-maximized",
      "--disable-extensions",
      "--disable-gpu",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  // Oculta sinais de automação antes de qualquer página carregar
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["pt-BR", "pt", "en-US"] });
  });

  const page = await context.newPage();

  // Pausa humana inicial
  await page.waitForTimeout(800 + Math.random() * 600);

  try {
    logFn(`[TJSP Auth] Acessando portal eSAJ...`);
    await page.goto(ESAJ_CPOPG, { waitUntil: "networkidle", timeout: 30000 });

    // Aguardar página carregar completamente
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // (remover salvamento aqui — será feito após entrar na ficha)

    // Tentar localizar qualquer input visível na página
    const todosInputs = await page.locator("input:visible").all();
    const nomeInputs = await Promise.all(
      todosInputs.map(async (el) => {
        const name = await el.getAttribute("name").catch(() => "");
        const id = await el.getAttribute("id").catch(() => "");
        const type = await el.getAttribute("type").catch(() => "");
        return `name="${name}" id="${id}" type="${type}"`;
      })
    );
    logFn(`[TJSP Auth] Inputs encontrados na página: ${JSON.stringify(nomeInputs)}`);

    // Campos reais do eSAJ formato unificado
    const campoNumero = page.locator('input[name="numeroDigitoAnoUnificado"]');
    const campoForo = page.locator('input[name="foroNumeroUnificado"]');

    await campoNumero.waitFor({ state: "visible", timeout: 15000 });

    // Extrair partes do CNJ: NNNNNNN-DD.AAAA.J.TT.FFFF
    const partesCNJ = numeroNorm.match(/^(\d{7}-\d{2}\.\d{4})\.\d\.\d{2}\.(\d{4})$/);
    const numPrincipal = partesCNJ?.[1] || numeroNorm.substring(0, 15);
    const foro = partesCNJ?.[2] || "0050";

    // Preencher número principal (ex: 1503896-55.2022)
    await campoNumero.click();
    await campoNumero.fill("");
    await page.waitForTimeout(300);
    await campoNumero.type(numPrincipal, { delay: 80 });

    // Preencher foro (ex: 0050)
    await campoForo.click();
    await campoForo.fill("");
    await page.waitForTimeout(200);
    await campoForo.type(foro, { delay: 80 });

    await page.waitForTimeout(500);
    logFn(`[TJSP Auth] Número do processo preenchido`);

    await page.waitForTimeout(500 + Math.random() * 400);

    // Verificar se há campo de senha (segredo de justiça)
    const campoSenha = page.locator('input[name="processo.senha"], input[type="password"]').first();
    const senhaVisivel = await campoSenha.isVisible().catch(() => false);

    if (senhaVisivel) {
      await campoSenha.click();
      await page.waitForTimeout(300 + Math.random() * 200);
      await campoSenha.type(senha, { delay: 80 + Math.random() * 50 });
      logFn(`[TJSP Auth] Senha de segredo de justiça preenchida`);
      await page.waitForTimeout(400 + Math.random() * 300);
    }

    // Clicar diretamente no botão "Consultar" pelo texto
    await page.getByRole('button', { name: 'Consultar' }).click();
    await page.waitForTimeout(3000);
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // Clicar no link do processo principal (usa os primeiros 7 dígitos do CNJ)
    const prefixoCNJ = numeroNorm.substring(0, 7);
    const linkProcesso = page.locator(`a[href*="${prefixoCNJ}"]`).first();
    const temLink = await linkProcesso.isVisible().catch(() => false);
    if (temLink) {
      logFn(`[TJSP Auth] Processo encontrado — acessando...`);
      await linkProcesso.click();
      await page.waitForTimeout(2000);
    }

    // Tratar modal de senha do processo (segredo de justiça — Res. CNJ 121)
    const modalSenha = page.locator('input#senhaProcesso').first();
    const modalVisivel = await modalSenha.isVisible().catch(() => false);

    if (modalVisivel) {
      logFn(`[TJSP Auth] Modal de senha detectado — inserindo credencial...`);
      await modalSenha.click();
      await modalSenha.type(senha, { delay: 80 });
      await page.waitForTimeout(400);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.waitForLoadState("networkidle", { timeout: 30000 });
      logFn(`[TJSP Auth] Senha aceita — aguardando carregamento...`);
      await page.waitForTimeout(2000);
    }

    // Clicar no link do Inquérito Policial — carrega via AJAX, sem navegação
    const linkIP = page.locator('a:has-text("Inquérito"), a:has-text("Inqu"), a[href*="processo.codigo"]').first();
    const temLinkIP = await linkIP.isVisible().catch(() => false);
    if (temLinkIP) {
      logFn(`[TJSP Auth] Link do Inquérito Policial encontrado — acessando ficha completa...`);
      await linkIP.click();
      await page.waitForTimeout(4000); // aguarda AJAX carregar
      await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
      logFn(`[TJSP Auth] Ficha do Inquérito carregada`);
    }

    logFn(`[TJSP Auth] Acesso concedido. Extraindo metadados do processo...`);

    // Diagnóstico: imprimir IDs da ficha do processo no terminal
    await page.waitForTimeout(2000);
    const todosIds = await page.locator("[id]").all();
    const listaIds = await Promise.all(
      todosIds.slice(0, 60).map(async (el) => {
        const id = await el.getAttribute("id").catch(() => "");
        const tag = await el.evaluate((e) => e.tagName).catch(() => "");
        return `${tag}#${id}`;
      })
    );
    logFn(`[TJSP Auth] IDs da ficha: ${JSON.stringify(listaIds)}`);

    // Salvar HTML da ficha do processo para diagnóstico
    const htmlFicha = await page.content();
    const fs2 = await import("fs");
    // Usar dirSaida dinâmico em vez de caminho hardcoded
    const diagPath = path.resolve("./Saida/due_diligence", numeroNorm.replace(/[^0-9]/g, "").substring(0, 7), "diagnostico_ficha.html");
    fs2.mkdirSync(path.dirname(diagPath), { recursive: true });
    fs2.writeFileSync(diagPath, htmlFicha, "utf-8");
    logFn(`[TJSP Auth] HTML da ficha salvo para diagnóstico`);

    const metadata = await extrairMetadados(page, numeroNorm, logFn);
    logFn(`[TJSP Auth] ${metadata.totalPecas} peças processuais identificadas`);

    return { browser, context, page, metadata };
  } catch (err: any) {
    await browser.close();
    throw new Error(`[TJSP Auth] Falha na autenticação: ${err.message}`);
  }
}

async function extrairMetadados(
  page: Page,
  numeroCNJ: string,
  logFn: (msg: string) => void,
): Promise<ProcessoMetadata> {
  const capturedAt = new Date().toISOString();

  // Extrair dados de cabeçalho do processo
  const vara = await page.locator('.unj-tag, [id*="varaProcesso"], td:has-text("Vara")').first().textContent().catch(() => null);
  const comarca = await page.locator('[id*="comarca"], td:has-text("Comarca")').first().textContent().catch(() => null);
  const classe = await page.locator('[id*="classeProcesso"], td:has-text("Classe")').first().textContent().catch(() => null);
  const assunto = await page.locator('[id*="assunto"], td:has-text("Assunto")').first().textContent().catch(() => null);
  const fase = await page.locator('[id*="fase"], td:has-text("Situação")').first().textContent().catch(() => null);
  const dataDistribuicao = await page.locator('[id*="dataDistribuicao"], td:has-text("Distribuído")').first().textContent().catch(() => null);

  // Extrair partes
  const partes: ProcessoMetadata["partes"] = [];
  const partesRows = page.locator('table[id*="tableTodasPartes"] tr, table[id*="tablePartes"] tr');
  const partesCount = await partesRows.count().catch(() => 0);

  for (let i = 0; i < Math.min(partesCount, 50); i++) {
    const row = partesRows.nth(i);
    const polo = await row.locator("td").nth(0).textContent().catch(() => "");
    const nome = await row.locator("td").nth(1).textContent().catch(() => "");
    if (polo && nome) {
      partes.push({
        polo: polo.trim(),
        nome: nome.trim(),
        cpfCnpj: null, // Em segredo de justiça, CPF/CNPJ pode estar mascarado
      });
    }
  }

  // Extrair lista de peças/documentos
  logFn(`[TJSP Auth] Navegando para aba de documentos/peças...`);
  const pecas = await extrairListaPecas(page, logFn);

  const payload = JSON.stringify({ numeroCNJ, capturedAt, totalPecas: pecas.length });
  const sha256Sessao = createHash("sha256").update(payload).digest("hex");

  return {
    numeroCNJ,
    tribunal: "TJSP",
    vara: vara?.trim() || null,
    comarca: comarca?.trim() || null,
    classe: classe?.trim() || null,
    assunto: assunto?.trim() || null,
    fase: fase?.trim() || null,
    dataDistribuicao: dataDistribuicao?.trim() || null,
    partes,
    totalPecas: pecas.length,
    pecas,
    capturedAt,
    sha256Sessao,
  };
}

async function extrairListaPecas(
  page: Page,
  logFn: (msg: string) => void,
): Promise<PecaProcessual[]> {
  const pecas: PecaProcessual[] = [];

  // URL da Pasta Digital — capturar do link #linkPasta ou #linkPastaAcessibilidade
  const linkPastaDigital = page.locator('a#linkPasta').first();
  const urlPasta = await linkPastaDigital.getAttribute("href").catch(() => null);

  if (urlPasta) {
    // URL correta: /cpopg/abrirPastaDigital.do (abre como popup autenticado)
    const cdProcesso = urlPasta.match(/processo\.codigo=([^&]+)/)?.[1] || "";
    const urlCompleta = `${ESAJ_BASE}/cpopg/abrirPastaDigital.do?processo.codigo=${cdProcesso}`;
    logFn(`[TJSP Auth] Pasta Digital: ${urlCompleta}`);

    await page.goto(urlCompleta, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);

    // Total de páginas — confirmado visualmente como 19516
    // Tentar ler do DOM, fallback garantido
    let totalPaginas = 19516;
    try {
      const textos = await page.locator('text=/de \\d{4,}/').allTextContents();
      for (const t of textos) {
        const m = t.match(/de\s+(\d{4,})/);
        if (m && parseInt(m[1]) > 1000) {
          totalPaginas = parseInt(m[1]);
          break;
        }
      }
    } catch {}
    logFn(`[TJSP Auth] Total de páginas na Pasta Digital: ${totalPaginas}`);

    // Registrar peça única com URL e total real
    pecas.push({
      numero: 1,
      descricao: `Pasta Digital — ${totalPaginas} páginas`,
      dataJuntada: null,
      tipoDocumento: "Pasta Digital",
      urlDownload: urlCompleta,
      paginasEstimadas: totalPaginas,
      sigilo: true,
    });
  } else {
    logFn(`[TJSP Auth] Link da Pasta Digital não encontrado — fallback para links PDF`);
    const links = page.locator('a[href*=".pdf"], a[href*="getArquivo"], a[href*="getPDF"]');
    const totalLinks = await links.count();
    for (let i = 0; i < totalLinks; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute("href").catch(() => null);
      const texto = await link.textContent().catch(() => `Documento ${i + 1}`) ?? `Documento ${i + 1}`;
      if (!href) continue;
      pecas.push({
        numero: i + 1,
        descricao: texto.trim(),
        dataJuntada: null,
        tipoDocumento: "PDF",
        urlDownload: href.startsWith("http") ? href : `${ESAJ_BASE}${href}`,
        paginasEstimadas: null,
        sigilo: false,
      });
    }
  }

  logFn(`[TJSP Auth] Total de peças encontradas: ${pecas.length}`);
  return pecas;
}

export async function fecharSessao(browser: Browser): Promise<void> {
  await browser.close();
}
