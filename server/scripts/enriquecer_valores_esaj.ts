/**
 * enriquecer_valores_esaj.ts
 *
 * Extrai o "Valor da Ação" da capa de processos no eSAJ (CPOPG) usando
 * Playwright com antibot (mesmo setup maduro do pipeline criminal).
 *
 * Uso:
 *   npx tsx server/scripts/enriquecer_valores_esaj.ts \
 *     --csv=C:/Users/MarcosCosta/Downloads/cruzamento_4_camadas_2026.csv \
 *     --saida=C:/Temp/auraloa-saida/enriquecido \
 *     --amostra=10           # percentual (default 10%)
 *     --headless=false       # visível para debug (default false)
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

// ─── CLI args ───────────────────────────────────────────────────────
function parseArgs() {
  const args: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    args[k] = v.join("=");
  }
  return args;
}

// ─── CSV parser (delimitador ;) ─────────────────────────────────────
interface ProcessoCSV {
  numeroCNJ: string;
  numeroFormatado: string;
  tribunal: string;
  classe: string;
  situacao: string;
  valorCausa: string;
  fonteValor: string;
  dataAjuizamento: string;
  orgaoJulgador: string;
  pagamentoPendente: string;
  urlPJe: string;
  urlEProc: string;
}

function parsePrecatoriosFromCSV(csvPath: string): ProcessoCSV[] {
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n");

  // Encontrar seção "PRECATORIOS PENDENTES"
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("PRECATORIOS PENDENTES")) {
      startIdx = i + 2; // pula header da seção + header das colunas
      break;
    }
  }
  if (startIdx === -1) throw new Error("Seção PRECATORIOS PENDENTES não encontrada no CSV");

  const processos: ProcessoCSV[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("===")) break;

    // Parse CSV com ; respeitando aspas
    const campos = parseSemicolonLine(line);
    if (campos.length < 5) continue;

    processos.push({
      numeroCNJ: campos[0] || "",
      numeroFormatado: campos[1] || "",
      tribunal: campos[2] || "",
      classe: campos[3] || "",
      situacao: campos[4] || "",
      valorCausa: campos[5] || "",
      fonteValor: campos[6] || "",
      dataAjuizamento: campos[7] || "",
      orgaoJulgador: campos[8] || "",
      pagamentoPendente: campos[9] || "",
      urlPJe: campos[10] || "",
      urlEProc: campos[11] || "",
    });
  }
  return processos;
}

function parseSemicolonLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ";" && !inQuotes) { result.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

// ─── Browser antibot (idêntico ao tjsp_auth.ts) ────────────────────
async function criarBrowserAntibot(headless: boolean): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 80 : 200,
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

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["pt-BR", "pt", "en-US"] });
    (window as any).chrome = { runtime: {} };
  });

  return { browser, context };
}

// ─── Navegação CPOPG (mesmo fluxo do tjsp_auth.ts) ─────────────────
const ESAJ_CPOPG = "https://esaj.tjsp.jus.br/cpopg/open.do";

async function navegarParaFichaProcesso(page: Page, numeroFormatado: string, log: (msg: string) => void): Promise<boolean> {
  try {
    await page.goto(ESAJ_CPOPG, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500 + Math.random() * 800);

    const campoNumero = page.locator('input[name="numeroDigitoAnoUnificado"]');
    const campoForo = page.locator('input[name="foroNumeroUnificado"]');

    const temCampo = await campoNumero.isVisible({ timeout: 5000 }).catch(() => false);
    if (!temCampo) { log(`  ✗ Campo de busca não encontrado`); return false; }

    // Extrair partes do CNJ: NNNNNNN-DD.AAAA.J.TT.FFFF
    const partesCNJ = numeroFormatado.match(/^(\d{7}-\d{2}\.\d{4})\.\d\.\d{2}\.(\d{4})$/);
    const numPrincipal = partesCNJ?.[1] || numeroFormatado.substring(0, 15);
    const foro = partesCNJ?.[2] || "0053";

    // Preencher número (comportamento humano)
    await campoNumero.click();
    await campoNumero.fill("");
    await page.waitForTimeout(200 + Math.random() * 200);
    await campoNumero.type(numPrincipal, { delay: 60 + Math.random() * 40 });

    // Preencher foro
    await campoForo.click();
    await campoForo.fill("");
    await page.waitForTimeout(150 + Math.random() * 150);
    await campoForo.type(foro, { delay: 60 + Math.random() * 40 });

    await page.waitForTimeout(400 + Math.random() * 300);

    // Clicar "Consultar"
    await page.getByRole("button", { name: "Consultar" }).click();
    await page.waitForTimeout(2500 + Math.random() * 1000);
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // Clicar no link do processo na listagem (usa os primeiros 7 dígitos)
    const prefixoCNJ = numeroFormatado.substring(0, 7);
    const linkProcesso = page.locator(`a[href*="${prefixoCNJ}"]`).first();
    const temLink = await linkProcesso.isVisible({ timeout: 5000 }).catch(() => false);
    if (temLink) {
      await linkProcesso.click();
      await page.waitForTimeout(2000 + Math.random() * 1000);
      await page.waitForLoadState("domcontentloaded");
    }

    return true;
  } catch (err: any) {
    log(`  ✗ Erro na navegação: ${err.message}`);
    return false;
  }
}

// ─── Extração do valor da capa do processo ──────────────────────────
async function extrairValorDaCapa(page: Page, numeroFormatado: string, log: (msg: string) => void): Promise<string | null> {
  try {
    // Navegar até a ficha do processo via CPOPG (mesmo fluxo do tjsp_auth)
    const ok = await navegarParaFichaProcesso(page, numeroFormatado, log);
    if (!ok) return null;

    // Seletor principal confirmado no diagnóstico: #valorAcaoProcesso
    const elValor = page.locator('#valorAcaoProcesso');
    const visivel = await elValor.isVisible({ timeout: 3000 }).catch(() => false);

    if (visivel) {
      const texto = await elValor.textContent().catch(() => null);
      if (texto) {
        const valor = texto.trim().replace(/\s+/g, " ");
        if (valor && valor.includes("$")) {
          log(`  ✓ ${valor}`);
          return valor;
        }
      }
    }

    // Fallback: buscar no HTML por R$ dentro da área de dados
    const html = await page.content();
    const match = html.match(/id="valorAcaoProcesso"[^>]*>([^<]+)</);
    if (match) {
      const valor = match[1].trim();
      if (valor) {
        log(`  ✓ ${valor} (via HTML)`);
        return valor;
      }
    }

    log(`  ✗ Valor não encontrado na capa`);
    return null;
  } catch (err: any) {
    log(`  ✗ Erro: ${err.message}`);
    return null;
  }
}

function extrairValorNumerico(texto: string): string | null {
  // Remove "Valor da ação:" e extrai "R$ X.XXX,XX"
  const clean = texto.replace(/Valor\s+da\s+(?:a[çc][ãa]o|causa)\s*:?\s*/i, "").trim();
  const match = clean.match(/R?\$?\s*([\d.,]+)/);
  if (match) return `R$ ${match[1]}`;
  return null;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  const csvPath = args.csv || "C:/Users/MarcosCosta/Downloads/cruzamento_4_camadas_2026.csv";
  const saidaDir = args.saida || "C:/Temp/auraloa-saida/enriquecido";
  const pctAmostra = parseInt(args.amostra || "10", 10);
  const headless = args.headless === "true";

  console.log(`\n═══ ENRIQUECIMENTO DE VALORES — eSAJ CPOPG ═══`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Saída: ${saidaDir}`);
  console.log(`Amostra: ${pctAmostra}%`);
  console.log(`Headless: ${headless}\n`);

  // 1. Ler CSV e filtrar Precatórios (excluir RPV)
  const todos = parsePrecatoriosFromCSV(csvPath);
  const precatorios = todos.filter(p => p.classe === "Precatório" && p.tribunal === "TJSP");
  console.log(`Total no CSV: ${todos.length} | Precatórios TJSP: ${precatorios.length}`);

  // 2. Amostra de 10%
  const tamanhoAmostra = Math.ceil(precatorios.length * (pctAmostra / 100));
  const amostra = precatorios.slice(0, tamanhoAmostra);
  console.log(`Amostra (${pctAmostra}%): ${amostra.length} processos\n`);

  // 3. Criar diretório de saída
  fs.mkdirSync(saidaDir, { recursive: true });

  // 4. Lançar browser antibot
  const { browser, context } = await criarBrowserAntibot(headless);
  const page = await context.newPage();

  // Pausa humana inicial
  await page.waitForTimeout(1000 + Math.random() * 500);

  // 5. Iterar processos e extrair valor
  const resultados: Array<ProcessoCSV & { valorExtraido: string | null; fonteExtracao: string }> = [];
  let encontrados = 0;
  let erros = 0;

  for (let i = 0; i < amostra.length; i++) {
    const proc = amostra[i];

    console.log(`[${i + 1}/${amostra.length}] ${proc.numeroFormatado} — ${proc.classe}`);

    const valor = await extrairValorDaCapa(page, proc.numeroFormatado, console.log);

    resultados.push({
      ...proc,
      valorExtraido: valor,
      fonteExtracao: valor ? "esaj_cpopg" : "nao_encontrado",
    });

    if (valor) encontrados++;
    else erros++;

    // Pausa entre consultas (comportamento humano + evitar rate limit)
    if (i < amostra.length - 1) {
      const pausa = 2000 + Math.random() * 3000;
      console.log(`  ⏳ Pausa ${(pausa / 1000).toFixed(1)}s...\n`);
      await page.waitForTimeout(pausa);
    }
  }

  // 6. Fechar browser
  await browser.close();

  // 7. Salvar CSV enriquecido
  const csvSaida = path.join(saidaDir, `precatorios_enriquecidos_${pctAmostra}pct.csv`);
  const header = "Numero CNJ;Numero Formatado;Tribunal;Classe;Situacao;Valor Causa Original;Valor Extraido eSAJ;Fonte Extracao;Data Ajuizamento;Orgao Julgador;URL eSAJ\n";
  const linhas = resultados.map(r =>
    [
      r.numeroCNJ,
      r.numeroFormatado,
      r.tribunal,
      r.classe,
      r.situacao,
      r.valorCausa,
      r.valorExtraido || "",
      r.fonteExtracao,
      r.dataAjuizamento,
      `"${r.orgaoJulgador}"`,
      r.urlPJe,
    ].join(";")
  ).join("\n");

  fs.writeFileSync(csvSaida, header + linhas, "utf-8");

  // 8. Salvar JSON detalhado
  const jsonSaida = path.join(saidaDir, `precatorios_enriquecidos_${pctAmostra}pct.json`);
  fs.writeFileSync(jsonSaida, JSON.stringify({
    geradoEm: new Date().toISOString(),
    csvOrigem: csvPath,
    totalPrecatorios: precatorios.length,
    amostra: amostra.length,
    encontrados,
    naoEncontrados: erros,
    taxaSucesso: `${((encontrados / amostra.length) * 100).toFixed(1)}%`,
    resultados,
  }, null, 2), "utf-8");

  // 9. Resumo
  console.log(`\n═══ RESULTADO ═══`);
  console.log(`Processos consultados: ${amostra.length}`);
  console.log(`Valores encontrados: ${encontrados} (${((encontrados / amostra.length) * 100).toFixed(1)}%)`);
  console.log(`Não encontrados: ${erros}`);
  console.log(`CSV: ${csvSaida}`);
  console.log(`JSON: ${jsonSaida}`);
}

main().catch((err) => {
  console.error(`\n❌ Erro fatal: ${err.message}`);
  process.exit(1);
});
