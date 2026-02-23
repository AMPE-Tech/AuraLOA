import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { EvidencePack, computeSHA256 } from "../services/evidence_pack";
import {
  consultarTjspPendentes,
  consultarTjspPagamentos,
  getTjspUrls,
} from "../services/sp_tjsp";
import {
  spLoaImportSchema,
  spDespesasImportSchema,
  spA2RequestSchema,
  type SpLoaRow,
  type SpDespesaRow,
} from "../../shared/loa_types";

const router = Router();

const SP_LOA: SpLoaRow[] = [];
const SP_DESPESAS: SpDespesaRow[] = [];

function safeNumberBR(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : undefined;
}

function parseCsv(content: string, delimiter = ";"): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(delimiter).map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++)
      row[header[j]] = (cols[j] ?? "").trim();
    out.push(row);
  }
  return out;
}

router.post("/api/sp/loa/import", (req: Request, res: Response) => {
  const parsed = spLoaImportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "ano e csvText sao obrigatorios", details: parsed.error.issues });
  }

  const { ano, csvText, delimiter } = parsed.data;
  const processId = crypto.randomUUID();
  const pack = new EvidencePack(processId);
  pack.saveRequest({ ente: "SP", kind: "loa_csv", ano });
  pack.saveRawPayload(`sp_loa_${ano}.csv`, Buffer.from(csvText, "utf-8"));

  const rows = parseCsv(csvText, delimiter ?? ";");

  let imported = 0;
  for (const r of rows) {
    const item: SpLoaRow = {
      ente: "SP",
      ano: Number(ano),
      orgao: (r["ORGAO"] || r["ÓRGÃO"] || r["orgao"] || "").trim() || undefined,
      uo: (r["UO"] || r["UNIDADE_ORCAMENTARIA"] || r["uo"] || "").trim() || undefined,
      programa: (r["PROGRAMA"] || r["programa"] || "").trim() || undefined,
      acao_local: (r["ACAO"] || r["AÇÃO"] || r["acao"] || r["ATIVIDADE"] || "").trim() || undefined,
      dotacao_inicial: safeNumberBR(r["DOTACAO_INICIAL"] || r["dotacao_inicial"]),
      dotacao_atual: safeNumberBR(r["DOTACAO_ATUAL"] || r["dotacao_atual"]),
      raw: r,
    };
    if (item.acao_local || item.programa || item.uo || item.orgao) {
      SP_LOA.push(item);
      imported++;
    }
  }

  const outputHash = computeSHA256(JSON.stringify({ imported, ano }));
  pack.saveHashes({ output_sha256: outputHash });
  pack.log(`[SP] LOA import: ${imported} linhas importadas de ${rows.length} para ano ${ano}`);
  pack.saveLog();

  return res.json({
    ok: true,
    imported,
    total_rows_parsed: rows.length,
    total_loa_stored: SP_LOA.filter((r) => r.ano === ano).length,
    evidence: {
      schema_version: "evidence_pack_v1",
      generated_at_iso_utc: new Date().toISOString(),
      process_id_uuid: processId,
      bundle_sha256: outputHash,
    },
  });
});

router.post("/api/sp/despesas/import", (req: Request, res: Response) => {
  const parsed = spDespesasImportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "ano e csvText sao obrigatorios", details: parsed.error.issues });
  }

  const { ano, csvText, delimiter } = parsed.data;
  const processId = crypto.randomUUID();
  const pack = new EvidencePack(processId);
  pack.saveRequest({ ente: "SP", kind: "despesas_csv", ano });
  pack.saveRawPayload(`sp_despesas_${ano}.csv`, Buffer.from(csvText, "utf-8"));

  const rows = parseCsv(csvText, delimiter ?? ";");

  let imported = 0;
  for (const r of rows) {
    const item: SpDespesaRow = {
      ente: "SP",
      ano: Number(ano),
      orgao: (r["ORGAO"] || r["ÓRGÃO"] || r["orgao"] || "").trim() || undefined,
      uo: (r["UO"] || r["UNIDADE_ORCAMENTARIA"] || r["uo"] || "").trim() || undefined,
      fase: (r["FASE"] || r["fase"] || r["ETAPA"] || "").trim() || undefined,
      valor: safeNumberBR(r["VALOR"] || r["valor"] || r["VL_DESPESA"]),
      favorecido: (r["FAVORECIDO"] || r["favorecido"] || "").trim() || undefined,
      data: (r["DATA"] || r["data"] || r["DT_PAGAMENTO"] || "").trim() || undefined,
      raw: r,
    };
    if (item.valor || item.orgao || item.uo) {
      SP_DESPESAS.push(item);
      imported++;
    }
  }

  const outputHash = computeSHA256(JSON.stringify({ imported, ano }));
  pack.saveHashes({ output_sha256: outputHash });
  pack.log(`[SP] Despesas import: ${imported} linhas importadas de ${rows.length} para ano ${ano}`);
  pack.saveLog();

  return res.json({
    ok: true,
    imported,
    total_rows_parsed: rows.length,
    total_despesas_stored: SP_DESPESAS.filter((r) => r.ano === ano).length,
    evidence: {
      schema_version: "evidence_pack_v1",
      generated_at_iso_utc: new Date().toISOString(),
      process_id_uuid: processId,
      bundle_sha256: outputHash,
    },
  });
});

