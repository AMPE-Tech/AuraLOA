import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { EvidencePack, computeSHA256 } from "../services/evidence_pack";
import {
  consultarTjspPendentes,
  consultarTjspPagamentos,
  getTjspUrls,
} from "../services/sp_tjsp";
import {
  importarExecucaoAutomatica,
  importarDotacaoAutomatica,
  getAnosDisponiveis,
} from "../services/sp_auto_import";
import {
  fetchEstoqueFromDataJud,
  TRIBUNAIS_SP,
  CLASSE_PRECATORIO,
  CLASSE_RPV,
} from "../services/estoque_datajud";
import {
  spLoaImportSchema,
  spDespesasImportSchema,
  spA2RequestSchema,
  type SpLoaRow,
  type SpDespesaRow,
} from "../../shared/loa_types";
import { query } from "../db";

const router = Router();

// ── Utilidades ────────────────────────────────────────────────────────────────

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

// ── DB helpers ────────────────────────────────────────────────────────────────

interface DbSpLoaRow {
  id: number; ente: string; ano: number; orgao: string | null; uo: string | null;
  programa: string | null; acao_local: string | null; dotacao_inicial: string | null;
  dotacao_atual: string | null; raw: any;
}

interface DbSpDespesaRow {
  id: number; ente: string; ano: number; orgao: string | null; uo: string | null;
  fase: string | null; valor: string | null; favorecido: string | null; data: string | null;
  raw: any;
}

function dbToSpLoaRow(r: DbSpLoaRow): SpLoaRow {
  return {
    ente: "SP",
    ano: r.ano,
    orgao: r.orgao ?? undefined,
    uo: r.uo ?? undefined,
    programa: r.programa ?? undefined,
    acao_local: r.acao_local ?? undefined,
    dotacao_inicial: r.dotacao_inicial != null ? Number(r.dotacao_inicial) : undefined,
    dotacao_atual: r.dotacao_atual != null ? Number(r.dotacao_atual) : undefined,
    raw: r.raw ?? {},
  };
}

function dbToSpDespesaRow(r: DbSpDespesaRow): SpDespesaRow {
  return {
    ente: "SP",
    ano: r.ano,
    orgao: r.orgao ?? undefined,
    uo: r.uo ?? undefined,
    fase: r.fase ?? undefined,
    valor: r.valor != null ? Number(r.valor) : undefined,
    favorecido: r.favorecido ?? undefined,
    data: r.data ?? undefined,
    raw: r.raw ?? {},
  };
}

async function insertSpLoaRow(item: SpLoaRow): Promise<void> {
  await query(
    `INSERT INTO sp_loa_rows (ente, ano, orgao, uo, programa, acao_local, dotacao_inicial, dotacao_atual, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      item.ente, item.ano,
      item.orgao ?? null, item.uo ?? null,
      item.programa ?? null, item.acao_local ?? null,
      item.dotacao_inicial ?? null, item.dotacao_atual ?? null,
      item.raw,
    ],
  );
}

async function insertSpDespesaRow(item: SpDespesaRow): Promise<void> {
  await query(
    `INSERT INTO sp_despesas_rows (ente, ano, orgao, uo, fase, valor, favorecido, data, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      item.ente, item.ano,
      item.orgao ?? null, item.uo ?? null,
      item.fase ?? null, item.valor ?? null,
      item.favorecido ?? null, item.data ?? null,
      item.raw,
    ],
  );
}

async function querySpLoa(ano: number, orgao?: string, uo?: string): Promise<SpLoaRow[]> {
  const params: any[] = [ano];
  let sql = "SELECT * FROM sp_loa_rows WHERE ano = $1";
  if (orgao) { sql += ` AND orgao = $${params.length + 1}`; params.push(orgao); }
  if (uo)    { sql += ` AND uo = $${params.length + 1}`;    params.push(uo); }
  const rows = await query<DbSpLoaRow>(sql, params);
  return rows.map(dbToSpLoaRow);
}

async function querySpDespesas(ano: number, orgao?: string, uo?: string): Promise<SpDespesaRow[]> {
  const params: any[] = [ano];
  let sql = "SELECT * FROM sp_despesas_rows WHERE ano = $1";
  if (orgao) { sql += ` AND orgao = $${params.length + 1}`; params.push(orgao); }
  if (uo)    { sql += ` AND uo = $${params.length + 1}`;    params.push(uo); }
  const rows = await query<DbSpDespesaRow>(sql, params);
  return rows.map(dbToSpDespesaRow);
}

async function countSpLoaByAno(ano: number): Promise<number> {
  const r = await query<{ count: string }>("SELECT COUNT(*) AS count FROM sp_loa_rows WHERE ano = $1", [ano]);
  return parseInt(r[0]?.count ?? "0");
}

