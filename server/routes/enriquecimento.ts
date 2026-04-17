/**
 * enriquecimento.ts — Endpoints para enriquecimento de contatos
 *
 * Usado pelo validador-dados.html (aba "Buscar CNPJ" → botão "Enriquecer Sócio")
 * e pelo pipeline DD.
 *
 * Rotas:
 *   POST /api/enriquecimento/pessoa   → busca email/tel/linkedin de 1 pessoa
 *   POST /api/enriquecimento/cnpj     → busca dados completos CNPJ + QSA
 *   POST /api/enriquecimento/lote     → enriquece várias pessoas em lote
 */

import { Router, type Request, type Response } from "express";
import { searchGoogleContacts } from "../services/contact_enrichment";
import { consultarCNPJ, determinarStatusEmpresa } from "../services/apollo_enrichment";

const router = Router();

// ── POST /api/enriquecimento/pessoa ────────────────────────────────────────

router.post("/api/enriquecimento/pessoa", async (req: Request, res: Response) => {
  const { nome, empresa, tipo, oab } = req.body as {
    nome: string;
    empresa?: string;
    tipo?: "socio" | "advogado";
    oab?: string;
  };

  if (!nome || nome.trim().length < 3) {
    return res.status(400).json({ error: "Nome é obrigatório (mínimo 3 caracteres)" });
  }

  const contexto = tipo === "advogado"
    ? `advogado OAB ${oab || ""} escritório`
    : empresa
      ? `sócio ${empresa}`
      : "";

  const inicio = Date.now();
  const result = await searchGoogleContacts(nome, contexto);
  const duracao = Date.now() - inicio;

  return res.json({
    nome,
    tipo: tipo || "pessoa",
    contexto,
    encontrado: !!(result.email_encontrado || result.linkedin_url || result.telefone_encontrado || result.site),
    email: result.email_encontrado,
    telefone: result.telefone_encontrado,
    linkedin_url: result.linkedin_url,
    site: result.site,
    snippets: result.snippets,
    fonte: "serper.dev (Google)",
    duracao_ms: duracao,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /api/enriquecimento/cnpj ──────────────────────────────────────────

router.post("/api/enriquecimento/cnpj", async (req: Request, res: Response) => {
  const { cnpj } = req.body as { cnpj: string };
  if (!cnpj) return res.status(400).json({ error: "CNPJ é obrigatório" });

  const data = await consultarCNPJ(cnpj);
  if (!data) {
    return res.status(404).json({ error: "CNPJ não encontrado na Receita Federal" });
  }

  return res.json({
    cnpj: data.cnpj,
    razao_social: data.razao_social,
    nome_fantasia: data.nome_fantasia,
    status: determinarStatusEmpresa(data),
    situacao_cadastral: data.descricao_situacao_cadastral,
    situacao_especial: data.situacao_especial,
    capital_social: data.capital_social,
    natureza_juridica: data.natureza_juridica,
    porte: data.porte,
    data_inicio_atividade: data.data_inicio_atividade,
    cnae: data.cnae_fiscal_descricao,
    endereco: [data.logradouro, data.numero, data.bairro, data.municipio, data.uf, data.cep].filter(Boolean).join(", "),
    telefone: data.ddd_telefone_1,
    email: data.email,
    qsa: data.qsa,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /api/enriquecimento/lote ──────────────────────────────────────────
// Enriquece múltiplas pessoas em paralelo (max 10 para não estourar API)

router.post("/api/enriquecimento/lote", async (req: Request, res: Response) => {
  const { pessoas, empresa } = req.body as {
    pessoas: Array<{ nome: string; tipo?: string; oab?: string }>;
    empresa?: string;
  };

  if (!Array.isArray(pessoas) || pessoas.length === 0) {
    return res.status(400).json({ error: "Lista de pessoas é obrigatória" });
  }

  const limitadas = pessoas.slice(0, 10); // máximo 10 por chamada

  const resultados = await Promise.all(
    limitadas.map(async (p) => {
      const contexto = p.tipo === "advogado"
        ? `advogado OAB ${p.oab || ""} escritório`
        : empresa
          ? `sócio ${empresa}`
          : "";
      const r = await searchGoogleContacts(p.nome, contexto);
      return {
        nome: p.nome,
        tipo: p.tipo || "pessoa",
        email: r.email_encontrado,
        telefone: r.telefone_encontrado,
        linkedin_url: r.linkedin_url,
        site: r.site,
      };
    }),
  );

  const encontrados = resultados.filter((r) => r.email || r.telefone || r.linkedin_url || r.site).length;

  return res.json({
    total: resultados.length,
    encontrados,
    cobertura_pct: Math.round((encontrados / resultados.length) * 100),
    resultados,
    timestamp: new Date().toISOString(),
  });
});

export default router;
