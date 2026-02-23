import { EvidencePack, computeSHA256 } from "./evidence_pack";

const BASE_URL = "https://dworcamento.fazenda.sp.gov.br/DadosXML";

export interface SpAutoImportRow {
  ano: number;
  cod_orgao: string;
  desc_orgao: string;
  tipo_adm: string;
  cod_projeto: string;
  desc_projeto: string;
  grupo: string;
  dotacao_inicial: number;
  proposta_orcamento: number;
  valor_liquidado?: number;
  is_precatorio: boolean;
  raw: Record<string, string>;
}

export interface SpAutoImportResult {
  ok: boolean;
  ano: number;
  tipo: "execucao" | "dotacao";
  total_linhas: number;
  precatorios_encontrados: number;
  todos: SpAutoImportRow[];
  precatorios: SpAutoImportRow[];
  fonte_url: string;
  evidence: {
    schema_version: string;
    generated_at_iso_utc: string;
    process_id_uuid: string;
    bundle_sha256: string;
    csv_sha256: string;
  };
  note?: string;
}

function safeNumberBR(v: any): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(/"/g, "");
  if (!s) return 0;
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}

const PRECATORIO_KEYWORDS = [
  "precatório",
  "precatorio",
  "precatórios",
  "precatorios",
  "sentença judicial",
  "sentenca judicial",
  "sentenças judiciais",
  "sentencas judiciais",
  "rpv",
  "requisição de pequeno valor",
  "requisicao de pequeno valor",
  "depósitos judiciais",
  "depositos judiciais",
];

function isPrecatorio(descProjeto: string): boolean {
  const lower = descProjeto.toLowerCase();
  return PRECATORIO_KEYWORDS.some((kw) => lower.includes(kw));
}

function parseFazendaCsv(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers: string[] = [];
  const hMatch = headerLine.match(/"[^"]*"|[^,]+/g) ?? [];
  for (const h of hMatch) {
    headers.push(h.replace(/^"|"$/g, "").trim());
  }

  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals: string[] = [];
    const vMatch = lines[i].match(/"[^"]*"|[^,]+/g) ?? [];
    for (const v of vMatch) {
      vals.push(v.replace(/^"|"$/g, "").trim());
    }
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (vals[j] ?? "").trim();
    }
    out.push(row);
  }
  return out;
}

function mapRow(r: Record<string, string>, ano: number, hasLiquidado: boolean): SpAutoImportRow {
  const descProjeto =
    r["Descrição Projeto / Atividade Elaboração"] ||
    r["Descrição Projeto / Atividade"] ||
    "";

  return {
    ano,
    cod_orgao: r["Código Órgão"] || r["Código Órgão SEP"] || "",
    desc_orgao: r["Descrição Órgão"] || r["Descrição Órgão SEP"] || "",
    tipo_adm: r["Nome Tipo Administração"] || "",
    cod_projeto: r["Código Projeto / Atividade"] || "",
    desc_projeto: descProjeto,
    grupo: r["Descrição Grupo"] || "",
    dotacao_inicial: safeNumberBR(r["Valor Dotação Inicial-SEFAZ"]),
    proposta_orcamento: safeNumberBR(r["Valor Proposta Orçamento-SEFAZ"]),
    valor_liquidado: hasLiquidado
      ? safeNumberBR(r["Valor Liquidado-SEFAZ"])
      : undefined,
    is_precatorio: isPrecatorio(descProjeto),
    raw: r,
  };
}

export async function importarExecucaoAutomatica(
  ano: number
): Promise<SpAutoImportResult> {
  const url = `${BASE_URL}/${ano}_INVESTIMENTOS_EXECUCAO_ORCAMENTO.csv`;
  const processId = crypto.randomUUID();
  const pack = new EvidencePack(processId);
  pack.saveRequest({ ente: "SP", kind: "auto_execucao", ano, url });
  pack.log(`[SP-AUTO] Baixando execucao orcamentaria: ${url}`);

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "AuraLOA/1.0 (pesquisa precatorios SP)",
        Accept: "text/csv, */*",
      },
    });

    if (!resp.ok) {
      pack.log(`[SP-AUTO] HTTP ${resp.status} ao baixar ${url}`);
      pack.saveLog();
      return {
        ok: false,
        ano,
        tipo: "execucao",
        total_linhas: 0,
        precatorios_encontrados: 0,
        todos: [],
        precatorios: [],
        fonte_url: url,
        evidence: {
          schema_version: "evidence_pack_v1",
          generated_at_iso_utc: new Date().toISOString(),
          process_id_uuid: processId,
          bundle_sha256: "",
          csv_sha256: "",
        },
        note: `HTTP ${resp.status}: arquivo nao disponivel para o ano ${ano}`,
      };
    }

    const csvText = await resp.text();
    const csvHash = computeSHA256(csvText);
    pack.saveRawPayload(`sp_execucao_${ano}.csv`, Buffer.from(csvText, "utf-8"));
    pack.log(`[SP-AUTO] CSV recebido: ${csvText.length} bytes, SHA256=${csvHash.slice(0, 16)}...`);

    const rawRows = parseFazendaCsv(csvText);
    const allRows = rawRows.map((r) => mapRow(r, ano, true));
    const precatorios = allRows.filter((r) => r.is_precatorio);

    const outputHash = computeSHA256(JSON.stringify({ ano, total: allRows.length, prec: precatorios.length }));
    pack.saveHashes({ output_sha256: outputHash, csv_sha256: csvHash });
    pack.log(`[SP-AUTO] Execucao ${ano}: ${allRows.length} linhas, ${precatorios.length} precatorios`);
    pack.saveLog();

    return {
      ok: true,
      ano,
      tipo: "execucao",
      total_linhas: allRows.length,
      precatorios_encontrados: precatorios.length,
      todos: allRows,
      precatorios,
      fonte_url: url,
      evidence: {
        schema_version: "evidence_pack_v1",
        generated_at_iso_utc: new Date().toISOString(),
        process_id_uuid: processId,
        bundle_sha256: outputHash,
        csv_sha256: csvHash,
      },
    };
  } catch (e: any) {
    pack.log(`[SP-AUTO] Erro: ${e?.message}`);
    pack.saveLog();
    return {
      ok: false,
      ano,
      tipo: "execucao",
      total_linhas: 0,
      precatorios_encontrados: 0,
      todos: [],
      precatorios: [],
      fonte_url: url,
      evidence: {
        schema_version: "evidence_pack_v1",
        generated_at_iso_utc: new Date().toISOString(),
        process_id_uuid: processId,
        bundle_sha256: "",
        csv_sha256: "",
      },
      note: `Erro ao baixar: ${e?.message}`,
    };
  }
}

