import { Router, Request, Response } from "express";
import { query } from "../db";
import { requireAuth } from "./auth";

const router = Router();

type StatusPrecatorio =
  | "pesquisado"
  | "aprovado"
  | "verificar"
  | "suspeito"
  | "proposta_enviada"
  | "aguardando_vendedor"
  | "aguardando_comprador"
  | "analise_interna"
  | "fechado"
  | "cancelado";

function mapStatus(dbStatus: string | null): StatusPrecatorio {
  switch ((dbStatus ?? "").toUpperCase()) {
    case "APROVADO":  return "aprovado";
    case "VERIFICAR": return "verificar";
    case "SUSPEITO":  return "suspeito";
    default:          return "pesquisado";
  }
}

/**
 * GET /api/dashboard/precatorios
 * Retorna histórico de validações do usuário autenticado.
 * Lê de document_validations — dados reais do banco.
 */
router.get("/api/dashboard/precatorios", requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await query<{
      uuid: string;
      numero_cnj: string | null;
      tribunal: string | null;
      valor_rs: string | null;
      status: string;
      score: number;
      credor_nome: string | null;
      created_at: string;
    }>(
      `SELECT uuid, numero_cnj, tribunal, valor_rs, status, score, credor_nome, created_at
       FROM document_validations
       ORDER BY created_at DESC
       LIMIT 200`
    );

    const precatorios = rows.map((r) => ({
      id: r.uuid,
      numero_cnj: r.numero_cnj ?? "—",
      tribunal: r.tribunal ?? "Desconhecido",
      valor_face: r.valor_rs ? parseFloat(r.valor_rs.replace(/[^\d.]/g, "")) || null : null,
      valor_negociado: null,
      status: mapStatus(r.status),
      data_consulta: r.created_at,
      data_atualizacao: r.created_at,
      score_autenticidade: r.score,
      tipo: "DESCONHECIDO" as const,
      credor_nome: r.credor_nome ?? null,
      proposta_comercial: false,
      negocio_fechado: false,
    }));

    return res.json(precatorios);
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao buscar precatórios", error: err.message });
  }
});

export default router;
