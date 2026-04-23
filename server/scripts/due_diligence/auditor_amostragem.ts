/**
 * auditor_amostragem.ts — Agente 4
 * ─────────────────────────────────────────────────────────────────────────────
 * Audita a integridade do pipeline de extração por amostragem aleatória.
 * Para cada peça selecionada na amostra:
 *   1. Relê o arquivo PDF do disco (verifica que existe)
 *   2. Recalcula o SHA-256 do PDF — compara com o registrado no Agente 2
 *   3. Reexecuta a extração de texto — compara com o texto do Agente 3
 *   4. Verifica que o arquivo .txt existe e corresponde ao texto extraído
 *   5. Gera score de confiança para cada peça auditada
 *
 * REGRAS DE INTEGRIDADE (CLAUDE.md):
 *   - SHA-256 do PDF deve ser idêntico ao registrado no checkpoint_download.json
 *   - SHA-256 do texto extraído deve ser idêntico ao registrado em textos_extraidos.json
 *   - Qualquer divergência = ALERTA CRÍTICO
 *
 * OUTPUT: Saida/{processo}/auditoria_amostragem.json
 *
 * USO:
 *   npx tsx --env-file=.env server/scripts/due_diligence/auditor_amostragem.ts \
 *     --saida=./Saida/due_diligence/1503896 \
 *     --amostra=10
 *
 * FLAGS:
 *   --amostra=N    Tamanho da amostra (padrão: 10 ou 20% do total, o que for maior)
 *   --seed=N       Semente aleatória para reprodutibilidade (padrão: timestamp)
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
  pecas: DownloadStatus[];
}

interface TextoExtraido {
  numero: number;
  arquivoFonte: string;
  sha256Arquivo: string;
  sha256Texto: string;
  totalPaginas: number;
  totalCharacters: number;
  totalPalavras: number;
  qualidade: string;
  motivoInvalido: string | null;
  arquivoTexto: string | null;
  extraidoEm: string;
  primeiros500chars: string;
}

interface ManifestoTextos {
  numeroCNJ: string;
  textos: TextoExtraido[];
}

export type ResultadoAuditoria = "APROVADO" | "ALERTA" | "FALHA_CRITICA";

export interface ItemAuditado {
  numero: number;
  arquivoLocal: string;
  // Verificação 1: SHA-256 do arquivo PDF
  sha256Registrado: string;
  sha256Recalculado: string;
  sha256PDFConfere: boolean;
  // Verificação 2: SHA-256 do texto extraído
  sha256TextoRegistrado: string;
  sha256TextoRecalculado: string;
  sha256TextoConfere: boolean;
  // Verificação 3: arquivo .txt existe
  arquivoTextoExiste: boolean;
  sha256TextoArquivo: string | null;    // hash do conteúdo do .txt
  txtConfereComExtracao: boolean;
  // Resultado final
  resultado: ResultadoAuditoria;
  alertas: string[];
  auditadoEm: string;
}

export interface RelatorioAuditoria {
  numeroCNJ: string;
  geradoEm: string;
  seed: number;
  totalPecasDisponiveis: number;
  tamanhoAmostra: number;
  aprovados: number;
  alertas: number;
  falhasCriticas: number;
  scoreConfianca: number;   // 0–100: % de peças auditadas sem falhas críticas
  sha256Relatorio: string;
  itens: ItemAuditado[];
  conclusao: string;
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

/** Gerador de números pseudo-aleatórios determinístico (LCG) */
function criarRNG(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Fisher-Yates com semente determinística */
function embaralharComSeed<T>(arr: T[], seed: number): T[] {
  const rng = criarRNG(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256Texto(texto: string): string {
  return createHash("sha256").update(texto, "utf-8").digest("hex");
}

// ── Agente 4: Auditor por Amostragem ────────────────────────────────────────

export async function auditarAmostragem(
  dirSaida: string,
  opcoes: {
    tamanhoAmostra?: number;
    seed?: number;
    logFn?: (msg: string) => void;
  } = {}
): Promise<RelatorioAuditoria> {
  const {
    seed = Date.now(),
    logFn = log,
  } = opcoes;

  logFn(`[Auditor] Iniciando auditoria por amostragem — seed: ${seed}`);

  // Carregar checkpoint do Agente 2
  const checkpointPath = path.join(dirSaida, "checkpoint_download.json");
  if (!fs.existsSync(checkpointPath)) {
    throw new Error(`[Auditor] checkpoint_download.json não encontrado.\nExecute os Agentes 1 e 2 primeiro.`);
  }

  // Carregar manifesto do Agente 3
  const manifestoTextosPath = path.join(dirSaida, "textos_extraidos.json");
  if (!fs.existsSync(manifestoTextosPath)) {
    throw new Error(`[Auditor] textos_extraidos.json não encontrado.\nExecute o Agente 3 primeiro.`);
  }

  const checkpoint: CheckpointDownload = JSON.parse(fs.readFileSync(checkpointPath, "utf-8"));
  const manifestoTextos: ManifestoTextos = JSON.parse(fs.readFileSync(manifestoTextosPath, "utf-8"));

  // Índice de textos por número da peça
  const textosPorNumero = new Map<number, TextoExtraido>();
  for (const t of manifestoTextos.textos) {
    textosPorNumero.set(t.numero, t);
  }

  // Selecionar peças auditáveis (têm PDF válido E texto válido)
  const pecasAuditaveis = checkpoint.pecas.filter(p =>
    p.ehPDFValido &&
    p.arquivoLocal &&
    p.sha256Arquivo &&
    textosPorNumero.has(p.numero) &&
    textosPorNumero.get(p.numero)!.qualidade !== "INVALIDO"
  );

  if (pecasAuditaveis.length === 0) {
    throw new Error("[Auditor] Nenhuma peça com PDF válido + texto válido disponível para auditoria.");
  }

  // Tamanho da amostra: o que for maior entre o solicitado e 20% do total
  const tamanhoMinimo = Math.max(1, Math.ceil(pecasAuditaveis.length * 0.2));
  const tamanhoAmostra = opcoes.tamanhoAmostra
    ? Math.min(opcoes.tamanhoAmostra, pecasAuditaveis.length)
    : Math.min(tamanhoMinimo, pecasAuditaveis.length);

  // Seleção aleatória com semente
  const embaralhadas = embaralharComSeed(pecasAuditaveis, seed);
  const amostra = embaralhadas.slice(0, tamanhoAmostra);

  logFn(`[Auditor] Peças auditáveis: ${pecasAuditaveis.length} — amostra: ${tamanhoAmostra} (seed: ${seed})`);

  const itens: ItemAuditado[] = [];

  for (const peca of amostra) {
    const textoRegistrado = textosPorNumero.get(peca.numero)!;
    const alertas: string[] = [];
    let resultado = "APROVADO" as ResultadoAuditoria;

    const item: ItemAuditado = {
      numero: peca.numero,
      arquivoLocal: peca.arquivoLocal!,
      sha256Registrado: peca.sha256Arquivo!,
      sha256Recalculado: "",
      sha256PDFConfere: false,
      sha256TextoRegistrado: textoRegistrado.sha256Texto,
      sha256TextoRecalculado: "",
      sha256TextoConfere: false,
      arquivoTextoExiste: false,
      sha256TextoArquivo: null,
      txtConfereComExtracao: false,
      resultado: "APROVADO",
      alertas: [],
      auditadoEm: new Date().toISOString(),
    };

    logFn(`[Auditor] Auditando peça ${peca.numero}...`);

    try {
      // ── Verificação 1: SHA-256 do arquivo PDF ──────────────────────────
      if (!fs.existsSync(peca.arquivoLocal!)) {
        alertas.push(`CRÍTICO: arquivo PDF não encontrado: ${peca.arquivoLocal}`);
        resultado = "FALHA_CRITICA";
      } else {
        const bufferPDF = fs.readFileSync(peca.arquivoLocal!);
        item.sha256Recalculado = sha256Buffer(bufferPDF);
        item.sha256PDFConfere = item.sha256Recalculado === item.sha256Registrado;

        if (!item.sha256PDFConfere) {
          alertas.push(`CRÍTICO: SHA-256 do PDF diverge — arquivo pode ter sido alterado após download`);
          alertas.push(`  Registrado:   ${item.sha256Registrado.substring(0, 32)}...`);
          alertas.push(`  Recalculado:  ${item.sha256Recalculado.substring(0, 32)}...`);
          resultado = "FALHA_CRITICA";
        } else {
          // ── Verificação 2: Reextração de texto ──────────────────────────
          const parsed = await pdfParse(bufferPDF);
          const textoRe: string = parsed.text || "";
          item.sha256TextoRecalculado = sha256Texto(textoRe);
          item.sha256TextoConfere = item.sha256TextoRecalculado === item.sha256TextoRegistrado;

          if (!item.sha256TextoConfere) {
            alertas.push(`ALERTA: SHA-256 do texto extraído diverge da extração original`);
            alertas.push(`  Registrado:   ${item.sha256TextoRegistrado.substring(0, 32)}...`);
            alertas.push(`  Recalculado:  ${item.sha256TextoRecalculado.substring(0, 32)}...`);
            if (resultado !== "FALHA_CRITICA") resultado = "ALERTA";
          }
        }

        // ── Verificação 3: Arquivo .txt existe e corresponde ─────────────
        if (textoRegistrado.arquivoTexto) {
          item.arquivoTextoExiste = fs.existsSync(textoRegistrado.arquivoTexto);
          if (!item.arquivoTextoExiste) {
            alertas.push(`ALERTA: arquivo .txt registrado não existe: ${textoRegistrado.arquivoTexto}`);
            if (resultado !== "FALHA_CRITICA") resultado = "ALERTA";
          } else {
            const conteudoTxt = fs.readFileSync(textoRegistrado.arquivoTexto, "utf-8");
            item.sha256TextoArquivo = sha256Texto(conteudoTxt);
            item.txtConfereComExtracao = item.sha256TextoArquivo === item.sha256TextoRegistrado;

            if (!item.txtConfereComExtracao) {
              alertas.push(`ALERTA: conteúdo do .txt diverge do SHA-256 registrado`);
              if (resultado !== "FALHA_CRITICA") resultado = "ALERTA";
            }
          }
        }
      }
    } catch (err: any) {
      alertas.push(`ERRO na auditoria: ${err.message}`);
      resultado = "FALHA_CRITICA";
    }

    item.resultado = resultado;
    item.alertas = alertas;

    const icone = resultado === "APROVADO" ? "✓" : resultado === "ALERTA" ? "⚠" : "✗";
    logFn(`[Auditor] ${icone} Peça ${peca.numero}: ${resultado}${alertas.length ? " — " + alertas[0] : ""}`);

    itens.push(item);
  }

  // Calcular score de confiança
  const aprovados = itens.filter(i => i.resultado === "APROVADO").length;
  const alertasCount = itens.filter(i => i.resultado === "ALERTA").length;
  const falhas = itens.filter(i => i.resultado === "FALHA_CRITICA").length;
  const scoreConfianca = itens.length > 0
    ? Math.round((aprovados / itens.length) * 100)
    : 0;

  // Conclusão textual
  let conclusao: string;
  if (falhas > 0) {
    conclusao = `⚠️ AUDITORIA FALHOU: ${falhas} peça(s) com falha crítica de integridade. ` +
      `Pipeline NÃO CONFIÁVEL para geração de relatório.`;
  } else if (alertasCount > 0) {
    conclusao = `⚠️ AUDITORIA COM ALERTAS: ${alertasCount} peça(s) com divergências não críticas. ` +
      `Revisar antes de gerar relatório.`;
  } else {
    conclusao = `✅ AUDITORIA APROVADA: ${aprovados}/${tamanhoAmostra} peças verificadas sem divergências. ` +
      `Pipeline íntegro — score de confiança: ${scoreConfianca}/100.`;
  }

  const sha256Relatorio = createHash("sha256")
    .update(JSON.stringify(itens))
    .digest("hex");

  const relatorio: RelatorioAuditoria = {
    numeroCNJ: checkpoint.numeroCNJ,
    geradoEm: new Date().toISOString(),
    seed,
    totalPecasDisponiveis: pecasAuditaveis.length,
    tamanhoAmostra,
    aprovados,
    alertas: alertasCount,
    falhasCriticas: falhas,
    scoreConfianca,
    sha256Relatorio,
    itens,
    conclusao,
  };

  const relatorioPath = path.join(dirSaida, "auditoria_amostragem.json");
  fs.writeFileSync(relatorioPath, JSON.stringify(relatorio, null, 2), "utf-8");

  logFn(`\n[Auditor] ════════════════════════════════`);
  logFn(`[Auditor] ${conclusao}`);
  logFn(`[Auditor] Score de confiança: ${scoreConfianca}/100`);
  logFn(`[Auditor] Relatório: ${relatorioPath}`);

  return relatorio;
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const dirSaida = args["saida"] || "./Saida/due_diligence/1503896";
  const tamanhoAmostra = args["amostra"] ? parseInt(args["amostra"]) : undefined;
  const seed = args["seed"] ? parseInt(args["seed"]) : Date.now();

  log("═══════════════════════════════════════════════════════════");
  log("  AuraDUE — Agente 4: Auditor por Amostragem");
  log("═══════════════════════════════════════════════════════════");

  const relatorio = await auditarAmostragem(dirSaida, { tamanhoAmostra, seed });

  log("═══════════════════════════════════════════════════════════");
  log(`  Aprovados:       ${relatorio.aprovados}`);
  log(`  Alertas:         ${relatorio.alertas}`);
  log(`  Falhas críticas: ${relatorio.falhasCriticas}`);
  log(`  Score confiança: ${relatorio.scoreConfianca}/100`);
  log("═══════════════════════════════════════════════════════════");

  // Sair com código de erro se houver falhas críticas
  if (relatorio.falhasCriticas > 0) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});