async function countSpDespesasByAno(ano: number): Promise<number> {
  const r = await query<{ count: string }>("SELECT COUNT(*) AS count FROM sp_despesas_rows WHERE ano = $1", [ano]);
  return parseInt(r[0]?.count ?? "0");
}

async function getSpLoaStats(): Promise<{ total: number; anos: number[] }> {
  const [cntRows, anosRows] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*) AS count FROM sp_loa_rows"),
    query<{ ano: number }>("SELECT DISTINCT ano FROM sp_loa_rows ORDER BY ano"),
  ]);
  return { total: parseInt(cntRows[0]?.count ?? "0"), anos: anosRows.map((r) => r.ano) };
}

async function getSpDespesasStats(): Promise<{ total: number; anos: number[] }> {
  const [cntRows, anosRows] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*) AS count FROM sp_despesas_rows"),
    query<{ ano: number }>("SELECT DISTINCT ano FROM sp_despesas_rows ORDER BY ano"),
  ]);
  return { total: parseInt(cntRows[0]?.count ?? "0"), anos: anosRows.map((r) => r.ano) };
}

// ── Rotas: importação CSV ─────────────────────────────────────────────────────

router.post("/api/sp/loa/import", async (req: Request, res: Response) => {
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
      await insertSpLoaRow(item);
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
    total_loa_stored: await countSpLoaByAno(Number(ano)),
    evidence: {
      schema_version: "evidence_pack_v1",
      generated_at_iso_utc: new Date().toISOString(),
      process_id_uuid: processId,
      bundle_sha256: outputHash,
    },
  });
});

router.post("/api/sp/despesas/import", async (req: Request, res: Response) => {
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
      await insertSpDespesaRow(item);
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
    total_despesas_stored: await countSpDespesasByAno(Number(ano)),
    evidence: {
      schema_version: "evidence_pack_v1",
      generated_at_iso_utc: new Date().toISOString(),
      process_id_uuid: processId,
      bundle_sha256: outputHash,
    },
  });
});

// ── TJSP: pendentes e pagamentos ──────────────────────────────────────────────

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

// ── A2: conciliação SP ────────────────────────────────────────────────────────

router.post("/api/sp/a2", async (req: Request, res: Response) => {
  const parsed = spA2RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "ano e obrigatorio", details: parsed.error.issues });
  }

  const { ano, orgao, uo } = parsed.data;

  const [loa, despesas] = await Promise.all([
    querySpLoa(ano, orgao, uo),
    querySpDespesas(ano, orgao, uo),
  ]);

  const dotacao_atual_total = loa.reduce((acc, r) => acc + (r.dotacao_atual ?? 0), 0);
  const execucao_total = despesas.reduce((acc, r) => acc + (r.valor ?? 0), 0);

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

// ── Auto import: execução Sefaz/SP ────────────────────────────────────────────

router.post("/api/sp/auto/execucao", async (req: Request, res: Response) => {
  const ano = Number(req.body?.ano);
  if (!ano || ano < 2011 || ano > new Date().getFullYear() + 1) {
    return res.status(400).json({ error: "ano invalido (2011-" + (new Date().getFullYear() + 1) + ")" });
  }

  const result = await importarExecucaoAutomatica(ano);

  if (result.ok) {
    for (const row of result.precatorios) {
      await insertSpLoaRow({
        ente: "SP",
        ano,
        orgao: row.desc_orgao || undefined,
        uo: row.cod_orgao || undefined,
        programa: row.grupo || undefined,
        acao_local: row.desc_projeto || undefined,
        dotacao_inicial: row.dotacao_inicial,
        dotacao_atual: row.proposta_orcamento || row.dotacao_inicial,
        raw: row.raw,
      });
    }

    for (const row of result.precatorios) {
      if (row.valor_liquidado && row.valor_liquidado > 0) {
        await insertSpDespesaRow({
          ente: "SP",
          ano,
          orgao: row.desc_orgao || undefined,
          uo: row.cod_orgao || undefined,
          fase: "LIQUIDADO",
          valor: row.valor_liquidado,
          raw: row.raw,
        });
      }
    }
  }

  return res.json({
    ok: result.ok,
    tipo: result.tipo,
    ano: result.ano,
    total_linhas: result.total_linhas,
    precatorios_encontrados: result.precatorios_encontrados,
    precatorios: result.precatorios,
    fonte_url: result.fonte_url,
    evidence: result.evidence,
    note: result.note,
  });
});

// ── Auto import: dotação Sefaz/SP ─────────────────────────────────────────────

