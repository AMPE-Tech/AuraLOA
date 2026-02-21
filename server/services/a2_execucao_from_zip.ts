import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PassThrough } from "node:stream";
import unzipper from "unzipper";
import iconv from "iconv-lite";
import { parse } from "csv-parse";
import type { ZipEmpenhoDetalhe, ZipExecucaoByAcao, ZipExecucaoRow } from "../../shared/loa_types";

type Evidence = {
  source_name: string;
  source_url: string | null;
  captured_at_iso: string;
  raw_payload_path: string;
  raw_payload_sha256: string;
  bytes: number;
  note?: string;
};

export type ExecucaoPagoPorAcaoPoRow = {
  ano: number | null;
  codigo_acao: string;
  codigo_po: string | null;
  pago: number;
  moeda: "BRL";
};

function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function parseBRL(v: string): number {
  const s = (v ?? "").toString().trim();
  if (!s) return 0;
  const cleaned = s
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normCol(s: string): string {
  return (s ?? "")
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\w ]/g, "");
}

function getCol(r: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null) return v.trim();
  }
  return "";
}

async function extractEntryToRawAndParseCSV(params: {
  zipPath: string;
  entryNameEndsWith: string;
  rawOutPath: string;
  encoding: "latin1" | "utf8";
  delimiter: ";" | ",";
  onRecord: (row: Record<string, string>) => void | Promise<void>;
}): Promise<{ bytes: number; found: boolean }> {
  const zipStream = fs.createReadStream(params.zipPath).pipe(unzipper.Parse({ forceStream: true }));

  for await (const entry of zipStream as any) {
    const fileName: string = entry.path;
    const type: string = entry.type;

    if (type !== "File") {
      entry.autodrain();
      continue;
    }

    if (!fileName.endsWith(params.entryNameEndsWith)) {
      entry.autodrain();
      continue;
    }

    ensureDir(path.dirname(params.rawOutPath));
    const out = fs.createWriteStream(params.rawOutPath);

    const tee = new PassThrough();
    let bytes = 0;

    entry.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
    });

    entry.pipe(tee);

    tee.pipe(out);

    const decoder = params.encoding === "latin1" ? iconv.decodeStream("latin1") : iconv.decodeStream("utf8");
    const parser = parse({
      delimiter: params.delimiter,
      columns: (header: string[]) => header.map(normCol),
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });

    const parsePromise = new Promise<void>((resolve, reject) => {
      parser.on("readable", async () => {
        try {
          let record;
          while ((record = parser.read())) {
            await params.onRecord(record);
          }
        } catch (e) {
          reject(e);
        }
      });
      parser.on("error", reject);
      parser.on("end", resolve);
    });

    tee.pipe(decoder).pipe(parser);
    await parsePromise;

    await new Promise<void>((resolve) => out.on("finish", resolve));
    out.end();

    return { bytes, found: true };
  }

  return { bytes: 0, found: false };
}

