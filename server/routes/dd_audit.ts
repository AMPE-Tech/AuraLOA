/**
 * dd_audit.ts — Rota de consulta aos JSONs de auditoria do pipeline DD
 * ─────────────────────────────────────────────────────────────────────
 * GET /api/dd-audit/list     — lista todos os audits ordenados por timestamp
 * GET /api/dd-audit/:filename — retorna JSON completo de um audit
 */

import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

const router = Router();
const SESSION_SECRET = process.env.SESSION_SECRET || "aura-loa-default-secret-key";
const AUDIT_DIR = path.resolve(__dirname_local, "public", "dd-audit");

function verificarToken(req: Request): boolean {
  const token = req.query["t"] ? String(req.query["t"]) : undefined;
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as any;
    return decoded.dashboardAccess === true;
  } catch {
    return false;
  }
}

interface AuditListItem {
  filename: string;
  timestamp: string;
  precatorio: string;
  tribunal: string;
  valor: number;
  score: number;
  status: string;
  fases_total: number;
  relatorio_url: string | null;
  sha256: string | null;
  ip: string | null;
  checklist: {
    cnj_encontrado: boolean;
    cnpj_entidade: boolean;
    inscrito_loa: boolean;
    match_siop: boolean;
    score_calculado: boolean;
    portal_transparencia: boolean;
    datajud_consultado: boolean;
    tribunal_consultado: boolean;
    robo_pje: boolean;
    cnpj_verificado: boolean;
    contatos_encontrados: boolean;
    relatorio_gerado: boolean;
    sha256_presente: boolean;
    credor_identificado: boolean;
  };
}

function buildChecklist(data: any): AuditListItem["checklist"] {
  const fases = data.fases || {};
  const result = data.result || {};
  const audit = data._audit || {};

  return {
    cnj_encontrado: result.cnj_encontrado != null && result.cnj_encontrado !== "",
    cnpj_entidade: !!(fases.fase0_enriquecimento?.dados?.cnpj_entidade),
    inscrito_loa: fases.fase1b_loa?.status === "ok",
    match_siop: fases.fase1c_siop?.status === "ok",
    score_calculado: fases.fase2b_score?.status === "ok",
    portal_transparencia: fases.fase5c_portal?.status === "ok",
    datajud_consultado: fases.fase1_datajud?.status === "ok",
    tribunal_consultado: fases.fase3_tribunal?.status !== "erro",
    robo_pje: fases.fase4b_robo_pje?.status === "ok",
    cnpj_verificado: fases.fase5b_cnpj?.status === "ok",
    contatos_encontrados: (fases.fase6b_contatos?.dados?.total_com_contato || 0) > 0,
    relatorio_gerado: !!(audit.relatorio_url),
    sha256_presente: !!(audit.sha256),
    credor_identificado:
      (fases.fase6b_contatos?.dados?.socios?.length || 0) > 0 ||
      !!(result.credor_verificado),
  };
}

function parseAuditFile(filename: string): AuditListItem | null {
  try {
    const filePath = path.join(AUDIT_DIR, filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    const audit = data._audit || {};
    const request = data.request || {};
    const result = data.result || {};
    const fases = data.fases || {};

    const fasesTotal = Object.keys(fases).length;

    return {
      filename,
      timestamp: audit.timestamp || result.timestamp || "",
      precatorio: request.numero_precatorio || result.precatorio?.numero || "",
      tribunal: request.tribunal || result.precatorio?.tribunal_alias || "",
      valor: request.valor || result.precatorio?.valor || 0,
      score: result.score_final ?? 0,
      status: result.status_final || "DESCONHECIDO",
      fases_total: fasesTotal,
      relatorio_url: audit.relatorio_url || result.relatorio_url || null,
      sha256: audit.sha256 || null,
      ip: audit.ip || null,
      checklist: buildChecklist(data),
    };
  } catch (err: any) {
    console.error(`[DD Audit] Erro ao parsear ${filename}:`, err.message);
    return null;
  }
}

// GET /api/dd-audit/list
router.get("/api/dd-audit/list", (req: Request, res: Response) => {
  if (!verificarToken(req)) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  try {
    if (!fs.existsSync(AUDIT_DIR)) {
      return res.json([]);
    }

    const files = fs.readdirSync(AUDIT_DIR).filter((f) => f.endsWith(".json"));
    const items: AuditListItem[] = [];

    for (const file of files) {
      const item = parseAuditFile(file);
      if (item) {
        items.push(item);
      }
    }

    // Ordenar por timestamp (mais recente primeiro)
    items.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime() || 0;
      const tb = new Date(b.timestamp).getTime() || 0;
      return tb - ta;
    });

    return res.json(items);
  } catch (err: any) {
    console.error("[DD Audit] Erro ao listar audits:", err.message);
    return res.status(500).json({ error: "Erro ao listar auditorias", details: err.message });
  }
});

// GET /api/dd-audit/:filename
router.get("/api/dd-audit/:filename", (req: Request, res: Response) => {
  try {
    const filename = req.params.filename as string;

    // Prevenir path traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Nome de arquivo invalido" });
    }

    const filePath = path.join(AUDIT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Arquivo de auditoria nao encontrado" });
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return res.json(data);
  } catch (err: any) {
    console.error("[DD Audit] Erro ao ler audit:", err.message);
    return res.status(500).json({ error: "Erro ao ler auditoria", details: err.message });
  }
});

export default router;
