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

    // Aguardar formulário de consulta
    await page.waitForSelector('input[name="processo.numero"], input[id*="processo"]', { timeout: 15000 });

    // Preencher número do processo — digit-by-digit para parecer humano
    const campoProcesso = page.locator('input[name="processo.numero"]').first();
    await campoProcesso.click();
    await page.waitForTimeout(300 + Math.random() * 200);
    await campoProcesso.type(numeroNorm, { delay: 60 + Math.random() * 40 });
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

    // Submeter formulário
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
      page.keyboard.press("Enter"),
    ]);

    // Verificar se acesso foi concedido
    const url = page.url();
    const conteudo = await page.content();

    if (conteudo.includes("Processo não encontrado") || conteudo.includes("Acesso negado")) {
      throw new Error("Acesso negado ou processo não encontrado. Verificar número e senha.");
    }

    // Se redirecionou para página de seleção (múltiplos resultados)
    if (url.includes("listView") || conteudo.includes("Selecione o processo")) {
      logFn(`[TJSP Auth] Múltiplos resultados — selecionando primeiro`);
      const primeiroLink = page.locator('a[href*="show.do"]').first();
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
        primeiroLink.click(),
      ]);
    }

    logFn(`[TJSP Auth] Acesso concedido. Extraindo metadados do processo...`);

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

  // Tentar navegar para aba de documentos
  const abaDocumentos = page.locator(
    'a:has-text("Documentos"), a:has-text("Peças"), a[href*="documento"], a[href*="peca"]',
  ).first();
  const abaVisivel = await abaDocumentos.isVisible().catch(() => false);

  if (abaVisivel) {
    await abaDocumentos.click();
    await page.waitForTimeout(2000);
  }

  // Selectors possíveis para tabela de peças no eSAJ
  const tabelaSelectors = [
    'table[id*="tabelaDocumentos"]',
    'table[id*="tabelaPecas"]',
    'table.resultTable',
    'table[summary*="peças"]',
    'table[summary*="documentos"]',
  ];

  let tabelaEncontrada = false;

  for (const selector of tabelaSelectors) {
    const tabela = page.locator(selector);
    const existe = await tabela.isVisible().catch(() => false);
    if (!existe) continue;

    tabelaEncontrada = true;
    const linhas = tabela.locator("tr");
    const totalLinhas = await linhas.count();
    logFn(`[TJSP Auth] Tabela de peças encontrada: ${totalLinhas} linhas`);

    for (let i = 1; i < totalLinhas; i++) { // pular cabeçalho
      const linha = linhas.nth(i);
      const colunas = linha.locator("td");
      const totalColunas = await colunas.count();
      if (totalColunas < 2) continue;

      const col0 = await colunas.nth(0).textContent().catch(() => "");
      const col1 = await colunas.nth(1).textContent().catch(() => "");
      const col2 = totalColunas > 2 ? await colunas.nth(2).textContent().catch(() => "") : "";
      const col3 = totalColunas > 3 ? await colunas.nth(3).textContent().catch(() => "") : "";

      // Buscar link de download
      const linkEl = linha.locator('a[href*="pdf"], a[href*="download"], a[href*="documento"]').first();
      const href = await linkEl.getAttribute("href").catch(() => null);
      const urlDownload = href ? (href.startsWith("http") ? href : `${ESAJ_BASE}${href}`) : null;

      pecas.push({
        numero: i,
        descricao: ((col1 || col0) ?? "").trim(),
        dataJuntada: col2?.trim() || col3?.trim() || null,
        tipoDocumento: (col0 ?? "").trim(),
        urlDownload,
        paginasEstimadas: null,
        sigilo: (col0 ?? "").toLowerCase().includes("sigilo") || (col1 ?? "").toLowerCase().includes("sigilo"),
      });
    }
    break;
  }

  if (!tabelaEncontrada) {
    // Fallback: busca por todos os links de PDF na página
    logFn(`[TJSP Auth] Tabela padrão não encontrada — buscando links de PDF na página`);
    const links = page.locator('a[href*=".pdf"], a[href*="download"], a[href*="getPDF"]');
    const totalLinks = await links.count();

    for (let i = 0; i < totalLinks; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute("href").catch(() => null);
      const texto = await link.textContent().catch(() => `Documento ${i + 1}`);
      if (!href) continue;

      pecas.push({
        numero: i + 1,
        descricao: texto?.trim() || `Documento ${i + 1}`,
        dataJuntada: null,
        tipoDocumento: "PDF",
        urlDownload: href.startsWith("http") ? href : `${ESAJ_BASE}${href}`,
        paginasEstimadas: null,
        sigilo: false,
      });
    }
  }

  return pecas;
}

export async function fecharSessao(browser: Browser): Promise<void> {
  await browser.close();
}