router.get("/api/sp/tjsp/pendentes", async (req: Request, res: Response) => {
  const entidade = String(req.query.entidade ?? "").trim();
  if (!entidade) {
    return res.status(400).json({ error: "entidade e obrigatoria (ex: FAZENDA DO ESTADO DE SAO PAULO)" });
  }

  const processId = crypto.randomUUID();
  const pack = new EvidencePack(processId);
  pack.saveRequest({ ente: "SP", kind: "tjsp_pendentes", entidade });

  const { items, note } = await consultarTjspPendentes(entidade, pack);

  const outputHash = computeSHA256(JSON.stringify(items));
  pack.saveHashes({ output_sha256: outputHash });
  pack.saveLog();

  return res.json({
    ok: true,
    note,
    entidade,
    count: items.length,
    data: items,
    urls_consulta: getTjspUrls(),
    evidence: {
      schema_version: "evidence_pack_v1",
      generated_at_iso_utc: new Date().toISOString(),
      process_id_uuid: processId,
      bundle_sha256: outputHash,
    },
  });
});

router.get("/api/sp/tjsp/pagamentos", async (req: Request, res: Response) => {
  const entidade = String(req.query.entidade ?? "").trim();
  if (!entidade) {
    return res.status(400).json({ error: "entidade e obrigatoria (ex: FAZENDA DO ESTADO DE SAO PAULO)" });
  }

  const processId = crypto.randomUUID();
  const pack = new EvidencePack(processId);
  pack.saveRequest({ ente: "SP", kind: "tjsp_pagamentos", entidade });

  const { items, note } = await consultarTjspPagamentos(entidade, pack);

  const outputHash = computeSHA256(JSON.stringify(items));
  pack.saveHashes({ output_sha256: outputHash });
  pack.saveLog();

  return res.json({
    ok: true,
    note,
    entidade,
    count: items.length,
    data: items,
    urls_consulta: getTjspUrls(),
    evidence: {
      schema_version: "evidence_pack_v1",
      generated_at_iso_utc: new Date().toISOString(),
      process_id_uuid: processId,
      bundle_sha256: outputHash,
    },
  });
});

router.post("/api/sp/a2", (req: Request, res: Response) => {
  const parsed = spA2RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "ano e obrigatorio", details: parsed.error.issues });
  }

  const { ano, orgao, uo } = parsed.data;

  const loa = SP_LOA.filter(
    (r) =>
      r.ano === ano &&
      (!orgao || r.orgao === orgao) &&
      (!uo || r.uo === uo)
  );
  const despesas = SP_DESPESAS.filter(
    (r) =>
      r.ano === ano &&
      (!orgao || r.orgao === orgao) &&
      (!uo || r.uo === uo)
  );

  const dotacao_atual_total = loa.reduce(
    (acc, r) => acc + (r.dotacao_atual ?? 0),
    0
  );
  const execucao_total = despesas.reduce(
    (acc, r) => acc + (r.valor ?? 0),
    0
  );

  return res.json({
    ok: true,
    ente: "SP",
    query: { ano, orgao, uo },
    summary: {
      dotacao_atual_total,
      execucao_total,
      saldo_estimado: dotacao_atual_total - execucao_total,
      note: "MVP: conciliacao macro por filtros. Etapa 2 adiciona chaves (programa/acao_local/fonte/elemento) + score de match.",
    },
    loa_count: loa.length,
    despesas_count: despesas.length,
    loa,
    despesas,
  });
});

router.get("/api/sp/status", (_req: Request, res: Response) => {
  const anos_loa = Array.from(new Set(SP_LOA.map((r) => r.ano))).sort();
  const anos_despesas = Array.from(new Set(SP_DESPESAS.map((r) => r.ano))).sort();

  return res.json({
    ente: "SP",
    status: "ATIVO",
    dados_importados: {
      loa: {
        total_registros: SP_LOA.length,
        anos: anos_loa,
      },
      despesas: {
        total_registros: SP_DESPESAS.length,
        anos: anos_despesas,
      },
    },
    fontes: {
      loa: "Sefaz/SP - LOA (CSV manual)",
      despesas: "Portal da Transparencia SP (CSV manual)",
      estoque: "TJSP - DEPRE (scraping best-effort)",
    },
    urls_oficiais: {
      loa_sefaz: "https://portal.fazenda.sp.gov.br/servicos/orcamento/Paginas/loa.aspx",
      transparencia_sp: "https://www.transparencia.sp.gov.br/",
      tjsp_pendentes: getTjspUrls().pendentes,
      tjsp_pagamentos: getTjspUrls().pagamentos,
      tjsp_pesquisa: getTjspUrls().pesquisa,
    },
  });
});

export default router;
