import { Router, type Request, type Response } from "express";
import { createRequire } from "module";
import { resolve } from "path";
import { statSync, unlinkSync, existsSync, readFileSync } from "fs";
import { randomBytes } from "crypto";
import { query } from "../db";
import { uploadPdfV2, renameToContentHash } from "./upload_config";
import { extractFields } from "./field_extractor";

function cleanupTmp(path?: string) {
  if (path && existsSync(path)) {
    try { unlinkSync(path); } catch { /* ignore */ }
  }
}

const require = createRequire(resolve(process.cwd(), "package.json"));
const _pdfParseModule = require("pdf-parse");
const pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number }> =
  typeof _pdfParseModule === "function"
    ? _pdfParseModule
    : _pdfParseModule?.default ?? _pdfParseModule;

const router = Router();

function generateValidationId(): string {
  return randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
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
  const used = rows[0]?.count ?? 1;
  return { allowed: used <= limit, used };
}

router.post(
  "/api/v2/analise",
  uploadPdfV2.single("file"),
  async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado. Envie 'file' como multipart/form-data." });
      }

      const lgpdConsent = String(req.body?.lgpd_consent ?? "").toLowerCase();
      if (lgpdConsent !== "true" && lgpdConsent !== "1" && lgpdConsent !== "sim") {
        cleanupTmp(req.file.path);
        return res.status(400).json({
          error: "Consentimento LGPD obrigatório. Envie 'lgpd_consent=true'.",
        });
      }

      const { allowed, used } = await checkDailyRateLimit(ip, 5);
      if (!allowed) {
        cleanupTmp(req.file.path);
        return res.status(429).json({
          error: "Limite diário de análises gratuitas atingido. Cadastre-se para ilimitadas.",
          limite_diario: 5,
          utilizadas: used,
        });
      }

      const { finalPath, sha256 } = renameToContentHash(req.file.path);
      const fileStats = statSync(finalPath);

      const fileBuffer = (await import("fs")).readFileSync(finalPath);
      const parsed = await pdfParse(fileBuffer).catch((err) => {
        console.warn(`[V2] pdf-parse falhou: ${err.message}`);
        return { text: "", numpages: 0 };
      });

      const charsExtraidos = parsed.text.length;
      const paginas = parsed.numpages;
      const extractionMethod = charsExtraidos < 500 ? "pdf-parse-failed-needs-ocr" : "pdf-parse";

      const validationId = generateValidationId();
      const insert = await query<{ id: string }>(
        `INSERT INTO v2_analises (
           validation_id,
           file_sha256, file_path, file_size_bytes, file_original_name,
           paginas, chars_extraidos, ocr_usado, extraction_method,
           lgpd_consent_at, lgpd_consent_ip, lgpd_consent_user_agent
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11)
         RETURNING id`,
        [
          validationId,
          sha256,
          finalPath,
          fileStats.size,
          req.file.originalname,
          paginas,
          charsExtraidos,
          false,
          extractionMethod,
          ip,
          userAgent,
        ],
      );

      return res.json({
        ok: true,
        validation_id: validationId,
        analise_id: insert[0].id,
        sha256,
        paginas,
        chars_extraidos: charsExtraidos,
        extraction_method: extractionMethod,
        needs_ocr: charsExtraidos < 500,
        rate_limit: { utilizadas: used, limite_diario: 5 },
        next_step: "POST /api/v2/analise/:validation_id/extrair (B2)",
      });
    } catch (err: any) {
      cleanupTmp(req.file?.path);
      console.error("[V2 /analise] erro:", err);
      return res.status(500).json({ error: err.message || "Erro ao processar upload" });
    }
  },
);