export async function computeExecucaoPagoPorAcaoPoFromZip(params: {
  processId: string;
  zipPath: string;
  evidenceBaseDir?: string;
  sourceUrlZip?: string | null;
  ano?: number | null;
}) {
  const evidenceBaseDir = params.evidenceBaseDir ?? path.join(".", "Saida", "evidence");
  const captured_at_iso = new Date().toISOString();

  const evRawDir = path.join(evidenceBaseDir, params.processId, "raw");
  ensureDir(evRawDir);

  if (!fs.existsSync(params.zipPath)) {
    throw new Error(`[A2] zipPath nao existe: ${params.zipPath}`);
  }
  const zipSha = sha256File(params.zipPath);
  const zipBytes = fs.statSync(params.zipPath).size;

  const evidences: Evidence[] = [
    {
      source_name: "PortalTransparencia.DespostasZip.Raw",
      source_url: params.sourceUrlZip ?? null,
      captured_at_iso,
      raw_payload_path: params.zipPath,
      raw_payload_sha256: zipSha,
      bytes: zipBytes,
      note: "ZIP bruto usado como fonte primaria para execucao (anti-alucinacao).",
    },
  ];

  const pagoByEmpenho = new Map<string, number>();
  const liquidadoByEmpenho = new Map<string, number>();

  const rawPagamentoImpactados = path.join(evRawDir, path.basename(params.zipPath).replace(".zip", "_Pagamento_EmpenhosImpactados.csv"));
  const pagamentoImpactadosResult = await extractEntryToRawAndParseCSV({
    zipPath: params.zipPath,
    entryNameEndsWith: "_Despesas_Pagamento_EmpenhosImpactados.csv",
    rawOutPath: rawPagamentoImpactados,
    encoding: "latin1",
    delimiter: ";",
    onRecord: (r) => {
      const codEmp = getCol(r, "codigo empenho");
      if (!codEmp) return;
      const valorPago = parseBRL(getCol(r, "valor pago r", "valor pago"));
      const prev = pagoByEmpenho.get(codEmp) ?? 0;
      pagoByEmpenho.set(codEmp, prev + valorPago);
    },
  });

  if (pagamentoImpactadosResult.found) {
    evidences.push({
      source_name: "PortalTransparencia.DespostasZip.PagamentoEmpenhosImpactados",
      source_url: params.sourceUrlZip ?? null,
      captured_at_iso,
      raw_payload_path: rawPagamentoImpactados,
      raw_payload_sha256: sha256File(rawPagamentoImpactados),
      bytes: pagamentoImpactadosResult.bytes,
      note: "Usado para obter Valor Pago por Codigo Empenho (join).",
    });
  }

  const rawLiquidacaoImpactados = path.join(evRawDir, path.basename(params.zipPath).replace(".zip", "_Liquidacao_EmpenhosImpactados.csv"));
  let totalLiquidacoes = 0;
  const liquidacaoResult = await extractEntryToRawAndParseCSV({
    zipPath: params.zipPath,
    entryNameEndsWith: "_Despesas_Liquidacao_EmpenhosImpactados.csv",
    rawOutPath: rawLiquidacaoImpactados,
    encoding: "latin1",
    delimiter: ";",
    onRecord: (r) => {
      totalLiquidacoes++;
      const codEmp = getCol(r, "codigo empenho");
      if (!codEmp) return;
      const valorLiq = parseBRL(getCol(r, "valor liquidado r", "valor liquidado"));
      const prev = liquidadoByEmpenho.get(codEmp) ?? 0;
      liquidadoByEmpenho.set(codEmp, prev + valorLiq);
    },
  });

  if (liquidacaoResult.found) {
    evidences.push({
      source_name: "PortalTransparencia.DespostasZip.LiquidacaoEmpenhosImpactados",
      source_url: params.sourceUrlZip ?? null,
      captured_at_iso,
      raw_payload_path: rawLiquidacaoImpactados,
      raw_payload_sha256: sha256File(rawLiquidacaoImpactados),
      bytes: liquidacaoResult.bytes,
      note: "Usado para obter Valor Liquidado por Codigo Empenho (join).",
    });
  }

  const pagoPorAcaoPo = new Map<string, number>();
  const empenhosDetalhe: ZipEmpenhoDetalhe[] = [];
  let totalEmpenhos = 0;

  const rawEmpenho = path.join(evRawDir, path.basename(params.zipPath).replace(".zip", "_Empenho.csv"));
  const empenhoResult = await extractEntryToRawAndParseCSV({
    zipPath: params.zipPath,
    entryNameEndsWith: "_Despesas_Empenho.csv",
    rawOutPath: rawEmpenho,
    encoding: "latin1",
    delimiter: ";",
    onRecord: (r) => {
      totalEmpenhos++;
      const codEmp = getCol(r, "codigo empenho");
      if (!codEmp) return;

      const acao = getCol(r, "codigo acao");
      const po = getCol(r, "codigo plano orcamentario") || null;
      const valorEmpenho = parseBRL(getCol(r, "valor original do empenho", "valor do empenho convertido pra r"));
      const pago = pagoByEmpenho.get(codEmp) ?? 0;
      const liquidado = liquidadoByEmpenho.get(codEmp) ?? 0;

      empenhosDetalhe.push({
        codigo_empenho: codEmp,
        data_emissao: getCol(r, "data emissao"),
        codigo_orgao_superior: getCol(r, "codigo orgao superior"),
        orgao_superior: getCol(r, "orgao superior"),
        codigo_orgao: getCol(r, "codigo orgao"),
        orgao: getCol(r, "orgao"),
        codigo_ug: getCol(r, "codigo unidade gestora"),
        unidade_gestora: getCol(r, "unidade gestora"),
        codigo_favorecido: getCol(r, "codigo favorecido"),
        favorecido: getCol(r, "favorecido"),
        codigo_acao: acao,
        acao: getCol(r, "acao"),
        codigo_po: po,
        plano_orcamentario: getCol(r, "plano orcamentario") || null,
        codigo_programa: getCol(r, "codigo programa"),
        programa: getCol(r, "programa"),
        codigo_subfuncao: getCol(r, "codigo subfuncao"),
        subfuncao: getCol(r, "subfuncao"),
        codigo_subtitulo: getCol(r, "codigo subtitulo localizador"),
        subtitulo: getCol(r, "subtitulo localizador"),
        processo: getCol(r, "processo"),
        valor_empenho: valorEmpenho,
        valor_pago: pago,
        valor_liquidado: liquidado,
      });

      if (pago > 0 && acao) {
        const key = `${acao}||${po ?? ""}`;
        pagoPorAcaoPo.set(key, (pagoPorAcaoPo.get(key) ?? 0) + pago);
      }
    },
  });

  if (empenhoResult.found) {
    evidences.push({
      source_name: "PortalTransparencia.DespostasZip.Empenho",
      source_url: params.sourceUrlZip ?? null,
      captured_at_iso,
      raw_payload_path: rawEmpenho,
      raw_payload_sha256: sha256File(rawEmpenho),
      bytes: empenhoResult.bytes,
      note: "Tabela mestre que contem Codigo Acao + Codigo PO por Codigo Empenho.",
    });
  }

  const rows: ExecucaoPagoPorAcaoPoRow[] = [];
  for (const [key, pago] of Array.from(pagoPorAcaoPo.entries())) {
    const [acao, po] = key.split("||");
    rows.push({
      ano: params.ano ?? null,
      codigo_acao: acao,
      codigo_po: po ? po : null,
      pago,
      moeda: "BRL",
    });
  }

  rows.sort((a, b) => {
    if (a.codigo_acao !== b.codigo_acao) return a.codigo_acao.localeCompare(b.codigo_acao);
    return (a.codigo_po ?? "").localeCompare(b.codigo_po ?? "");
  });

  const execucaoPorAcao = buildExecucaoPorAcao(empenhosDetalhe);

  return {
    result: {
      pago_por_acao_po: rows,
      empenhos_detalhe: empenhosDetalhe,
      execucao_por_acao: execucaoPorAcao,
      stats: {
        empenhos_com_pagamento: pagoByEmpenho.size,
        chaves_acao_po: rows.length,
        total_empenhos_zip: totalEmpenhos,
        total_liquidacoes_zip: totalLiquidacoes,
      },
    },
    evidences,
  };
}

