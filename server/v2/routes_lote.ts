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
import { loadLoteDocs, consolidarLote } from "./consolidador";
import { revisarConsolidacao } from "./revisor";

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

  const startRevisao = Date.now();
  const revisao = await revisarConsolidacao(consolidacao);
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

export default router;
