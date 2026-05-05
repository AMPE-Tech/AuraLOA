/**
 * extrator_texto.ts — Agente 3
 * ─────────────────────────────────────────────────────────────────────────────
 * Lê os PDFs baixados pelo Agente 2 e extrai o texto processual real.
 * Valida que o conteúdo extraído é texto jurídico (não HTML de portal).
 * Salva o texto e gera um manifesto de extração com metadados de qualidade.
 *
 * FLUXO:
 *   1. Lê checkpoint_download.json do Agente 2
 *   2. Para cada PDF válido: extrai texto com pdf-parse
 *   3. Valida o texto: detecta HTML, login page, conteúdo vazio
 *   4. Salva texto em Saida/{processo}/textos/peca_NNNNN.txt
 *   5. Gera textos_extraidos.json com metadados de qualidade de cada extração
 *
 * CRITÉRIOS DE VALIDAÇÃO DO TEXTO:
 *   - VÁLIDO:    texto tem >100 chars e não começa com "<html" / "<!DOCTYPE"
 *   - SUSPEITO:  texto tem <100 chars mas >0 chars
 *   - INVÁLIDO:  texto vazio, ou começa com HTML
 *
 * OUTPUT: Saida/{processo}/textos/peca_NNNNN.txt (um por peça)
 *         Saida/{processo}/textos_extraidos.json
 *
 * USO:
 *   npx tsx --env-file=.env server/scripts/due_diligence/extrator_texto.ts \
 *     --saida=./Saida/due_diligence/1503896
 *
 * FLAGS:
 *   --limite=N    Processar apenas os N primeiros PDFs
 *   --paginas=N   Extrair apenas as N primeiras páginas de cada PDF (padrão: todas)
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(__filename);
const pdfParse = require("pdf-parse");

// ── Tipos ──────────────────────────────────────────────────────────────────

interface DownloadStatus {
  numero: number;
  urlPDF: string;
  sha256URL: string;
  arquivoLocal: string | null;
  sha256Arquivo: string | null;
  tamanhoBytes: number | null;
  ehPDFValido: boolean;
  conteudoInvalido: boolean;
  erro: string | null;
  baixadoEm: string | null;
}

interface CheckpointDownload {
  numeroCNJ: string;
  geradoEm: string;
  totalPecas: number;
  baixados: number;
  validos: number;
  invalidos: number;
  falhas: number;
  pecas: DownloadStatus[];
}

export type QualidadeExtracao = "VALIDO" | "SUSPEITO" | "INVALIDO";

export interface TextoExtraido {
  numero: number;
  arquivoFonte: string;
  sha256Arquivo: string;        // hash do PDF — prova que lemos este arquivo
  sha256Texto: string;          // hash do texto extraído
  totalPaginas: number;
  totalCharacters: number;
  totalPalavras: number;
  qualidade: QualidadeExtracao;
  motivoInvalido: string | null;
  arquivoTexto: string | null;  // caminho do .txt salvo
  extraidoEm: string;
  primeiros500chars: string;    // amostra para auditoria visual
}

export interface ManifestoTextos {
  numeroCNJ: string;
  geradoEm: string;
  totalPecas: number;
  validos: number;
  suspeitos: number;
  invalidos: number;
  totalPalavrasValidas: number;
  sha256Manifesto: string;
  textos: TextoExtraido[];
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

function sha256Texto(texto: string): string {
  return createHash("sha256").update(texto, "utf-8").digest("hex");
}

function detectarQualidade(texto: string): { qualidade: QualidadeExtracao; motivo: string | null } {
  if (!texto || texto.trim().length === 0) {
    return { qualidade: "INVALIDO", motivo: "Texto vazio — PDF sem camada de texto ou protegido" };
  }

  const textoTrimmed = texto.trim().toLowerCase();

  // Detectar HTML
  if (
    textoTrimmed.startsWith("<!doctype") ||
    textoTrimmed.startsWith("<html") ||
    textoTrimmed.startsWith("<?xml")
  ) {
    return { qualidade: "INVALIDO", motivo: "Conteúdo é HTML, não texto processual — arquivo baixado é página de portal" };
  }

  // Detectar página de login / redirect
  if (
    textoTrimmed.includes("sajcas") ||
    textoTrimmed.includes("login") && textoTrimmed.includes("senha") && texto.trim().length < 500
  ) {
    return { qualidade: "INVALIDO", motivo: "Conteúdo parece ser página de login/autenticação" };
  }

  // Texto muito curto — suspeito mas não inválido
  if (texto.trim().length < 100) {
    return { qualidade: "SUSPEITO", motivo: `Texto muito curto (${texto.trim().length} chars) — pode ser imagem escaneada sem OCR` };
  }

  return { qualidade: "VALIDO", motivo: null };
}

// ── Agente 3: Extrator de Texto ─────────────────────────────────────────────

export async function extrairTextos(
  dirSaida: string,
  opcoes: {
    limite?: number;
    maxPaginas?: number;
    logFn?: (msg: string) => void;
  } = {}
): Promise<ManifestoTextos> {
  const {
    limite = Infinity,
    maxPaginas,
    logFn = log,
  } = opcoes;

  // Verificar checkpoint do Agente 2
  const checkpointPath = path.join(dirSaida, "checkpoint_download.json");
  if (!fs.existsSync(checkpointPath)) {
    throw new Error(`[Extrator] checkpoint_download.json não encontrado em ${dirSaida}\nExecute o Agente 2 (pdf_downloader.ts) primeiro.`);
  }

  const checkpoint: CheckpointDownload = JSON.parse(fs.readFileSync(checkpointPath, "utf-8"));
  const pecasValidas = checkpoint.pecas.filter(p => p.ehPDFValido && p.arquivoLocal);

  logFn(`[Extrator] Checkpoint carregado: ${checkpoint.validos} PDFs válidos de ${checkpoint.totalPecas} peças`);
  logFn(`[Extrator] Extraindo texto de ${Math.min(pecasValidas.length, limite === Infinity ? pecasValidas.length : limite)} PDFs...`);

  // Diretório de saída dos textos
  const dirTextos = path.join(dirSaida, "textos");
  fs.mkdirSync(dirTextos, { recursive: true });

  const textos: TextoExtraido[] = [];
  const pecasParaExtrair = pecasValidas.slice(0, limite === Infinity ? pecasValidas.length : limite);

  for (const peca of pecasParaExtrair) {
    const nomeBase = path.basename(peca.arquivoLocal!).replace(/\.pdf$/i, "");
    const caminhoTxt = path.join(dirTextos, `${nomeBase}.txt`);

    const resultado: TextoExtraido = {
      numero: peca.numero,
      arquivoFonte: peca.arquivoLocal!,
      sha256Arquivo: peca.sha256Arquivo!,
      sha256Texto: "",
      totalPaginas: 0,
      totalCharacters: 0,
      totalPalavras: 0,
      qualidade: "INVALIDO",
      motivoInvalido: null,
      arquivoTexto: null,
      extraidoEm: new Date().toISOString(),
      primeiros500chars: "",
    };

    try {
      // Verificar que o arquivo ainda existe e o SHA-256 confere
      if (!fs.existsSync(peca.arquivoLocal!)) {
        resultado.motivoInvalido = `Arquivo não encontrado: ${peca.arquivoLocal}`;
        logFn(`[Extrator] ✗ Peça ${peca.numero}: arquivo não encontrado`);
        textos.push(resultado);
        continue;
      }

      const buffer = fs.readFileSync(peca.arquivoLocal!);
      const sha256Atual = sha256Buffer(buffer);

      // REGRA DE INTEGRIDADE: SHA-256 deve conferir
      if (sha256Atual !== peca.sha256Arquivo) {
        resultado.motivoInvalido = `SHA-256 não confere — arquivo pode ter sido corrompido ou substituído`;
        logFn(`[Extrator] ✗ Peça ${peca.numero}: SHA-256 divergente — ARQUIVO COMPROMETIDO`);
        textos.push(resultado);
        continue;
      }

      // Opções de extração — limitar páginas se solicitado
      const pdfOptions: Record<string, any> = {};
      if (maxPaginas) {
        pdfOptions.max = maxPaginas;
      }

      const parsed = await pdfParse(buffer, pdfOptions);
      const texto: string = parsed.text || "";
      const totalPaginas: number = parsed.numpages || 0;

      const { qualidade, motivo } = detectarQualidade(texto);

      resultado.sha256Texto = sha256Texto(texto);
      resultado.totalPaginas = totalPaginas;
      resultado.totalCharacters = texto.length;
      resultado.totalPalavras = texto.trim().split(/\s+/).filter(Boolean).length;
      resultado.qualidade = qualidade;
      resultado.motivoInvalido = motivo;
      resultado.primeiros500chars = texto.substring(0, 500).replace(/\n+/g, " ").trim();

      if (qualidade !== "INVALIDO") {
        fs.writeFileSync(caminhoTxt, texto, "utf-8");
        resultado.arquivoTexto = caminhoTxt;
        logFn(`[Extrator] ✓ Peça ${peca.numero}: ${totalPaginas}p, ${texto.length} chars, ${resultado.totalPalavras} palavras — [${qualidade}]`);
      } else {
        logFn(`[Extrator] ✗ Peça ${peca.numero}: [INVÁLIDO] ${motivo}`);
      }

    } catch (err: any) {
      resultado.motivoInvalido = `Erro na extração: ${err.message}`;
      logFn(`[Extrator] ✗ Peça ${peca.numero}: ERRO — ${err.message}`);
    }

    textos.push(resultado);
  }

  // Montar manifesto
  const validos = textos.filter(t => t.qualidade === "VALIDO").length;
  const suspeitos = textos.filter(t => t.qualidade === "SUSPEITO").length;
  const invalidos = textos.filter(t => t.qualidade === "INVALIDO").length;
  const totalPalavras = textos.filter(t => t.qualidade === "VALIDO").reduce((acc, t) => acc + t.totalPalavras, 0);

  const sha256Manifesto = createHash("sha256")
    .update(JSON.stringify(textos))
    .digest("hex");

  const manifesto: ManifestoTextos = {
    numeroCNJ: checkpoint.numeroCNJ,
    geradoEm: new Date().toISOString(),
    totalPecas: textos.length,
    validos,
    suspeitos,
    invalidos,
    totalPalavrasValidas: totalPalavras,
    sha256Manifesto,
    textos,
  };

  const manifestoPath = path.join(dirSaida, "textos_extraidos.json");
  fs.writeFileSync(manifestoPath, JSON.stringify(manifesto, null, 2), "utf-8");

  logFn(`\n[Extrator] ════════════════════════════════`);
  logFn(`[Extrator] Válidos:   ${validos}`);
  logFn(`[Extrator] Suspeitos: ${suspeitos}`);
  logFn(`[Extrator] Inválidos: ${invalidos}`);
  logFn(`[Extrator] Total palavras extraídas: ${totalPalavras.toLocaleString("pt-BR")}`);
  logFn(`[Extrator] Manifesto: ${manifestoPath}`);

  return manifesto;
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const dirSaida = args["saida"] || "./Saida/due_diligence/1503896";
  const limite = args["limite"] ? parseInt(args["limite"]) : Infinity;
  const maxPaginas = args["paginas"] ? parseInt(args["paginas"]) : undefined;

  log("═══════════════════════════════════════════════════════════");
  log("  AuraDUE — Agente 3: Extrator de Texto");
  log("═══════════════════════════════════════════════════════════");

  const manifesto = await extrairTextos(dirSaida, { limite, maxPaginas });

  log("═══════════════════════════════════════════════════════════");
  log(`  Textos válidos: ${manifesto.validos} / ${manifesto.totalPecas}`);
  log(`  Palavras extraídas: ${manifesto.totalPalavrasValidas.toLocaleString("pt-BR")}`);
  log("═══════════════════════════════════════════════════════════");
}

const _isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("extrator_texto.ts");
if (_isMain) {
  main().catch((err) => {
    console.error("[FATAL]", err.message);
    process.exit(1);
  });
}