router.post("/api/sp/auto/dotacao", async (req: Request, res: Response) => {
  const ano = Number(req.body?.ano);
  if (!ano || ano < 2011 || ano > new Date().getFullYear() + 1) {
    return res.status(400).json({ error: "ano invalido (2011-" + (new Date().getFullYear() + 1) + ")" });
  }

  const result = await importarDotacaoAutomatica(ano);

  if (result.ok) {
    for (const row of result.precatorios) {
      await insertSpLoaRow({
        ente: "SP",
        ano,
        orgao: row.desc_orgao || undefined,
        uo: row.cod_orgao || undefined,
        programa: row.grupo || undefined,
        acao_local: row.desc_projeto || undefined,
        dotacao_inicial: row.dotacao_inicial,
        dotacao_atual: row.proposta_orcamento || row.dotacao_inicial,
        raw: row.raw,
      });
    }
  }

  return res.json({
    ok: result.ok,
    tipo: result.tipo,
    ano: result.ano,
    total_linhas: result.total_linhas,
    precatorios_encontrados: result.precatorios_encontrados,
    precatorios: result.precatorios,
    fonte_url: result.fonte_url,
    evidence: result.evidence,
    note: result.note,
  });
});

router.get("/api/sp/auto/anos", (_req: Request, res: Response) => {
  return res.json({ anos: getAnosDisponiveis() });
});

// ── DataJud SP: pendentes ─────────────────────────────────────────────────────

router.post("/api/sp/pendentes-datajud", async (req: Request, res: Response) => {
  const processId = crypto.randomUUID();
  const evidencePack = new EvidencePack(processId);

  try {
    const ano_exercicio = Number(req.body?.ano_exercicio) || new Date().getFullYear();
    const max_por_tribunal = Number(req.body?.max_por_tribunal) || 2000;
    evidencePack.log(`SP pendentes-datajud start process_id=${processId} year=${ano_exercicio}`);
    evidencePack.saveRequest(req.body);

    const allProcessos: any[] = [];
    const porTribunal: any[] = [];
    const allEvidences: any[] = [];

    const results = await Promise.allSettled(
      TRIBUNAIS_SP.map((tribunal) =>
        fetchEstoqueFromDataJud({
          tribunal_alias: tribunal.alias,
          classe_codigos: [CLASSE_PRECATORIO, CLASSE_RPV],
          ano_exercicio,
          max_results: max_por_tribunal,
          evidencePack,
        })
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allProcessos.push(...result.value.processos);
        porTribunal.push(result.value.summary);
        allEvidences.push(...result.value.evidences);
      }
    }

    const pendentes = allProcessos.filter((p: any) => p.pagamento_pendente);
    const precPendentes = pendentes.filter((p: any) => p.classe_codigo === CLASSE_PRECATORIO);
    const rpvPendentes = pendentes.filter((p: any) => p.classe_codigo === CLASSE_RPV);

    const output = {
      ente: "SP",
      ano_exercicio,
      process_id_uuid: processId,
      status_geral: allProcessos.length > 0 ? "OK" : "NAO_LOCALIZADO",
      total_processos: allProcessos.length,
      total_pendentes: pendentes.length,
      total_precatorios_pendentes: precPendentes.length,
      total_rpvs_pendentes: rpvPendentes.length,
      processos: pendentes,
      por_tribunal: porTribunal,
      sources: [
        { name: "CNJ DataJud API Publica (TJSP)", url: "https://api-publica.datajud.cnj.jus.br", type: "API" },
        { name: "TJSP eSAJ Consulta", url: "https://esaj.tjsp.jus.br/cpopg/open.do", type: "WEB" },
      ],
      evidencias_count: allEvidences.length,
      hashes: { output_sha256: "" },
      evidence_pack_path: evidencePack.getBasePath(),
      ultima_atualizacao_iso: new Date().toISOString(),
    };

    const outputHash = computeSHA256(JSON.stringify(output));
    output.hashes.output_sha256 = outputHash;

    evidencePack.saveResponse(output);
    evidencePack.saveHashes({ output_sha256: outputHash });
    evidencePack.saveLog();

    return res.json(output);
  } catch (error: any) {
    evidencePack.log(`fatal error: ${error.message}`);
    evidencePack.saveLog();
    return res.status(500).json({ error: "Erro ao consultar pendentes SP", message: error.message });
  }
});

// ── Status SP ─────────────────────────────────────────────────────────────────

router.get("/api/sp/status", async (_req: Request, res: Response) => {
  const [loaStats, despesasStats] = await Promise.all([
    getSpLoaStats(),
    getSpDespesasStats(),
  ]);

  return res.json({
    ente: "SP",
    status: "ATIVO",
    dados_importados: {
      loa: {
        total_registros: loaStats.total,
        anos: loaStats.anos,
      },
      despesas: {
        total_registros: despesasStats.total,
        anos: despesasStats.anos,
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
