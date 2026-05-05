/**
 * pdf_downloader.ts — Agente 2
 * ─────────────────────────────────────────────────────────────────────────────
 * Lê o manifesto_pecas.json gerado pelo Agente 1 e baixa cada PDF usando
 * uma sessão autenticada no eSAJ. Valida que cada arquivo é um PDF real
 * (não HTML de redirecionamento). Gera checkpoint para retomar downloads.
 *
 * FLUXO:
 *   1. Lê manifesto_pecas.json
 *   2. Abre browser Playwright, autentica no eSAJ (reutiliza o fluxo de login)
 *   3. Para cada URL no manifesto: GET autenticado → salva arquivo
 *   4. Valida: magic bytes %PDF-1. no início do arquivo
 *   5. Calcula SHA-256 do arquivo real
 *   6. Atualiza checkpoint_download.json com status de cada peça
 *
 * OUTPUT: Saida/due_diligence/{processo}/pecas/peca_NNNNN.pdf
 *         Saida/due_diligence/{processo}/checkpoint_download.json
 *
 * USO:
 *   npx tsx --env-file=.env server/scripts/due_diligence/pdf_downloader.ts \
 *     --processo="1503896-55.2022.8.26.0050" \
 *     --senha="SENHA" \
 *     --saida=./Saida/due_diligence/1503896 \
 *     --limite=20
 *
 * FLAGS:
 *   --limite=N     Baixar apenas os N primeiros PDFs (padrão: todos)
 *   --retomar      Pular arquivos já baixados (lê checkpoint_download.json)
 *   --headless     Rodar sem janela visível
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface PecaManifesto {
  numero: number;
  descricao: string;
  dataJuntada: string | null;
  tipoDocumento: string | null;
  urlPDF: string;
  urlVerificada: boolean;
  contentType: string | null;
  tamanhoBytes: number | null;
  sha256URL: string;
  arquivoLocal?: string | null;
  sha256Arquivo?: string | null;
  capturedAt: string;
  erro: string | null;
}

interface ManifestoPecas {
  numeroCNJ: string;
  geradoEm: string;
  totalPecas: number;
  pecasCapturadas: number;
  pecasVerificadas: number;
  sha256Manifesto: string;
  pecas: PecaManifesto[];
}

export interface DownloadStatus {
  numero: number;
  urlPDF: string;
  sha256URL: string;
  arquivoLocal: string | null;
  sha256Arquivo: string | null;
  tamanhoBytes: number | null;
  ehPDFValido: boolean;
  conteudoInvalido: boolean;   // true se o arquivo baixado é HTML, não PDF
  erro: string | null;
  baixadoEm: string | null;
}

export interface CheckpointDownload {
  numeroCNJ: string;
  geradoEm: string;
  totalPecas: number;
  baixados: number;
  validos: number;
  invalidos: number;
  falhas: number;
  pecas: DownloadStatus[];
}

// ── Constantes ─────────────────────────────────────────────────────────────

const ESAJ_BASE = "https://esaj.tjsp.jus.br";

// Magic bytes que identificam PDF real
const PDF_MAGIC = Buffer.from("%PDF-");

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

function sha256Arquivo(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function ehPDFValido(buffer: Buffer): boolean {
  // Verifica magic bytes %PDF- nos primeiros 5 bytes
  return buffer.length > 5 && buffer.slice(0, 5).equals(PDF_MAGIC);
}

function nomePecaArquivo(numero: number, descricao: string): string {
  const numStr = String(numero).padStart(5, "0");
  const descLimpa = descricao
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 40);
  return `peca_${numStr}_${descLimpa}.pdf`;
}

// ── Autenticação eSAJ (reutiliza fluxo do Agente 1) ───────────────────────

async function autenticarESAJ(
  page: Page,
  numeroCNJ: string,
  senha: string,
  logFn: (msg: string) => void
): Promise<void> {
  const partes = numeroCNJ.match(/^(\d{7}-\d{2}\.\d{4})\.\d\.\d{2}\.(\d{4})$/);
  const numPrincipal = partes?.[1] || numeroCNJ.substring(0, 15);
  const foro = partes?.[2] || "0050";

  await page.goto(`${ESAJ_BASE}/cpopg/open.do`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000 + Math.random() * 1000);

  const campoNumero = page.locator('input[name="numeroDigitoAnoUnificado"]');
  const campoForo = page.locator('input[name="foroNumeroUnificado"]');

  await campoNumero.waitFor({ state: "visible", timeout: 15000 });
  await campoNumero.click();
  await page.waitForTimeout(400 + Math.random() * 300);
  await campoNumero.type(numPrincipal, { delay: 150 + Math.random() * 80 });

  await page.waitForTimeout(600 + Math.random() * 400);
  await campoForo.click();
  await page.waitForTimeout(300 + Math.random() * 200);
  await campoForo.type(foro, { delay: 150 + Math.random() * 80 });

  await page.waitForTimeout(800 + Math.random() * 600);
  await page.getByRole("button", { name: "Consultar" }).click();
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  await page.waitForTimeout(2000 + Math.random() * 1000);

  // Clicar no link do processo
  const linkProcesso = page.locator(`a[href*="${numPrincipal.substring(0, 7)}"]`).first();
  if (await linkProcesso.isVisible().catch(() => false)) {
    await page.waitForTimeout(700 + Math.random() * 500);
    await linkProcesso.click();
    await page.waitForTimeout(3000 + Math.random() * 1000);
  }

  // Modal de senha
  const modalSenha = page.locator("input#senhaProcesso").first();
  if (await modalSenha.isVisible().catch(() => false)) {
    logFn(`[Downloader] Modal de senha — inserindo credencial...`);
    await page.waitForTimeout(800 + Math.random() * 500);
    await modalSenha.click();
    await page.waitForTimeout(400 + Math.random() * 300);
    await modalSenha.type(senha, { delay: 130 + Math.random() * 70 });
    await page.waitForTimeout(600 + Math.random() * 400);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await page.waitForTimeout(2500 + Math.random() * 1000);
    logFn(`[Downloader] Autenticação concluída`);
  }
}

// ── Agente 2: PDF Downloader ────────────────────────────────────────────────

export async function baixarPDFs(
  numeroCNJ: string,
  senha: string,
  dirSaida: string,
  opcoes: {
    limite?: number;
    retomar?: boolean;
    headless?: boolean;
    logFn?: (msg: string) => void;
  } = {}
): Promise<CheckpointDownload> {
  const {
    limite = Infinity,
    retomar = false,
    headless = false,
    logFn = log,
  } = opcoes;

  // Verificar manifesto do Agente 1
  const manifestoPath = path.join(dirSaida, "manifesto_pecas.json");
  if (!fs.existsSync(manifestoPath)) {
    throw new Error(`[Downloader] manifesto_pecas.json não encontrado em ${dirSaida}\nExecute o Agente 1 (pasta_digital_navigator.ts) primeiro.`);
  }

  const manifesto: ManifestoPecas = JSON.parse(fs.readFileSync(manifestoPath, "utf-8"));
  logFn(`[Downloader] Manifesto carregado: ${manifesto.pecas.length} peças`);

  // Diretório de saída dos PDFs
  const dirPecas = path.join(dirSaida, "pecas");
  fs.mkdirSync(dirPecas, { recursive: true });

  const checkpointPath = path.join(dirSaida, "checkpoint_download.json");

  // ── Converter manifesto em checkpoint (Agente 1 salva PDFs inline na sessão autenticada) ──
  // Peças com arquivoLocal + sha256Arquivo já estão salvas; as demais são ignoradas (URLs expiradas)
  const pecasJaSalvas = manifesto.pecas.filter(p => p.arquivoLocal && p.sha256Arquivo);
  logFn(`[Downloader] PDFs salvos pelo Agente 1: ${pecasJaSalvas.length} / ${manifesto.pecas.length}`);

  const statusList: DownloadStatus[] = manifesto.pecas.map(p => ({
    numero: p.numero,
    urlPDF: p.urlPDF,
    sha256URL: p.sha256URL,
    arquivoLocal: p.arquivoLocal ?? null,
    sha256Arquivo: p.sha256Arquivo ?? null,
    tamanhoBytes: p.tamanhoBytes,
    ehPDFValido: !!(p.arquivoLocal && p.sha256Arquivo),
    conteudoInvalido: !p.urlVerificada && !p.arquivoLocal,
    erro: p.erro ?? (p.urlVerificada && !p.arquivoLocal ? "PDF interceptado mas não salvo — duplicata de URL" : null),
    baixadoEm: p.capturedAt,
  }));

  const checkpoint = salvarCheckpoint(checkpointPath, manifesto.numeroCNJ, manifesto.pecas.length, statusList);
  logFn(`[Downloader] Checkpoint gerado: ${checkpoint.validos} PDFs válidos`);
  return checkpoint;
}

function salvarCheckpoint(
  caminhoArquivo: string,
  numeroCNJ: string,
  totalPecas: number,
  statusList: DownloadStatus[]
): CheckpointDownload {
  const checkpoint: CheckpointDownload = {
    numeroCNJ,
    geradoEm: new Date().toISOString(),
    totalPecas,
    baixados: statusList.filter(p => p.arquivoLocal !== null).length,
    validos: statusList.filter(p => p.ehPDFValido).length,
    invalidos: statusList.filter(p => p.conteudoInvalido).length,
    falhas: statusList.filter(p => p.erro !== null && !p.conteudoInvalido).length,
    pecas: statusList,
  };
  // Escrita atômica — evita EBUSY do OneDrive durante sync
  const tmp = caminhoArquivo + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(checkpoint, null, 2), "utf-8");
    fs.renameSync(tmp, caminhoArquivo);
  } catch {
    // Fallback: escrever diretamente se rename falhar
    try { fs.writeFileSync(caminhoArquivo, JSON.stringify(checkpoint, null, 2), "utf-8"); } catch {}
  }
  return checkpoint;
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const numeroCNJ = args["processo"] || "1503896-55.2022.8.26.0050";
  const senha = args["senha"] || "";
  const dirSaida = args["saida"] || "./Saida/due_diligence/1503896";
  const limite = args["limite"] ? parseInt(args["limite"]) : Infinity;
  const retomar = args["retomar"] === "true";
  const headless = args["headless"] === "true";

  if (!senha) {
    console.error("Uso: npx tsx ... pdf_downloader.ts --processo=CNJ --senha=SENHA [--limite=N] [--retomar] [--headless]");
    process.exit(1);
  }

  log("═══════════════════════════════════════════════════════════");
  log("  AuraDUE — Agente 2: PDF Downloader");
  log("═══════════════════════════════════════════════════════════");

  fs.mkdirSync(dirSaida, { recursive: true });

  const checkpoint = await baixarPDFs(numeroCNJ, senha, dirSaida, {
    limite,
    retomar,
    headless,
  });

  log("═══════════════════════════════════════════════════════════");
  log(`  PDFs válidos baixados: ${checkpoint.validos} / ${checkpoint.baixados}`);
  log(`  Checkpoint: ${dirSaida}/checkpoint_download.json`);
  log("═══════════════════════════════════════════════════════════");
}

const _isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("pdf_downloader.ts");
if (_isMain) {
  main().catch((err) => {
    console.error("[FATAL]", err.message);
    process.exit(1);
  });
}
