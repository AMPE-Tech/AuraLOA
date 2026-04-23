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
// GET /api/v2/lote/:lote_id/relatorio — relatório HTML consolidado
// ══════════════════════════════════════════════════════════════════════════

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
  const meta = lote.alertas_revisor?.consolidacao_meta ?? {};

  const get = (campo: string) => chk[campo]?.valor ?? null;
  const getArr = (campo: string): any[] => (Array.isArray(chk[campo]?.valor) ? chk[campo].valor : []);
  const fonte = (campo: string) => {
    const fontes = chk[campo]?.fontes ?? [];
    if (fontes.length === 0) return "";
    if (fontes.length === 1) return `📄 ${fontes[0].doc || "doc"}`;
    return `📄 ${fontes.length} docs`;
  };

  const badge = (status: string) => {
    const map: Record<string, string> = {
      aprovado: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      aprovado_com_ressalva: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      requer_revisao_humana: "bg-orange-500/20 text-orange-300 border-orange-500/40",
      rejeitado: "bg-red-500/20 text-red-300 border-red-500/40",
    };
    return `<span class="px-2 py-0.5 rounded text-[11px] border ${map[status] || "bg-slate-500/20 text-slate-300"}">${status}</span>`;
  };

  const valorRS = get("valor_rs");
  const valorRsFmt = valorRS != null
    ? (mascarar ? "R$ •••.•••.•••,••" : Number(valorRS).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
    : "[NÃO IDENTIFICADO]";

  const credorMasc = mascarar ? maskValue(get("credor_nome"), "nome") : (get("credor_nome") ?? "[N/D]");
  const credorCnpjMasc = mascarar ? maskValue(get("credor_cpf_cnpj"), "cnpj") : (get("credor_cpf_cnpj") ?? "[N/D]");

  const partes = getArr("partes");
  const autoridades = getArr("autoridades");
  const datas = getArr("datas_identificadas");
  const processos = getArr("processos_identificados");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório AuraLOA — ${lote.lote_id}</title>
<style>
  body { font-family: 'Inter', system-ui, sans-serif; background: #0d1117; color: #e2e8f0; margin: 0; padding: 32px; }
  .container { max-width: 1080px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 8px; background: linear-gradient(135deg, #06b6d4, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  h2 { font-size: 16px; margin: 24px 0 12px; color: #22d3ee; border-bottom: 1px solid rgba(34,211,238,0.2); padding-bottom: 6px; }
  .card { background: #162032; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 18px; margin-bottom: 14px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .value { font-size: 14px; color: #e2e8f0; }
  .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .fonte { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 6px 10px; color: #64748b; border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: 500; }
  td { padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); color: #cbd5e1; }
  .tier-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; margin-left: 8px; }
  .tier-free { background: rgba(34,211,238,0.15); color: #22d3ee; border: 1px solid rgba(34,211,238,0.3); }
  .tier-paid { background: rgba(168,85,247,0.15); color: #c084fc; border: 1px solid rgba(168,85,247,0.3); }
  .lock { color: #fbbf24; }
</style>
</head>
<body><div class="container">

<h1>🔍 AuraLOA — Relatório de Análise</h1>
<p style="color:#64748b; font-size:12px;">Lote <span class="mono">${lote.lote_id}</span> · ${lote.total_docs} documentos processados · Gerado em ${new Date().toLocaleString("pt-BR")}</p>

<div class="card">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
    <strong style="font-size:14px;">Revisão</strong>
    ${badge(revisor.decisao || "—")} <span style="color:#64748b; font-size:11px;">score ${revisor.score ?? "—"}/100 · nível ${revisor.nivel_atingido ?? "—"}</span>
  </div>
  <div style="font-size:12px; color:#94a3b8;">${revisor.justificativa || "—"}</div>
</div>

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
  <div><div class="label">Data Trânsito em Julgado</div><div class="value mono">${get("data_transito") ?? "[N/D]"}</div></div>
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
    `SELECT ld.ordem, a.file_original_name, a.natureza_documento, a.paginas
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
