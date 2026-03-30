/**
 * documento_downloader.ts
 * Download em lote de todas as peças processuais do eSAJ TJSP.
 * Suporta checkpoint — retoma de onde parou se interrompido.
 * Cada PDF baixado é registrado com SHA-256 para cadeia de custódia.
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import type { BrowserContext } from "playwright";
import type { PecaProcessual, ProcessoMetadata } from "./tjsp_auth.js";

export interface DocumentoBaixado {
  numero: number;
  descricao: string;
  tipoDocumento: string;
  dataJuntada: string | null;
  arquivoLocal: string;
  sha256: string;
  bytes: number;
  paginasDetectadas: number | null;
  downloadedAt: string;
  urlOrigem: string | null;
  erro: string | null;
}

export interface CheckpointData {
  numeroCNJ: string;
  totalPecas: number;
  baixados: number;
  erros: number;
  documentos: DocumentoBaixado[];
  iniciadoEm: string;
  atualizadoEm: string;
}

const DELAY_ENTRE_DOWNLOADS_MS = 800; // respeitar o portal
const MAX_TENTATIVAS = 3;
const TIMEOUT_DOWNLOAD_MS = 60000;

function checkpointPath(dirSaida: string): string {
  return path.join(dirSaida, "checkpoint.json");
}

export function carregarCheckpoint(dirSaida: string): CheckpointData | null {
  const cpPath = checkpointPath(dirSaida);
  if (!fs.existsSync(cpPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cpPath, "utf-8")) as CheckpointData;
  } catch {
    return null;
  }
}

function salvarCheckpoint(dirSaida: string, data: CheckpointData): void {
  data.atualizadoEm = new Date().toISOString();
  fs.writeFileSync(checkpointPath(dirSaida), JSON.stringify(data, null, 2), "utf-8");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectarPaginas(buffer: Buffer): number | null {
  // Contagem simples de objetos de página no PDF (heurística)
  const texto = buffer.toString("latin1");
  const matches = texto.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : null;
}

export async function downloadarDocumentos(
  context: BrowserContext,
  metadata: ProcessoMetadata,
  dirSaida: string,
  logFn: (msg: string) => void = console.log,
  onProgresso?: (atual: number, total: number, doc: DocumentoBaixado) => void,
): Promise<CheckpointData> {
  fs.mkdirSync(dirSaida, { recursive: true });
  const dirPDFs = path.join(dirSaida, "pecas");
  fs.mkdirSync(dirPDFs, { recursive: true });

  // Carregar checkpoint existente
  let checkpoint = carregarCheckpoint(dirSaida);
  const jasBaixados = new Set<number>(
    checkpoint?.documentos.filter((d) => !d.erro).map((d) => d.numero) || [],
  );

  if (!checkpoint) {
    checkpoint = {
      numeroCNJ: metadata.numeroCNJ,
      totalPecas: metadata.totalPecas,
      baixados: 0,
      erros: 0,
      documentos: [],
      iniciadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    logFn(`[Downloader] Iniciando download de ${metadata.totalPecas} peças — sem checkpoint anterior`);
  } else {
    logFn(`[Downloader] Retomando checkpoint: ${checkpoint.baixados} já baixados, ${checkpoint.erros} erros`);
  }

  const pecasPendentes = metadata.pecas.filter((p) => !jasBaixados.has(p.numero));
  logFn(`[Downloader] ${pecasPendentes.length} peças para baixar nesta sessão`);

  for (const peca of pecasPendentes) {
    if (!peca.urlDownload) {
      const docErro: DocumentoBaixado = {
        numero: peca.numero,
        descricao: peca.descricao,
        tipoDocumento: peca.tipoDocumento,
        dataJuntada: peca.dataJuntada,
        arquivoLocal: "",
        sha256: "",
        bytes: 0,
        paginasDetectadas: null,
        downloadedAt: new Date().toISOString(),
        urlOrigem: null,
        erro: "URL de download não disponível para esta peça",
      };
      checkpoint.documentos.push(docErro);
      checkpoint.erros++;
      salvarCheckpoint(dirSaida, checkpoint);
      continue;
    }

    let tentativa = 0;
    let sucesso = false;

    while (tentativa < MAX_TENTATIVAS && !sucesso) {
      tentativa++;
      try {
        logFn(`[Downloader] Baixando peça ${peca.numero}/${metadata.totalPecas}: ${peca.descricao.substring(0, 60)} (tentativa ${tentativa})`);

        // Usar nova aba para download
        const novaAba = await context.newPage();

        const [download] = await Promise.all([
          novaAba.waitForEvent("download", { timeout: TIMEOUT_DOWNLOAD_MS }).catch(() => null),
          novaAba.goto(peca.urlDownload, { waitUntil: "commit", timeout: TIMEOUT_DOWNLOAD_MS }),
        ]);

        let buffer: Buffer | null = null;

        if (download) {
          // Download automático disparado
          const tmpPath = await download.path();
          if (tmpPath) {
            buffer = fs.readFileSync(tmpPath);
          }
        } else {
          // Tentar obter conteúdo da resposta diretamente
          const response = await novaAba.goto(peca.urlDownload, {
            waitUntil: "networkidle",
            timeout: TIMEOUT_DOWNLOAD_MS,
          });
          if (response && response.ok()) {
            const body = await response.body().catch(() => null);
            if (body) buffer = Buffer.from(body);
          }
        }

        await novaAba.close();

        if (!buffer || buffer.length < 100) {
          throw new Error("Arquivo baixado vazio ou inválido");
        }

        // Salvar arquivo
        const nomeArquivo = `peca_${String(peca.numero).padStart(5, "0")}_${peca.tipoDocumento.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`;
        const caminhoLocal = path.join(dirPDFs, nomeArquivo);
        fs.writeFileSync(caminhoLocal, buffer);

        const sha256 = createHash("sha256").update(buffer).digest("hex");
        const paginas = detectarPaginas(buffer);

        const doc: DocumentoBaixado = {
          numero: peca.numero,
          descricao: peca.descricao,
          tipoDocumento: peca.tipoDocumento,
          dataJuntada: peca.dataJuntada,
          arquivoLocal: caminhoLocal,
          sha256,
          bytes: buffer.length,
          paginasDetectadas: paginas,
          downloadedAt: new Date().toISOString(),
          urlOrigem: peca.urlDownload,
          erro: null,
        };

        checkpoint.documentos.push(doc);
        checkpoint.baixados++;
        salvarCheckpoint(dirSaida, checkpoint);

        if (onProgresso) {
          onProgresso(checkpoint.baixados, metadata.totalPecas, doc);
        }

        logFn(`[Downloader] ✓ Peça ${peca.numero}: ${(buffer.length / 1024).toFixed(1)}KB | ${paginas ?? "?"} páginas | SHA-256: ${sha256.substring(0, 16)}...`);
        sucesso = true;

      } catch (err: any) {
        logFn(`[Downloader] ✗ Peça ${peca.numero} tentativa ${tentativa}: ${err.message}`);
        if (tentativa >= MAX_TENTATIVAS) {
          const docErro: DocumentoBaixado = {
            numero: peca.numero,
            descricao: peca.descricao,
            tipoDocumento: peca.tipoDocumento,
            dataJuntada: peca.dataJuntada,
            arquivoLocal: "",
            sha256: "",
            bytes: 0,
            paginasDetectadas: null,
            downloadedAt: new Date().toISOString(),
            urlOrigem: peca.urlDownload,
            erro: err.message,
          };
          checkpoint.documentos.push(docErro);
          checkpoint.erros++;
          salvarCheckpoint(dirSaida, checkpoint);
        }
      }

      if (!sucesso && tentativa < MAX_TENTATIVAS) {
        await sleep(DELAY_ENTRE_DOWNLOADS_MS * tentativa * 2);
      }
    }

    await sleep(DELAY_ENTRE_DOWNLOADS_MS);
  }

  // Sumário final
  logFn(`\n[Downloader] ═══════════════════════════════════`);
  logFn(`[Downloader] Download concluído:`);
  logFn(`[Downloader]   Total peças:    ${metadata.totalPecas}`);
  logFn(`[Downloader]   Baixados OK:    ${checkpoint.baixados}`);
  logFn(`[Downloader]   Erros:          ${checkpoint.erros}`);
  logFn(`[Downloader]   Total páginas:  ${checkpoint.documentos.reduce((s, d) => s + (d.paginasDetectadas || 0), 0)}`);
  logFn(`[Downloader] ═══════════════════════════════════\n`);

  return checkpoint;
}

export function inventarioCSV(checkpoint: CheckpointData, dirSaida: string): string {
  const linhas = [
    "numero,descricao,tipo,data_juntada,paginas,bytes,sha256,status,erro",
    ...checkpoint.documentos.map((d) =>
      [
        d.numero,
        `"${d.descricao.replace(/"/g, "'")}"`,
        d.tipoDocumento,
        d.dataJuntada || "",
        d.paginasDetectadas || "",
        d.bytes,
        d.sha256,
        d.erro ? "ERRO" : "OK",
        d.erro ? `"${d.erro.replace(/"/g, "'")}"` : "",
      ].join(","),
    ),
  ].join("\n");

  const csvPath = path.join(dirSaida, "inventario_documentos.csv");
  fs.writeFileSync(csvPath, linhas, "utf-8");
  return csvPath;
}