// ── B2: extração estruturada via Claude Haiku 4.5 ───────────────────────────
router.post("/api/v2/analise/:validation_id/extrair", async (req: Request, res: Response) => {
  const { validation_id } = req.params;
  const force = String(req.query.force ?? "").toLowerCase() === "true";

  const rows = await query<any>(
    `SELECT id, file_path, chars_extraidos, numero_cnj, extracted_at
     FROM v2_analises WHERE validation_id = $1 LIMIT 1`,
    [validation_id],
  );
  if (!rows[0]) {
    return res.status(404).json({ error: "Análise não encontrada" });
  }
  const analise = rows[0];

  if (analise.numero_cnj && !force) {
    return res.json({
      ok: true,
      status: "already_extracted",
      message: "Documento já foi extraído. Use ?force=true para reprocessar.",
      extracted_at: analise.extracted_at,
    });
  }

  if (!existsSync(analise.file_path)) {
    return res.status(410).json({ error: "Arquivo não existe mais em disco", file_path: analise.file_path });
  }

  let textoPdfParse = "";
  try {
    const pdfBuffer = readFileSync(analise.file_path);
    const parsed = await pdfParse(pdfBuffer).catch(() => ({ text: "", numpages: 0 }));
    textoPdfParse = parsed.text ?? "";
  } catch (err: any) {
    console.warn(`[V2 extrair] pdf-parse falhou: ${err.message}`);
  }

  const startMs = Date.now();
  let extraction;
  try {
    extraction = await extractFields(analise.file_path, textoPdfParse);
  } catch (err: any) {
    console.error(`[V2 extrair] Haiku falhou:`, err);
    return res.status(502).json({ error: "Falha na extração via Claude Haiku", detail: err.message });
  }
  const duracaoMs = Date.now() - startMs;

  const { fields, checklist, method, tokens_input, tokens_output, cost_usd } = extraction;

  await query(
    `UPDATE v2_analises SET
       numero_cnj = $1, numero_oficio = $2, tribunal = $3, tipo = $4,
       credor_nome = $5, credor_cpf_cnpj = $6, devedor = $7, valor_rs = $8,
       data_transito = $9, orgao_julgador = $10,
       url_verificacao_tribunal = $11, qrcode_tribunal = $12, codigo_verificador = $13,
       checklist_auditoria = $14::jsonb,
       extraction_method = $15,
       extraction_tokens_input = $16, extraction_tokens_output = $17, extraction_cost_usd = $18,
       extracted_at = NOW(), updated_at = NOW()
     WHERE id = $19`,
    [
      fields.numero_cnj, fields.numero_oficio, fields.tribunal, fields.tipo,
      fields.credor_nome, fields.credor_cpf_cnpj, fields.devedor, fields.valor_rs,
      fields.data_transito, fields.orgao_julgador,
      fields.url_verificacao_tribunal, fields.qrcode_tribunal, fields.codigo_verificador,
      JSON.stringify(checklist),
      method,
      tokens_input, tokens_output, cost_usd,
      analise.id,
    ],
  );

  const urlEncontrada = !!fields.url_verificacao_tribunal;
  await query(
    `INSERT INTO v2_audit_log (analise_id, fase, fonte_url, status, confianca, alertas, duracao_ms)
     VALUES ($1, 'fase_extracao_haiku', $2, 'ok', $3, $4::jsonb, $5)`,
    [
      analise.id,
      `anthropic://${method}`,
      fields.numero_cnj ? "alta" : fields.tribunal ? "media" : "baixa",
      JSON.stringify({
        url_oficial_no_oficio: urlEncontrada,
        qr_oficial_no_oficio: !!fields.qrcode_tribunal,
        codigo_verificador_no_oficio: !!fields.codigo_verificador,
      }),
      duracaoMs,
    ],
  );

  return res.json({
    ok: true,
    validation_id,
    method,
    duracao_ms: duracaoMs,
    tokens: { input: tokens_input, output: tokens_output },
    cost_usd: Number(cost_usd.toFixed(6)),
    cost_brl_aprox: Number((cost_usd * 5.5).toFixed(4)),
    fields,
    checklist,
    economia_b3: urlEncontrada ? "URL oficial no ofício — B3 pula descoberta de tribunal" : null,
  });
});

router.get("/api/v2/analise/:validation_id", async (req: Request, res: Response) => {
  const { validation_id } = req.params;
  const rows = await query<any>(
    `SELECT id, validation_id, file_sha256, file_size_bytes, paginas, chars_extraidos,
            ocr_usado, extraction_method, numero_cnj, numero_oficio, tribunal, tipo,
            credor_nome, devedor, valor_rs, tier_preco, status_pagamento,
            auditoria_score, created_at
     FROM v2_analises WHERE validation_id = $1 LIMIT 1`,
    [validation_id],
  );
  if (!rows[0]) {
    return res.status(404).json({ error: "Análise não encontrada" });
  }
  return res.json(rows[0]);
});

export default router;
