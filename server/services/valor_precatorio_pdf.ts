import * as fs from "fs";
import * as path from "path";
import { EvidencePack, computeSHA256 } from "./evidence_pack";

export interface PrecatorioValorEntry {
  numero_precatorio: string;
  valor: number;
  preferencia: string;
  ordem: number;
  tipo: "ALIMENTAR" | "COMUM" | "DESCONHECIDO";
}

export interface PrecatorioValorIndex {
  entries: PrecatorioValorEntry[];
  by_numero: Map<string, PrecatorioValorEntry>;
  tribunal: string;
  ano_orcamento: number;
  fonte_url: string;
  sha256: string;
  total_entries: number;
}

const CACHE_DIR = path.resolve("./Saida/cache/pdf_valores");

const TRIBUNAL_PDF_URLS: Record<string, { url: string; tribunal: string }[]> = {
  trf6: [
    {
      url: "https://portal.trf6.jus.br/wp-content/uploads/2024/05/precatorios-federias-trf6-orcamento-2025.pdf",
      tribunal: "TRF6",
    },
  ],
};

function parseBRLValue(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function extractEntriesFromText(text: string): PrecatorioValorEntry[] {
  const entries: PrecatorioValorEntry[] = [];
  let currentTipo: "ALIMENTAR" | "COMUM" | "DESCONHECIDO" = "DESCONHECIDO";

  if (text.includes("ALIMENTAR")) currentTipo = "ALIMENTAR";

  const pattern = /(\d+)\s+(\d{15,20})\s+([\d.,]+)\s+(IDOSO|NÃO|NAO|PESSOA COM DEFICIÊNCIA|DOENÇA GRAVE|SIM|N[AÃ]O)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const ordem = parseInt(match[1], 10);
    const numeroPrecatorio = match[2].trim();
    const valorStr = match[3];
    const preferencia = match[4].trim().toUpperCase();

    const valor = parseBRLValue(valorStr);
    if (valor === null) continue;

    entries.push({
      numero_precatorio: numeroPrecatorio,
      valor,
      preferencia,
      ordem,
      tipo: currentTipo,
    });
  }

  return entries;
}

async function parsePDFBuffer(buffer: Buffer): Promise<string> {
  const pdfjsPath = "pdfjs-dist/legacy/build/pdf.mjs";
  const pdfjsLib = await import(pdfjsPath);

  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const numPages = doc.numPages;

  const pages: string[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(" ");
    pages.push(pageText);
  }

  return pages.join("\n");
}