function buildExecucaoPorAcao(empenhos: ZipEmpenhoDetalhe[]): ZipExecucaoByAcao[] {
  const byAcao = new Map<string, {
    descricao: string;
    empenhado: number;
    liquidado: number;
    pago: number;
    qtd: number;
    poMap: Map<string, { pago: number; empenhado: number; liquidado: number }>;
  }>();

  for (const emp of empenhos) {
    const acao = emp.codigo_acao;
    if (!acao) continue;

    let entry = byAcao.get(acao);
    if (!entry) {
      entry = {
        descricao: emp.acao || acao,
        empenhado: 0,
        liquidado: 0,
        pago: 0,
        qtd: 0,
        poMap: new Map(),
      };
      byAcao.set(acao, entry);
    }

    entry.empenhado += emp.valor_empenho;
    entry.liquidado += emp.valor_liquidado;
    entry.pago += emp.valor_pago;
    entry.qtd++;

    const poKey = emp.codigo_po ?? "-";
    let poEntry = entry.poMap.get(poKey);
    if (!poEntry) {
      poEntry = { pago: 0, empenhado: 0, liquidado: 0 };
      entry.poMap.set(poKey, poEntry);
    }
    poEntry.pago += emp.valor_pago;
    poEntry.empenhado += emp.valor_empenho;
    poEntry.liquidado += emp.valor_liquidado;
  }

  const result: ZipExecucaoByAcao[] = [];
  for (const [codigo, entry] of Array.from(byAcao.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    result.push({
      codigo_acao: codigo,
      descricao_acao: entry.descricao,
      total_empenhado: entry.empenhado,
      total_liquidado: entry.liquidado,
      total_pago: entry.pago,
      qtd_empenhos: entry.qtd,
      planos_orcamentarios: Array.from(entry.poMap.entries()).map(([po, v]) => ({
        codigo_po: po,
        pago: v.pago,
        empenhado: v.empenhado,
        liquidado: v.liquidado,
      })),
    });
  }

  return result;
}
