import { Router, type Request, type Response } from "express";
import { createRequire } from "module";
import { resolve } from "path";
import { statSync, readFileSync, existsSync, unlinkSync } from "fs";
import { randomBytes } from "crypto";
import { query } from "../db";
import { uploadPdfV2, renameToContentHash } from "./upload_config";
import { extractFields } from "./field_extractor";
import { persistExtractionResult, logAuditEvent } from "./persistence";

const require = createRequire(resolve(process.cwd(), "package.json"));
const _pdfParseModule = require("pdf-parse");
const pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number }> =
  typeof _pdfParseModule === "function"
    ? _pdfParseModule
    : _pdfParseModule?.default ?? _pdfParseModule;

const router = Router();

const MAX_DOCS_POR_LOTE = 5;

function generateId(len = 10): string {
  return randomBytes(Math.ceil(len * 0.75))
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, len);
}

function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

async function checkDailyRateLimit(ip: string, limit = 5): Promise<{ allowed: boolean; used: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await query<{ count: number }>(
    `INSERT INTO v2_rate_limit (ip, day, count)
     VALUES ($1, $2::date, 1)
     ON CONFLICT (ip, day) DO UPDATE SET count = v2_rate_limit.count + 1
     RETURNING count`,
    [ip, today],
  );
  return { allowed: (rows[0]?.count ?? 1) <= limit, used: rows[0]?.count ?? 1 };
}