export async function downloadAndParseTribunalPDF(
  tribunalAlias: string,
  anoOrcamento: number,
  evidencePack: EvidencePack,
): Promise<PrecatorioValorIndex | null> {
  const configs = TRIBUNAL_PDF_URLS[tribunalAlias];
  if (!configs || configs.length === 0) {
    evidencePack.log(`ValorPDF: no PDF configured for ${tribunalAlias}`);
    return null;
  }

  const config = configs[0];
  const cacheFile = path.join(CACHE_DIR, `${tribunalAlias}_${anoOrcamento}_valores.json`);

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      if (cached.entries && cached.entries.length > 0) {
        evidencePack.log(`ValorPDF: using cache for ${tribunalAlias} (${cached.entries.length} entries)`);

        const byNumero = new Map<string, PrecatorioValorEntry>();
        for (const e of cached.entries) {
          byNumero.set(e.numero_precatorio, e);
        }

        return {
          entries: cached.entries,
          by_numero: byNumero,
          tribunal: config.tribunal,
          ano_orcamento: anoOrcamento,
          fonte_url: config.url,
          sha256: cached.sha256 || "",
          total_entries: cached.entries.length,
        };
      }
    } catch {
      evidencePack.log(`ValorPDF: cache corrupted, re-downloading`);
    }
  }

  evidencePack.log(`ValorPDF: downloading PDF from ${config.url}`);

  try {
    const response = await fetch(config.url, {
      headers: {
        "User-Agent": "AuraLOA/1.0 (Pesquisa Academica Precatorios)",
      },
    });

    if (!response.ok) {
      evidencePack.log(`ValorPDF: HTTP ${response.status} for ${config.url}`);
      return null;
    }

    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const sha256 = computeSHA256(buffer);

    evidencePack.log(`ValorPDF: downloaded ${buffer.length} bytes sha256=${sha256}`);

    const rawSaved = evidencePack.saveRawPayload(`pdf_valores_${tribunalAlias}_${anoOrcamento}.pdf`, buffer);

    evidencePack.log(`ValorPDF: parsing PDF (${buffer.length} bytes)...`);
    const text = await parsePDFBuffer(buffer);

    const entries = extractEntriesFromText(text);
    evidencePack.log(`ValorPDF: extracted ${entries.length} entries from ${tribunalAlias} PDF`);

    const cacheData = {
      entries,
      sha256,
      fonte_url: config.url,
      tribunal: config.tribunal,
      ano_orcamento: anoOrcamento,
      parsed_at: new Date().toISOString(),
      total_entries: entries.length,
    };
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), "utf-8");

    const byNumero = new Map<string, PrecatorioValorEntry>();
    for (const e of entries) {
      byNumero.set(e.numero_precatorio, e);
    }

    return {
      entries,
      by_numero: byNumero,
      tribunal: config.tribunal,
      ano_orcamento: anoOrcamento,
      fonte_url: config.url,
      sha256,
      total_entries: entries.length,
    };
  } catch (err: any) {
    evidencePack.log(`ValorPDF: error downloading/parsing: ${err.message}`);
    return null;
  }
}

export function enrichProcessosWithValores(
  processos: Array<{
    numero_cnj: string;
    valor_causa: number | null;
    valor_fonte: string | null;
    tribunal_alias: string;
  }>,
  valorIndex: PrecatorioValorIndex,
  tribunalAlias: string,
): { enriched: number; total: number } {
  let enriched = 0;
  const total = processos.filter((p) => p.tribunal_alias === tribunalAlias).length;

  for (const processo of processos) {
    if (processo.tribunal_alias !== tribunalAlias) continue;

    let entry = valorIndex.by_numero.get(processo.numero_cnj);

    if (!entry && processo.numero_cnj.length === 20) {
      entry = valorIndex.by_numero.get(processo.numero_cnj.slice(1));
    }

    if (!entry && processo.numero_cnj.length === 19) {
      entry = valorIndex.by_numero.get("0" + processo.numero_cnj);
    }

    if (entry) {
      processo.valor_causa = entry.valor;
      processo.valor_fonte = "pdf_oficial";
      enriched++;
    }
  }

  return { enriched, total };
}

export function computePDFSummary(valorIndex: PrecatorioValorIndex): {
  total_precatorios_pdf: number;
  valor_total_orcamento: number;
  valor_alimentar: number;
  valor_comum: number;
  total_idoso: number;
  total_deficiencia: number;
} {
  let valorTotal = 0;
  let valorAlimentar = 0;
  let valorComum = 0;
  let totalIdoso = 0;
  let totalDeficiencia = 0;

  for (const entry of valorIndex.entries) {
    valorTotal += entry.valor;
    if (entry.tipo === "ALIMENTAR") valorAlimentar += entry.valor;
    else if (entry.tipo === "COMUM") valorComum += entry.valor;
    if (entry.preferencia.includes("IDOSO")) totalIdoso++;
    if (entry.preferencia.includes("DEFICIÊNCIA") || entry.preferencia.includes("DEFICIENCIA")) totalDeficiencia++;
  }

  return {
    total_precatorios_pdf: valorIndex.entries.length,
    valor_total_orcamento: valorTotal,
    valor_alimentar: valorAlimentar,
    valor_comum: valorComum,
    total_idoso: totalIdoso,
    total_deficiencia: totalDeficiencia,
  };
}