export async function importarDotacaoAutomatica(
  ano: number
): Promise<SpAutoImportResult> {
  const url = `${BASE_URL}/${ano}_INVESTIMENTO_DOTACAO_INICIAL.csv`;
  const processId = crypto.randomUUID();
  const pack = new EvidencePack(processId);
  pack.saveRequest({ ente: "SP", kind: "auto_dotacao", ano, url });
  pack.log(`[SP-AUTO] Baixando dotacao inicial: ${url}`);

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "AuraLOA/1.0 (pesquisa precatorios SP)",
        Accept: "text/csv, */*",
      },
    });

    if (!resp.ok) {
      pack.log(`[SP-AUTO] HTTP ${resp.status} ao baixar ${url}`);
      pack.saveLog();
      return {
        ok: false,
        ano,
        tipo: "dotacao",
        total_linhas: 0,
        precatorios_encontrados: 0,
        todos: [],
        precatorios: [],
        fonte_url: url,
        evidence: {
          schema_version: "evidence_pack_v1",
          generated_at_iso_utc: new Date().toISOString(),
          process_id_uuid: processId,
          bundle_sha256: "",
          csv_sha256: "",
        },
        note: `HTTP ${resp.status}: arquivo nao disponivel para o ano ${ano}`,
      };
    }

    const csvText = await resp.text();
    const csvHash = computeSHA256(csvText);
    pack.saveRawPayload(`sp_dotacao_${ano}.csv`, Buffer.from(csvText, "utf-8"));
    pack.log(`[SP-AUTO] CSV recebido: ${csvText.length} bytes, SHA256=${csvHash.slice(0, 16)}...`);

    const rawRows = parseFazendaCsv(csvText);
    const allRows = rawRows.map((r) => mapRow(r, ano, false));
    const precatorios = allRows.filter((r) => r.is_precatorio);

    const outputHash = computeSHA256(JSON.stringify({ ano, total: allRows.length, prec: precatorios.length }));
    pack.saveHashes({ output_sha256: outputHash, csv_sha256: csvHash });
    pack.log(`[SP-AUTO] Dotacao ${ano}: ${allRows.length} linhas, ${precatorios.length} precatorios`);
    pack.saveLog();

    return {
      ok: true,
      ano,
      tipo: "dotacao",
      total_linhas: allRows.length,
      precatorios_encontrados: precatorios.length,
      todos: allRows,
      precatorios,
      fonte_url: url,
      evidence: {
        schema_version: "evidence_pack_v1",
        generated_at_iso_utc: new Date().toISOString(),
        process_id_uuid: processId,
        bundle_sha256: outputHash,
        csv_sha256: csvHash,
      },
    };
  } catch (e: any) {
    pack.log(`[SP-AUTO] Erro: ${e?.message}`);
    pack.saveLog();
    return {
      ok: false,
      ano,
      tipo: "dotacao",
      total_linhas: 0,
      precatorios_encontrados: 0,
      todos: [],
      precatorios: [],
      fonte_url: url,
      evidence: {
        schema_version: "evidence_pack_v1",
        generated_at_iso_utc: new Date().toISOString(),
        process_id_uuid: processId,
        bundle_sha256: "",
        csv_sha256: "",
      },
      note: `Erro ao baixar: ${e?.message}`,
    };
  }
}

export function getAnosDisponiveis(): number[] {
  const currentYear = new Date().getFullYear();
  const anos: number[] = [];
  for (let y = 2011; y <= currentYear + 1; y++) {
    anos.push(y);
  }
  return anos;
}