function cleanupTmp(path?: string) {
  if (path && existsSync(path)) {
    try { unlinkSync(path); } catch { /* ignore */ }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/v2/lote — upload múltiplo (até 5 PDFs)
// ══════════════════════════════════════════════════════════════════════════
router.post(
  "/api/v2/lote",
  uploadPdfV2.array("files", MAX_DOCS_POR_LOTE),
  async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";
    const files = (req.files as Express.Multer.File[]) ?? [];

    const cleanupAll = () => files.forEach((f) => cleanupTmp(f.path));

    try {
      if (files.length === 0) {
        return res.status(400).json({
          error: `Nenhum arquivo enviado. Envie 'files' (multipart) com 1 a ${MAX_DOCS_POR_LOTE} PDFs.`,
        });
      }

      const lgpdConsent = String(req.body?.lgpd_consent ?? "").toLowerCase();
      if (lgpdConsent !== "true" && lgpdConsent !== "1" && lgpdConsent !== "sim") {
        cleanupAll();
        return res.status(400).json({
          error: "Consentimento LGPD obrigatório. Envie 'lgpd_consent=true'.",
        });
      }

      // Rate limit por lote (1 lote = 1 consumo, independente de quantos docs)
      const { allowed, used } = await checkDailyRateLimit(ip, 5);
      if (!allowed) {
        cleanupAll();
        return res.status(429).json({
          error: "Limite diário de análises gratuitas atingido. Cadastre-se para ilimitadas.",
          limite_diario: 5,
          utilizadas: used,
        });
      }

      const loteId = generateId(10);
      await query(
        `INSERT INTO v2_lotes_analise (lote_id, ip_origem, status, total_docs)
         VALUES ($1, $2, 'pending_extraction', $3)`,
        [loteId, ip, files.length],
      );

      const docsResult: any[] = [];
      let ordem = 0;
      for (const file of files) {
        ordem++;
        const { finalPath, sha256 } = renameToContentHash(file.path);
        const stats = statSync(finalPath);

        const buffer = readFileSync(finalPath);
        const parsed = await pdfParse(buffer).catch((err) => {
          console.warn(`[V2 lote] pdf-parse falhou doc ${ordem}: ${err.message}`);
          return { text: "", numpages: 0 };
        });

        const charsExtraidos = parsed.text.length;
        const paginas = parsed.numpages;
        const extractionMethod = charsExtraidos < 500 ? "pdf-parse-failed-needs-ocr" : "pdf-parse";

        const validationId = generateId(12);
        const insert = await query<{ id: string }>(
          `INSERT INTO v2_analises (
             validation_id,
             file_sha256, file_path, file_size_bytes, file_original_name,
             paginas, chars_extraidos, ocr_usado, extraction_method,
             lgpd_consent_at, lgpd_consent_ip, lgpd_consent_user_agent,
             raw_text
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11,$12)
           RETURNING id`,
          [
            validationId,
            sha256,
            finalPath,
            stats.size,
            file.originalname,
            paginas,
            charsExtraidos,
            false,
            extractionMethod,
            ip,
            userAgent,
            parsed.text,
          ],
        );

        await query(
          `INSERT INTO v2_lote_docs (lote_id, analise_id, ordem) VALUES ($1, $2, $3)`,
          [loteId, insert[0].id, ordem],
        );

        docsResult.push({
          ordem,
          validation_id: validationId,
          analise_id: insert[0].id,
          original_name: file.originalname,
          paginas,
          chars_extraidos: charsExtraidos,
          needs_ocr: charsExtraidos < 500,
          sha256,
        });
      }

      return res.json({
        ok: true,
        lote_id: loteId,
        total_docs: files.length,
        status: "pending_extraction",
        docs: docsResult,
        rate_limit: { utilizadas: used, limite_diario: 5 },
        next_step: `POST /api/v2/lote/${loteId}/extrair — roda Haiku em todos os docs`,
      });
    } catch (err: any) {
      cleanupAll();
      console.error("[V2 /lote] erro:", err);
      return res.status(500).json({ error: err.message || "Erro no upload do lote" });
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════
// POST /api/v2/lote/:lote_id/extrair — roda Haiku em paralelo em todos os docs
// ══════════════════════════════════════════════════════════════════════════
router.post("/api/v2/lote/:lote_id/extrair", async (req: Request, res: Response) => {
  const { lote_id } = req.params;
  const force = String(req.query.force ?? "").toLowerCase() === "true";

  const lote = await query<any>(
    `SELECT * FROM v2_lotes_analise WHERE lote_id = $1 LIMIT 1`,
    [lote_id],
  );
  if (!lote[0]) return res.status(404).json({ error: "Lote não encontrado" });

  const docs = await query<any>(
    `SELECT a.id, a.validation_id, a.file_path, a.raw_text, a.numero_cnj, a.file_original_name, ld.ordem
     FROM v2_lote_docs ld
     JOIN v2_analises a ON a.id = ld.analise_id
     WHERE ld.lote_id = $1
     ORDER BY ld.ordem`,
    [lote_id],
  );
  if (docs.length === 0) return res.status(404).json({ error: "Lote sem documentos" });

  const startAll = Date.now();

  const results = await Promise.all(
    docs.map(async (d) => {
      if (d.numero_cnj && !force) {
        return {
          ordem: d.ordem,
          validation_id: d.validation_id,
          original_name: d.file_original_name,
          status: "already_extracted",
          message: "Documento já extraído. Use ?force=true para reprocessar.",
        };
      }
      if (!existsSync(d.file_path)) {
        return {
          ordem: d.ordem,
          validation_id: d.validation_id,
          original_name: d.file_original_name,
          status: "erro",
          error: "Arquivo não existe mais em disco",
        };
      }

      const startDoc = Date.now();
      try {
        const extraction = await extractFields(d.file_path, d.raw_text || "");
        await persistExtractionResult(d.id, extraction);
        const duracaoMs = Date.now() - startDoc;

        await logAuditEvent({
          analise_id: d.id,
          fase: "fase_extracao_haiku_lote",
          fonte_url: `anthropic://${extraction.method}`,
          status: "ok",
          confianca: extraction.fields.numero_cnj ? "alta" : extraction.fields.tribunal ? "media" : "baixa",
          alertas: {
            url_oficial_no_oficio: !!extraction.fields.url_verificacao_tribunal,
            qr_oficial_no_oficio: !!extraction.fields.qrcode_tribunal,
            codigo_verificador_no_oficio: !!extraction.fields.codigo_verificador,
          },
          duracao_ms: duracaoMs,
        });

        return {
          ordem: d.ordem,
          validation_id: d.validation_id,
          original_name: d.file_original_name,
          status: "ok",
          natureza_documento: extraction.fields.natureza_documento,
          numero_cnj: extraction.fields.numero_cnj,
          tribunal: extraction.fields.tribunal,
          tipo: extraction.fields.tipo,
          valor_rs: extraction.fields.valor_rs,
          total_processos: extraction.fields.processos_identificados.length,
          total_partes: extraction.fields.partes.length,
          total_autoridades: extraction.fields.autoridades.length,
          total_datas: extraction.fields.datas_identificadas.length,
          duracao_ms: duracaoMs,
          cost_usd: Number(extraction.cost_usd.toFixed(6)),
          method: extraction.method,
        };
      } catch (err: any) {
        const duracaoMs = Date.now() - startDoc;
        await logAuditEvent({
          analise_id: d.id,
          fase: "fase_extracao_haiku_lote",
          fonte_url: "anthropic://erro",
          status: "erro",
          confianca: "nenhuma",
          alertas: { erro: err.message },
          duracao_ms: duracaoMs,
        });
        return {
          ordem: d.ordem,
          validation_id: d.validation_id,
          original_name: d.file_original_name,
          status: "erro",
          error: err.message,
          duracao_ms: duracaoMs,
        };
      }
    }),
  );

  const duracaoTotalMs = Date.now() - startAll;
  const comErro = results.filter((r) => r.status === "erro").length;
  const novoStatus = comErro === 0 ? "extracted" : comErro === results.length ? "extraction_failed" : "extracted_partial";

  await query(
    `UPDATE v2_lotes_analise SET status = $1, extracted_at = NOW() WHERE lote_id = $2`,
    [novoStatus, lote_id],
  );

  const totalCost = results.reduce((acc, r: any) => acc + (r.cost_usd ?? 0), 0);

  return res.json({
    ok: true,
    lote_id,
    total_docs: docs.length,
    status: novoStatus,
    duracao_total_ms: duracaoTotalMs,
    cost_total_usd: Number(totalCost.toFixed(6)),
    cost_total_brl_aprox: Number((totalCost * 5.5).toFixed(4)),
    docs: results,
    next_step: novoStatus === "extracted"
      ? `POST /api/v2/lote/${lote_id}/consolidar — agrupa por CNJ e faz merge do checklist`
      : "Revisar documentos com erro antes de consolidar",
  });
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/v2/lote/:lote_id/status — estado atual do lote
// ══════════════════════════════════════════════════════════════════════════
router.get("/api/v2/lote/:lote_id/status", async (req: Request, res: Response) => {
  const { lote_id } = req.params;

  const lote = await query<any>(
    `SELECT lote_id, status, total_docs, cnj_consolidado,
            created_at, extracted_at, consolidated_at, reviewed_at, confirmed_at, enriched_at, completed_at
     FROM v2_lotes_analise WHERE lote_id = $1 LIMIT 1`,
    [lote_id],
  );
  if (!lote[0]) return res.status(404).json({ error: "Lote não encontrado" });

  const docs = await query<any>(
    `SELECT ld.ordem, a.validation_id, a.file_original_name, a.numero_cnj, a.tribunal,
            a.natureza_documento, a.tipo, a.valor_rs, a.paginas, a.chars_extraidos,
            a.extraction_method, a.extracted_at
     FROM v2_lote_docs ld
     JOIN v2_analises a ON a.id = ld.analise_id
     WHERE ld.lote_id = $1
     ORDER BY ld.ordem`,
    [lote_id],
  );

  return res.json({ ...lote[0], docs });
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/v2/lote/:lote_id/consolidar — agrupa por CNJ + revisor automático
// ══════════════════════════════════════════════════════════════════════════
import { loadLoteDocs, consolidarLote, type ChecklistConsolidado } from "./consolidador";
import { revisarConsolidacao } from "./revisor";
import { executarOrquestrador } from "./orquestrador";
import { auditarRelatorioFinal } from "./auditor_final";

router.post("/api/v2/lote/:lote_id/consolidar", async (req: Request, res: Response) => {
  const { lote_id } = req.params;

  const lote = await query<any>(
    `SELECT * FROM v2_lotes_analise WHERE lote_id = $1 LIMIT 1`,
    [lote_id],
  );
  if (!lote[0]) return res.status(404).json({ error: "Lote não encontrado" });

  const docs = await loadLoteDocs(lote_id);
  if (docs.length === 0) return res.status(404).json({ error: "Lote vazio" });

  const naoExtraidos = docs.filter((d) => !d.numero_cnj && !d.natureza_documento);
  if (naoExtraidos.length > 0) {
    return res.status(400).json({
      error: "Alguns documentos ainda não foram extraídos",
      docs_nao_extraidos: naoExtraidos.map((d) => ({ ordem: d.ordem, validation_id: d.validation_id })),
      sugestao: `Executar POST /api/v2/lote/${lote_id}/extrair primeiro`,
    });
  }

  const startConsolidacao = Date.now();
  const consolidacao = consolidarLote(docs);
  const duracaoConsolidacao = Date.now() - startConsolidacao;

  // Carrega validacao_extracao de cada doc p/ incorporar no Revisor de Consolidação
  const posExtracoesRows = await query<{ validacao_extracao: any }>(
    `SELECT a.validacao_extracao
     FROM v2_lote_docs ld JOIN v2_analises a ON a.id = ld.analise_id
     WHERE ld.lote_id = $1 AND a.validacao_extracao IS NOT NULL
     ORDER BY ld.ordem`,
    [lote_id],
  );
  const posExtracoes = posExtracoesRows
    .map((r) => r.validacao_extracao)
    .filter((v) => v && typeof v.score === "number");

  const startRevisao = Date.now();
  const revisao = await revisarConsolidacao(consolidacao, { posExtracoes });
  const duracaoRevisao = Date.now() - startRevisao;

  const novoStatus = revisao.decisao === "aprovado"
    ? "consolidated"
    : revisao.decisao === "requer_revisao_humana"
    ? "pending_human_review"
    : "consolidated_with_alerts";

  await query(
    `UPDATE v2_lotes_analise SET
       status = $1,
       cnj_consolidado = $2,
       checklist_consolidado = $3::jsonb,
       alertas_revisor = $4::jsonb,
       consolidated_at = NOW(),
       reviewed_at = NOW()
     WHERE lote_id = $5`,
    [
      novoStatus,
      consolidacao.cnj_consolidado,
      JSON.stringify(consolidacao.checklist_consolidado),
      JSON.stringify({
        resultado_revisor: revisao,
        consolidacao_meta: {
          cnjs_encontrados: consolidacao.cnjs_encontrados,
          provavelmente_mesmo_caso: consolidacao.provavelmente_mesmo_caso,
          partes_em_comum: consolidacao.partes_em_comum,
          total_conflitos: consolidacao.total_conflitos,
          campos_preenchidos: consolidacao.campos_preenchidos,
          total_campos: consolidacao.total_campos,
        },
      }),
      lote_id,
    ],
  );

  return res.json({
    ok: true,
    lote_id,
    status: novoStatus,
    duracao_consolidacao_ms: duracaoConsolidacao,
    duracao_revisao_ms: duracaoRevisao,
    consolidacao: {
      total_docs: consolidacao.total_docs,
      cnjs_encontrados: consolidacao.cnjs_encontrados,
      cnj_consolidado: consolidacao.cnj_consolidado,
      provavelmente_mesmo_caso: consolidacao.provavelmente_mesmo_caso,
      partes_em_comum: consolidacao.partes_em_comum,
      total_conflitos: consolidacao.total_conflitos,
      campos_preenchidos: consolidacao.campos_preenchidos,
      total_campos: consolidacao.total_campos,
      checklist_consolidado: consolidacao.checklist_consolidado,
    },
    revisor: {
      nivel_atingido: revisao.nivel_atingido,
      decisao: revisao.decisao,
      score: revisao.score,
      justificativa: revisao.justificativa,
      alertas: revisao.alertas,
      knowledge_consultado: revisao.knowledge_consultado,
      cost_usd: revisao.cost_usd,
    },
    next_step:
      novoStatus === "pending_human_review"
        ? "Lote aguardando revisão humana — acessar dashboard admin"
        : `POST /api/v2/lote/${lote_id}/confirmar — usuário confirma para prosseguir enriquecimento`,
  });
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/v2/lote/:lote_id/confirmar — usuário confirma a consolidação
// ══════════════════════════════════════════════════════════════════════════
router.post("/api/v2/lote/:lote_id/confirmar", async (req: Request, res: Response) => {
  const { lote_id } = req.params;

  const lote = await query<any>(
    `SELECT * FROM v2_lotes_analise WHERE lote_id = $1 LIMIT 1`,
    [lote_id],
  );
  if (!lote[0]) return res.status(404).json({ error: "Lote não encontrado" });
  if (!["consolidated", "consolidated_with_alerts"].includes(lote[0].status)) {
    return res.status(400).json({
      error: `Lote em estado '${lote[0].status}' — só pode confirmar após consolidar/revisar`,
      sugestao: `POST /api/v2/lote/${lote_id}/consolidar primeiro`,
    });
  }

  await query(
    `UPDATE v2_lotes_analise SET status = 'confirmed', confirmed_at = NOW() WHERE lote_id = $1`,
    [lote_id],
  );

  return res.json({
    ok: true,
    lote_id,
    status: "confirmed",
    next_step: `POST /api/v2/lote/${lote_id}/enriquecer — dispara F1/F2/F3 + URL oficial para preencher lacunas`,
  });
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/v2/lote/:lote_id/enriquecer — orquestrador aciona F1-F5
// ══════════════════════════════════════════════════════════════════════════
router.post("/api/v2/lote/:lote_id/enriquecer", async (req: Request, res: Response) => {
  const { lote_id } = req.params;

  const lote = await query<any>(
    `SELECT * FROM v2_lotes_analise WHERE lote_id = $1 LIMIT 1`,
    [lote_id],
  );
  if (!lote[0]) return res.status(404).json({ error: "Lote não encontrado" });
  if (lote[0].status !== "confirmed" && req.query.force !== "true") {
    return res.status(400).json({
      error: `Lote em estado '${lote[0].status}' — precisa 'confirmed'. Use ?force=true para sobrescrever.`,
    });
  }

  const checklist: ChecklistConsolidado = lote[0].checklist_consolidado;
  if (!checklist) {
    return res.status(400).json({ error: "Lote sem checklist_consolidado — execute /consolidar primeiro" });
  }

  const consolidacaoMetaRaw = lote[0].alertas_revisor?.consolidacao_meta;
  const consolidacao = {
    total_docs: lote[0].total_docs,
    cnjs_encontrados: consolidacaoMetaRaw?.cnjs_encontrados ?? [],
    cnj_consolidado: lote[0].cnj_consolidado,
    provavelmente_mesmo_caso: consolidacaoMetaRaw?.provavelmente_mesmo_caso ?? true,
    partes_em_comum: consolidacaoMetaRaw?.partes_em_comum ?? [],
    checklist_consolidado: checklist,
    total_conflitos: consolidacaoMetaRaw?.total_conflitos ?? 0,
    campos_preenchidos: consolidacaoMetaRaw?.campos_preenchidos ?? 0,
    total_campos: consolidacaoMetaRaw?.total_campos ?? 0,
  } as any;

  const startMs = Date.now();
  const result = await executarOrquestrador({ checklist, consolidacao });
  const duracaoMs = Date.now() - startMs;

  // Log cada fase no audit log do primeiro doc do lote (referência)
  const docs = await query<any>(
    `SELECT analise_id FROM v2_lote_docs WHERE lote_id = $1 ORDER BY ordem LIMIT 1`,
    [lote_id],
  );
  const primeiroDocId = docs[0]?.analise_id;
  if (primeiroDocId) {
    for (const fase of result.fases_executadas) {
      await query(
        `INSERT INTO v2_audit_log (analise_id, fase, fonte_url, status, confianca, alertas, duracao_ms)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          primeiroDocId,
          fase.fase,
          fase.fontes.join(" | "),
          fase.status,
          fase.confianca,
          JSON.stringify({ motivo: fase.motivo, lote_id }),
          fase.duracao_ms,
        ],
      );
    }
  }

  await query(
    `UPDATE v2_lotes_analise SET
       status = 'enriched',
       alertas_revisor = jsonb_set(
         COALESCE(alertas_revisor, '{}'::jsonb),
         '{enriquecimento}',
         $1::jsonb
       ),
       enriched_at = NOW()
     WHERE lote_id = $2`,
    [JSON.stringify(result), lote_id],
  );

  return res.json({
    ok: true,
    lote_id,
    status: "enriched",
    duracao_total_ms: duracaoMs,
    lacunas_detectadas: result.lacunas_detectadas,
    fases_executadas: result.fases_executadas.map((f) => ({
      fase: f.fase,
      status: f.status,
      confianca: f.confianca,
      duracao_ms: f.duracao_ms,
      fontes: f.fontes,
      total_itens_novos: Object.keys(f.dados_novos).length,
      motivo: f.motivo,
    })),
    itens_preenchidos_por_enriquecimento: result.itens_preenchidos_por_enriquecimento,
    next_step: `GET /api/v2/lote/${lote_id}/relatorio — gera relatório HTML consolidado`,
  });
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/v2/lote/:lote_id/auditar — 3ª camada: Auditor Final do relatório
// Valida o relatório ANTES de entregar ao cliente: incoerências narrativas,
// badges vs conteúdo, somas que não batem, campos vazando, datas ISO cruas.
// ══════════════════════════════════════════════════════════════════════════
router.post("/api/v2/lote/:lote_id/auditar", async (req: Request, res: Response) => {
  const { lote_id } = req.params;
  const pularAI = String(req.query.skip_ai ?? "").toLowerCase() === "true";

  const lote = await query<any>(
    `SELECT * FROM v2_lotes_analise WHERE lote_id = $1 LIMIT 1`,
    [lote_id],
  );
  if (!lote[0]) return res.status(404).json({ error: "Lote não encontrado" });

  const docs = await query<any>(
    `SELECT a.numero_cnj, a.tribunal, a.tipo, a.valor_rs, a.numero_oficio,
            a.credor_nome, a.devedor, a.data_transito,
            a.advogados, a.classificacao_credito, a.beneficiarios_detalhados,
            a.metadados_requisicao, a.validacao_extracao
     FROM v2_lote_docs ld JOIN v2_analises a ON a.id = ld.analise_id
     WHERE ld.lote_id = $1 ORDER BY ld.ordem LIMIT 1`,
    [lote_id],
  );
  if (docs.length === 0) return res.status(404).json({ error: "Lote sem documentos" });
  const d0 = docs[0];

  const chk = lote[0].checklist_consolidado ?? {};
  const revisor = lote[0].alertas_revisor?.resultado_revisor ?? {};
  const benefs = Array.isArray(d0.beneficiarios_detalhados) ? d0.beneficiarios_detalhados : [];
  const cessionarios = benefs.filter((b: any) => /cession/i.test(b?.tipo || "")).length;

  const dto = {
    lote_id,
    tribunal: chk.tribunal?.valor ?? d0.tribunal,
    numero_cnj: chk.numero_cnj?.valor ?? d0.numero_cnj,
    numero_oficio: chk.numero_oficio?.valor ?? d0.numero_oficio,
    valor_rs: chk.valor_rs?.valor ?? d0.valor_rs,
    credor_nome: chk.credor_nome?.valor ?? d0.credor_nome,
    devedor: chk.devedor?.valor ?? d0.devedor,
    data_transito: chk.data_transito?.valor ?? d0.data_transito,
    advogados: d0.advogados,
    classificacao_credito: d0.classificacao_credito,
    beneficiarios_detalhados: benefs,
    metadados_requisicao: d0.metadados_requisicao,
    validacao_extracao: d0.validacao_extracao,
    revisor_decisao: revisor.decisao,
    revisor_score: revisor.score,
    alerta_golpe_cessao: revisor?.complexidade?.alerta_golpe_cessao || null,
    alerta_golpe_cessao_count: cessionarios,
  };

  const auditoria = await auditarRelatorioFinal(dto, { pularAI });

  await query(
    `UPDATE v2_lotes_analise SET auditoria_final = $1::jsonb, audited_at = NOW() WHERE lote_id = $2`,
    [JSON.stringify(auditoria), lote_id],
  );

  return res.json({ ok: true, lote_id, auditoria });
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/v2/lote/:lote_id/relatorio — relatório HTML consolidado
// ══════════════════════════════════════════════════════════════════════════

function fmtDataBR(valor: any): string {
  if (!valor) return "[N/D]";
  const s = String(valor);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function maskValue(valor: any, tipo: "email" | "cpf" | "cnpj" | "telefone" | "nome" | "generic"): string {
  if (valor === null || valor === undefined || valor === "") return "•••";
  const s = String(valor);
  switch (tipo) {
    case "email": {
      const [local, domain] = s.split("@");
      if (!domain) return "•••@•••";
      return `${local.slice(0, 2)}•••@${domain.charAt(0)}•••${domain.slice(domain.lastIndexOf("."))}`;
    }
    case "cpf":
      return s.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, "$1.•••.•••-$4");
    case "cnpj":
      return s.replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})/, "$1.•••.•••/•••• -$5");
    case "telefone":
      return s.replace(/(\d+)(\d{4})/, (_, a) => `${a.slice(0, 2)}•••••-••••`);
    case "nome":
      return s.split(" ").map((w) => (w.length > 2 ? w.charAt(0) + "•".repeat(w.length - 1) : w)).join(" ");
    default:
      return s.length > 4 ? `${s.slice(0, 2)}•••${s.slice(-2)}` : "•••";
  }
}

function renderRelatorioHTML(lote: any, docs: any[], mascarar: boolean): string {
  const chk = lote.checklist_consolidado ?? {};
  const revisor = lote.alertas_revisor?.resultado_revisor ?? {};
  const enriq = lote.alertas_revisor?.enriquecimento ?? {};
  const complexidade = revisor?.complexidade ?? null;
  const auditoriaFinal = lote.auditoria_final ?? null;

  // Primeiro doc como referência dos campos analíticos (advogados,
  // beneficiarios_detalhados, classificacao_credito, metadados_requisicao,
  // validacao_extracao vêm de v2_analises — a query do endpoint agora traz).
  const doc0 = docs[0] ?? {};
  const advogados: any[] = Array.isArray(doc0.advogados) ? doc0.advogados : [];
  const classificacao: any[] = Array.isArray(doc0.classificacao_credito) ? doc0.classificacao_credito : [];
  const beneficiarios: any[] = Array.isArray(doc0.beneficiarios_detalhados) ? doc0.beneficiarios_detalhados : [];
  const metadados: any = doc0.metadados_requisicao ?? {};
  const validacaoExt: any = doc0.validacao_extracao ?? null;

  const get = (campo: string) => chk[campo]?.valor ?? doc0[campo] ?? null;
  const getArr = (campo: string): any[] => {
    const v = chk[campo]?.valor;
    if (Array.isArray(v)) return v;
    if (Array.isArray(doc0[campo])) return doc0[campo];
    return [];
  };
  const fonte = (campo: string) => {
    const fontes = chk[campo]?.fontes ?? [];
    if (fontes.length === 0) return "";
    if (fontes.length === 1) return `📄 ${fontes[0].doc || "doc"}`;
    return `📄 ${fontes.length} docs`;
  };

  const badge = (status: string) => {
    const map: Record<string, string> = {
      aprovado: "badge-ok",
      aprovado_com_ressalva: "badge-warn",
      requer_revisao_humana: "badge-warn",
      rejeitado: "badge-err",
    };
    return `<span class="badge ${map[status] || "badge-neutral"}">${status}</span>`;
  };

  const valorRS = get("valor_rs");
  const fmtBRL = (v: any): string => {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (isNaN(n)) return "—";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };
  const valorRsFmt = valorRS != null
    ? (mascarar ? "R$ •••.•••.•••,••" : fmtBRL(valorRS))
    : "[NÃO IDENTIFICADO]";

  const credorMasc = mascarar ? maskValue(get("credor_nome"), "nome") : (get("credor_nome") ?? "[N/D]");
  const credorCnpjMasc = mascarar ? maskValue(get("credor_cpf_cnpj"), "cnpj") : (get("credor_cpf_cnpj") ?? "[N/D]");

  const partes = getArr("partes");
  const autoridades = getArr("autoridades");
  const datas = getArr("datas_identificadas");
  const processos = getArr("processos_identificados");

  // Banner anti-golpe: se houver cessionários, destacar no topo
  const temCessionarios = beneficiarios.filter((b: any) => /cession/i.test(b?.tipo || "")).length;
  const alertaGolpe = complexidade?.alerta_golpe_cessao || (temCessionarios > 0
    ? `⚠️ ALERTA ANTI-GOLPE: Este crédito possui ${temCessionarios} cessionário(s) parcial(is). O beneficiário principal NÃO detém 100% do valor. Verificar contrato antes de negociar.`
    : null);

  const sinaisComplex = complexidade?.sinais ?? [];
  const complexAlta = complexidade?.nivel === "alta";

  const checksumIcon = (ok: boolean) => ok ? "✅" : "❌";
  const sevBadge = (sev: string) => {
    const m: Record<string, string> = { alta: "badge-err", critica: "badge-err", media: "badge-warn", baixa: "badge-neutral" };
    return `<span class="badge ${m[sev] || "badge-neutral"}">${(sev || "").toUpperCase()}</span>`;
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório AuraLOA — ${lote.lote_id}</title>
<style>
  body { font-family: 'Inter', system-ui, sans-serif; background: #0d1117; color: #e2e8f0; margin: 0; padding: 32px; }
  .container { max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 8px; background: linear-gradient(135deg, #06b6d4, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  h2 { font-size: 16px; margin: 24px 0 12px; color: #22d3ee; border-bottom: 1px solid rgba(34,211,238,0.2); padding-bottom: 6px; }
  .card { background: #162032; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 18px; margin-bottom: 14px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .value { font-size: 14px; color: #e2e8f0; }
  .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .fonte { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 8px 10px; color: #64748b; border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: 500; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); color: #cbd5e1; }
  tr:hover td { background: rgba(34,211,238,0.03); }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 600; border: 1px solid; }
  .badge-ok { background: rgba(16,185,129,0.15); color: #34d399; border-color: rgba(16,185,129,0.3); }
  .badge-warn { background: rgba(251,191,36,0.15); color: #fbbf24; border-color: rgba(251,191,36,0.3); }
  .badge-err { background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.3); }
  .badge-neutral { background: rgba(148,163,184,0.15); color: #94a3b8; border-color: rgba(148,163,184,0.3); }
  .tier-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; margin-left: 8px; }
  .tier-free { background: rgba(34,211,238,0.15); color: #22d3ee; border: 1px solid rgba(34,211,238,0.3); }
  .tier-paid { background: rgba(168,85,247,0.15); color: #c084fc; border: 1px solid rgba(168,85,247,0.3); }
  .alert-danger { background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(251,146,60,0.12)); border: 2px solid #f87171; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
  .alert-warn { background: rgba(251,191,36,0.08); border: 2px solid rgba(251,191,36,0.4); border-radius: 12px; padding: 14px; margin-bottom: 14px; }
  .score-big { font-size: 36px; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
  .lock { color: #fbbf24; }
  .kpi { background: #0f172a; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; text-align: center; }
  .kpi-value { font-size: 22px; font-weight: 700; color: #22d3ee; font-family: 'JetBrains Mono', monospace; }
  .kpi-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .checksum-row { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 0; }
</style>
</head>
<body><div class="container">

<h1>🔍 AuraLOA — Relatório de Análise</h1>
<p style="color:#64748b; font-size:12px;">Lote <span class="mono">${lote.lote_id}</span> · ${lote.total_docs} documento(s) processado(s) · Gerado em ${new Date().toLocaleString("pt-BR")}</p>

${alertaGolpe ? `
<div class="alert-danger">
  <div style="font-size:14px; font-weight:700; color:#f87171; margin-bottom:6px;">🚨 ALERTA ANTI-GOLPE — CRÉDITO CEDIDO PARCIALMENTE</div>
  <div style="font-size:13px; color:#fca5a5; line-height:1.5;">${alertaGolpe}</div>
</div>
` : ""}

${complexAlta ? `
<div class="alert-warn">
  <div style="font-size:13px; font-weight:700; color:#fbbf24; margin-bottom:6px;">⚠️ Documento complexo — revisão humana recomendada</div>
  <ul style="margin:4px 0 0 20px; font-size:12px; color:#fcd34d; line-height:1.6;">
    ${sinaisComplex.map((s: string) => `<li>${s}</li>`).join("")}
  </ul>
  <div style="font-size:11px; color:#94a3b8; margin-top:8px;">A extração foi completa — todos os dados abaixo foram obtidos. Recomenda-se conferência humana por se tratar de caso não-padrão.</div>
</div>
` : ""}

${validacaoExt ? `
<div class="card" style="border-color: ${validacaoExt.score >= 80 ? "rgba(16,185,129,0.3)" : validacaoExt.score >= 60 ? "rgba(251,191,36,0.3)" : "rgba(239,68,68,0.3)"};">
  <div style="display:flex; align-items:center; gap:16px; margin-bottom:12px;">
    <div class="score-big" style="color: ${validacaoExt.score >= 80 ? "#34d399" : validacaoExt.score >= 60 ? "#fbbf24" : "#f87171"};">${validacaoExt.score}<span style="font-size:16px; color:#64748b;">/100</span></div>
    <div style="flex:1;">
      <div style="font-size:14px; font-weight:700;">🛡️ Revisor Pós-Extração</div>
      <div style="font-size:11px; color:#94a3b8;">${validacaoExt.total_alertas} alerta(s) · ${validacaoExt.recomenda_reextrair ? "⚠️ recomenda re-extrair" : "extração aceita"}</div>
    </div>
  </div>
  <div class="grid-2" style="margin-bottom:12px;">
    ${Object.entries(validacaoExt.checksums || {}).map(([k, ok]) =>
      `<div class="checksum-row">${checksumIcon(ok as boolean)} <span style="color:${ok ? "#cbd5e1" : "#f87171"}; text-transform:capitalize;">${k.replace(/_/g, " ")}</span></div>`
    ).join("")}
  </div>
  ${(validacaoExt.alertas && validacaoExt.alertas.length > 0) ? `
  <div style="margin-top:12px;">
    <div class="label">Alertas detectados</div>
    ${validacaoExt.alertas.map((a: any) => `
      <div style="padding:10px; border-left:3px solid ${a.severidade === "alta" || a.severidade === "critica" ? "#f87171" : "#fbbf24"}; background:rgba(255,255,255,0.02); margin-top:8px; border-radius:4px;">
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
          ${sevBadge(a.severidade)} <strong style="font-size:12px;">${a.codigo}</strong> ${a.campo ? `<span style="color:#64748b; font-size:11px;">campo: ${a.campo}</span>` : ""}
        </div>
        <div style="font-size:12px; color:#cbd5e1; line-height:1.5;">${a.descricao}</div>
        ${a.sugestao ? `<div style="font-size:11px; color:#94a3b8; margin-top:4px;">💡 ${a.sugestao}</div>` : ""}
      </div>
    `).join("")}
  </div>
  ` : ""}
</div>
` : ""}

${auditoriaFinal ? `
<div class="card" style="border-color: ${auditoriaFinal.score >= 85 ? "rgba(16,185,129,0.3)" : auditoriaFinal.score >= 70 ? "rgba(251,191,36,0.3)" : "rgba(239,68,68,0.3)"};">
  <div style="display:flex; align-items:center; gap:16px; margin-bottom:12px;">
    <div class="score-big" style="color: ${auditoriaFinal.score >= 85 ? "#34d399" : auditoriaFinal.score >= 70 ? "#fbbf24" : "#f87171"};">${auditoriaFinal.score}<span style="font-size:16px; color:#64748b;">/100</span></div>
    <div style="flex:1;">
      <div style="font-size:14px; font-weight:700;">🎯 Auditor Final do Relatório</div>
      <div style="font-size:11px; color:#94a3b8;">${auditoriaFinal.total_achados} achado(s) · ${
        auditoriaFinal.decisao === "libera_para_cliente" ? "✅ liberado para cliente" :
        auditoriaFinal.decisao === "libera_com_ressalva" ? "⚠️ liberado com ressalva" :
        "🔴 BLOQUEADO — não entregar ao cliente"
      }</div>
    </div>
  </div>
  <div style="font-size:12px; color:#94a3b8; margin-bottom:10px;">${auditoriaFinal.justificativa || ""}</div>
  <div class="grid-2" style="margin-bottom:12px;">
    ${Object.entries(auditoriaFinal.checksums_deterministicos || {}).map(([k, ok]) =>
      `<div class="checksum-row">${checksumIcon(ok as boolean)} <span style="color:${ok ? "#cbd5e1" : "#f87171"}; text-transform:capitalize;">${k.replace(/_/g, " ")}</span></div>`
    ).join("")}
  </div>
  ${(auditoriaFinal.achados && auditoriaFinal.achados.length > 0) ? `
  <div style="margin-top:12px;">
    <div class="label">Achados do auditor</div>
    ${auditoriaFinal.achados.map((a: any) => {
      const cor = a.severidade === "bloqueante" || a.severidade === "alta" ? "#f87171" : a.severidade === "media" ? "#fbbf24" : "#94a3b8";
      return `
      <div style="padding:10px; border-left:3px solid ${cor}; background:rgba(255,255,255,0.02); margin-top:8px; border-radius:4px;">
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
          ${sevBadge(a.severidade)} <strong style="font-size:12px;">${a.codigo}</strong> <span style="color:#64748b; font-size:11px;">em: ${a.onde}</span>
        </div>
        <div style="font-size:12px; color:#cbd5e1; line-height:1.5;">${a.descricao}</div>
        ${a.sugestao ? `<div style="font-size:11px; color:#94a3b8; margin-top:4px;">💡 ${a.sugestao}</div>` : ""}
      </div>`;
    }).join("")}
  </div>
  ` : ""}
</div>
` : ""}

<h2>📋 Identificação do processo ${mascarar ? '<span class="tier-badge tier-free">FREE</span>' : '<span class="tier-badge tier-paid">COMPLETO</span>'}</h2>
<div class="card">
<div class="grid-2">
  <div><div class="label">Tribunal</div><div class="value">${get("tribunal") ?? "[N/D]"}</div><div class="fonte">${fonte("tribunal")}</div></div>
  <div><div class="label">Tipo</div><div class="value">${get("tipo") ?? "[N/D]"}</div></div>
  <div><div class="label">Órgão Julgador</div><div class="value">${get("orgao_julgador") ?? "[N/D]"}</div></div>
  <div><div class="label">Status Processual</div><div class="value">${get("status_processual") ?? "[N/D]"}</div></div>
  <div><div class="label">CNJ Principal</div><div class="value mono">${get("numero_cnj") ?? "[N/D]"}</div></div>
  <div><div class="label">Nº Ofício/Precatório</div><div class="value mono">${get("numero_oficio") ?? "[N/D]"}</div></div>
</div>
</div>

<h2>💰 Valor ${mascarar ? '<span class="tier-badge tier-paid">🔒 PAGO</span>' : ''}</h2>
<div class="card">
<div class="grid-2">
  <div><div class="label">Valor Requisitado</div><div class="value mono" style="font-size:18px; font-weight:700; color:#22d3ee;">${valorRsFmt}</div></div>
  <div><div class="label">Data Trânsito em Julgado</div><div class="value mono">${fmtDataBR(get("data_transito"))}</div></div>
</div>
</div>

<h2>👥 Credor ${mascarar ? '<span class="tier-badge tier-paid">🔒 PAGO</span>' : ''}</h2>
<div class="card">
<div class="grid-2">
  <div><div class="label">Credor Principal</div><div class="value">${credorMasc}</div></div>
  <div><div class="label">CPF/CNPJ</div><div class="value mono">${credorCnpjMasc}</div></div>
  <div><div class="label">Devedor</div><div class="value">${get("devedor") ?? "[N/D]"}</div></div>
</div>
</div>

${classificacao.length > 0 ? `
<h2>📝 Classificação do Crédito por Ofício (${classificacao.length})</h2>
<div class="card">
<table>
<thead><tr><th>Ofício</th><th>Natureza do Crédito</th><th>Código Assunto</th><th>Descrição</th></tr></thead>
<tbody>
${classificacao.map((c: any) => `<tr>
  <td class="mono">${c.oficio || "—"}</td>
  <td>${c.natureza_credito || "—"}</td>
  <td class="mono">${c.natureza_obrigacao_codigo || "—"}</td>
  <td style="font-size:11px;">${c.natureza_obrigacao_descricao || "—"}</td>
</tr>`).join("")}
</tbody></table>
</div>
` : ""}

${metadados && (metadados.especie || metadados.incidentes || metadados.tipo_requisicao || metadados.valor_total_requisitado) ? `
<h2>🎯 Metadados da Requisição</h2>
<div class="card">
<div class="grid-4" style="margin-bottom:12px;">
  <div class="kpi"><div class="kpi-value">${metadados.quantidade_beneficiarios ?? "—"}</div><div class="kpi-label">Beneficiários</div></div>
  <div class="kpi"><div class="kpi-value">${metadados.quantidade_cessionarios ?? "—"}</div><div class="kpi-label">Cessionários</div></div>
  <div class="kpi"><div class="kpi-value" style="font-size:14px;">${mascarar ? "R$ •••" : fmtBRL(metadados.valor_total_principal)}</div><div class="kpi-label">Total Principal</div></div>
  <div class="kpi"><div class="kpi-value" style="font-size:14px;">${mascarar ? "R$ •••" : fmtBRL(metadados.valor_total_juros)}</div><div class="kpi-label">Total Juros</div></div>
</div>
<div class="grid-3">
  <div><div class="label">Espécie</div><div class="value">${metadados.especie || "—"}</div></div>
  <div><div class="label">Tipo de Requisição</div><div class="value">${metadados.tipo_requisicao || "—"}</div></div>
  <div><div class="label">Status Sistema</div><div class="value" style="font-size:12px;">${metadados.status_sistema || "—"}</div></div>
  <div><div class="label">Incidentes</div><div class="value">${metadados.incidentes || "—"}</div></div>
  <div><div class="label">Juros de Mora</div><div class="value" style="font-size:12px;">${metadados.percentual_juros_mora || "—"}</div></div>
  <div><div class="label">Valor Total Requisitado</div><div class="value mono" style="color:#22d3ee; font-weight:700;">${mascarar ? "R$ •••" : fmtBRL(metadados.valor_total_requisitado)}</div></div>
</div>
</div>
` : ""}

${advogados.length > 0 ? `
<h2>👨‍⚖️ Advogados (${advogados.length}) ${mascarar ? '<span class="tier-badge tier-paid">🔒 PAGO</span>' : ''}</h2>
<div class="card">
<table>
<thead><tr><th>Nome</th><th>OAB</th><th>CPF</th><th>Ofício</th></tr></thead>
<tbody>
${advogados.map((a: any) => `<tr>
  <td>${mascarar ? maskValue(a.nome, "nome") : (a.nome || "—")}</td>
  <td class="mono">${a.oab_seccional || "—"}/${a.oab_numero || "—"}</td>
  <td class="mono">${mascarar ? maskValue(a.cpf, "cpf") : (a.cpf || "—")}</td>
  <td class="mono">${a.oficio_referencia || "—"}</td>
</tr>`).join("")}
</tbody></table>
</div>
` : ""}

${beneficiarios.length > 0 ? `
<h2>🧾 Beneficiários Detalhados (${beneficiarios.length}) ${mascarar ? '<span class="tier-badge tier-paid">🔒 PAGO</span>' : ''}</h2>
<div class="card">
<table>
<thead><tr>
  <th>Nome</th><th>CNPJ</th><th>Tipo</th>
  <th style="text-align:right;">Principal</th><th style="text-align:right;">Juros SELIC</th>
  <th style="text-align:right;">Juros Compens.</th><th style="text-align:right;">Total</th>
  <th>Ofício</th>
</tr></thead>
<tbody>
${beneficiarios.map((b: any) => `<tr>
  <td style="font-size:11px;">${mascarar ? maskValue(b.nome, "nome") : (b.nome || "—")}</td>
  <td class="mono" style="font-size:10px;">${mascarar ? "•••" : (b.cnpj || "—")}</td>
  <td>${b.tipo === "principal"
    ? '<span class="badge badge-ok">principal</span>'
    : b.tipo === "cessionario_parcial"
    ? '<span class="badge badge-warn">cessionário</span>'
    : `<span class="badge badge-neutral">${b.tipo || "—"}</span>`}</td>
  <td class="mono" style="text-align:right;">${mascarar ? "•••" : fmtBRL(b.principal)}</td>
  <td class="mono" style="text-align:right;">${mascarar ? "•••" : fmtBRL(b.juros_selic)}</td>
  <td class="mono" style="text-align:right;">${mascarar ? "•••" : fmtBRL(b.juros_compensatorio)}</td>
  <td class="mono" style="text-align:right; color:#22d3ee; font-weight:700;">${mascarar ? "•••" : fmtBRL(b.total)}</td>
  <td class="mono" style="font-size:10px;">${b.oficio_referencia || "—"}</td>
</tr>`).join("")}
</tbody></table>
</div>
` : ""}

<h2>📜 Partes do Processo (${partes.length})</h2>
<div class="card">
<table>
<thead><tr><th>Nome</th><th>Polo</th><th>CPF/CNPJ</th><th>Observação</th></tr></thead>
<tbody>
${partes.map((p: any) => `<tr>
  <td>${mascarar ? maskValue(p?.nome, "nome") : (p?.nome || "—")}</td>
  <td>${p?.polo || "—"}</td>
  <td class="mono">${mascarar ? "•••" : (p?.cpf_cnpj || "—")}</td>
  <td style="color:#64748b; font-size:11px;">${p?.observacao || ""}</td>
</tr>`).join("")}
</tbody></table>
</div>

<h2>⚖️ Autoridades (${autoridades.length})</h2>
<div class="card">
<table>
<thead><tr><th>Nome</th><th>Função</th><th>Órgão</th></tr></thead>
<tbody>
${autoridades.map((a: any) => `<tr>
  <td>${mascarar ? maskValue(a?.nome, "nome") : (a?.nome || "—")}</td>
  <td>${a?.funcao || "—"}</td>
  <td>${a?.orgao || "—"}</td>
</tr>`).join("")}
</tbody></table>
</div>

<h2>📅 Datas (${datas.length})</h2>
<div class="card">
<table>
<thead><tr><th>Data</th><th>Descrição</th></tr></thead>
<tbody>
${datas.map((d: any) => `<tr>
  <td class="mono">${d?.data || "—"}</td>
  <td>${d?.descricao || "—"}</td>
</tr>`).join("")}
</tbody></table>
</div>

<h2>🔗 Processos Identificados (${processos.length})</h2>
<div class="card">
<table>
<thead><tr><th>Número</th><th>Tipo</th><th>Grau</th><th>Tribunal</th></tr></thead>
<tbody>
${processos.map((p: any) => `<tr>
  <td class="mono">${p?.numero || "—"}</td>
  <td>${p?.tipo || "—"}</td>
  <td>${p?.grau || "—"}</td>
  <td>${p?.tribunal || "—"}</td>
</tr>`).join("")}
</tbody></table>
</div>

${enriq.fases_executadas ? `
<h2>🔄 Enriquecimento por fontes externas</h2>
<div class="card">
<table>
<thead><tr><th>Fase</th><th>Status</th><th>Confiança</th><th>Duração</th><th>Itens novos</th></tr></thead>
<tbody>
${(enriq.fases_executadas || []).map((f: any) => `<tr>
  <td class="mono">${f.fase}</td>
  <td>${f.status}</td>
  <td>${f.confianca}</td>
  <td>${f.duracao_ms}ms</td>
  <td>${f.total_itens_novos ?? "—"}</td>
</tr>`).join("")}
</tbody></table>
</div>
` : ""}

<h2>📦 Documentos analisados (${docs.length})</h2>
<div class="card">
<table>
<thead><tr><th>#</th><th>Arquivo</th><th>Natureza</th><th>Páginas</th></tr></thead>
<tbody>
${docs.map((d: any) => `<tr>
  <td>${d.ordem}</td>
  <td style="font-size:11px; color:#94a3b8;">${d.file_original_name}</td>
  <td>${d.natureza_documento || "—"}</td>
  <td>${d.paginas ?? "—"}</td>
</tr>`).join("")}
</tbody></table>
</div>

<p style="margin-top:40px; font-size:10px; color:#475569; text-align:center;">
© 2026 AuraTECH · AuraLOA · Relatório gerado automaticamente<br>
Cadeia de custódia digital — Lei 13.964/2019
</p>

</div></body></html>`;
}

// ══════════════════════════════════════════════════════════════════════════
// GET /api/v2/lote/:lote_id/relatorio.pdf — PDF ABNT (Playwright)
// ══════════════════════════════════════════════════════════════════════════
router.get("/api/v2/lote/:lote_id/relatorio.pdf", async (req: Request, res: Response) => {
  const { lote_id } = req.params;
  const mascararParam = String(req.query.mascarar ?? "").toLowerCase();
  const lote = await query<any>(
    `SELECT * FROM v2_lotes_analise WHERE lote_id = $1 LIMIT 1`, [lote_id],
  );
  if (!lote[0]) return res.status(404).json({ error: "Lote não encontrado" });

  const docs = await query<any>(
    `SELECT ld.ordem,
            a.file_original_name, a.natureza_documento, a.paginas,
            a.numero_cnj, a.tribunal, a.tipo, a.valor_rs,
            a.orgao_julgador, a.status_processual, a.numero_oficio,
            a.credor_nome, a.credor_cpf_cnpj, a.devedor, a.data_transito,
            a.partes, a.autoridades, a.datas_identificadas, a.processos_identificados,
            a.advogados, a.classificacao_credito, a.beneficiarios_detalhados,
            a.metadados_requisicao, a.validacao_extracao
     FROM v2_lote_docs ld JOIN v2_analises a ON a.id = ld.analise_id
     WHERE ld.lote_id = $1 ORDER BY ld.ordem`, [lote_id],
  );

  const mascarar = mascararParam === "true" || (!mascararParam && lote[0].status !== "enriched" && lote[0].status !== "done");
  const html = renderRelatorioHTML(lote[0], docs, mascarar);

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "2cm", bottom: "2cm", left: "3cm", right: "2cm" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8px;color:#666;width:100%;text-align:right;padding-right:2cm;">AuraLOA — Lote ${lote_id}</div>`,
      footerTemplate: `<div style="font-size:8px;color:#666;width:100%;text-align:center;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`,
    });
    await browser.close();

    const filename = `AuraLOA_Relatorio_${lote_id}${mascarar ? "_free" : "_completo"}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error("[PDF ABNT]", err);
    return res.status(500).json({ error: "Falha gerando PDF", detail: err.message });
  }
});

router.get("/api/v2/lote/:lote_id/relatorio", async (req: Request, res: Response) => {
  const { lote_id } = req.params;
  // Por padrão, se o status não é 'enriched' ou 'done', retorna mascarado (tier free).
  // No futuro, checar plano do usuário aqui.
  const mascararParam = String(req.query.mascarar ?? "").toLowerCase();

  const lote = await query<any>(
    `SELECT * FROM v2_lotes_analise WHERE lote_id = $1 LIMIT 1`,
    [lote_id],
  );
  if (!lote[0]) return res.status(404).json({ error: "Lote não encontrado" });

  const docs = await query<any>(
    `SELECT ld.ordem,
            a.file_original_name, a.natureza_documento, a.paginas,
            a.numero_cnj, a.tribunal, a.tipo, a.valor_rs,
            a.orgao_julgador, a.status_processual, a.numero_oficio,
            a.credor_nome, a.credor_cpf_cnpj, a.devedor, a.data_transito,
            a.partes, a.autoridades, a.datas_identificadas, a.processos_identificados,
            a.advogados, a.classificacao_credito, a.beneficiarios_detalhados,
            a.metadados_requisicao, a.validacao_extracao
     FROM v2_lote_docs ld JOIN v2_analises a ON a.id = ld.analise_id
     WHERE ld.lote_id = $1 ORDER BY ld.ordem`,
    [lote_id],
  );

  const mascarar = mascararParam === "true" || (!mascararParam && lote[0].status !== "enriched" && lote[0].status !== "done");
  const html = renderRelatorioHTML(lote[0], docs, mascarar);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(html);
});

export default router;
