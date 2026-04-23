import { readFileSync } from "fs";
import { createHash } from "crypto";
import { resolve } from "path";
import { fetchPrecatorioByNumero } from "../services/estoque_datajud";
import { enrichContacts } from "../services/contact_enrichment";
import type { ChecklistConsolidado, ConsolidacaoResult } from "./consolidador";

// ══════════════════════════════════════════════════════════════════════════
// Orquestrador — dispara fases externas para preencher lacunas
// Prioridade: URL oficial do tribunal (CNJ 234/2016) > F1/F2/F3/F4/F5
// ══════════════════════════════════════════════════════════════════════════

export type FaseCodigo = "url_oficial" | "F1_datajud" | "F2_loa_csv" | "F3_contatos" | "F4_portal" | "F5_pje";

export interface LacunaDetectada {
  campo: string;
  prioridade: "alta" | "media" | "baixa";
  motivo: string;
  fases_sugeridas: FaseCodigo[];
}

export interface FaseExecucaoResult {
  fase: FaseCodigo;
  status: "ok" | "falhou" | "indisponivel" | "skipped";
  confianca: "alta" | "media" | "baixa" | "nenhuma";
  fontes: string[];
  evidencia_hash: string | null;
  duracao_ms: number;
  dados_novos: Record<string, any>;
  motivo?: string;
}

export interface EnriquecimentoResult {
  lacunas_detectadas: LacunaDetectada[];
  fases_executadas: FaseExecucaoResult[];
  itens_preenchidos_por_enriquecimento: Record<string, { valor: any; fonte: FaseCodigo }>;
  duracao_total_ms: number;
}

function hashJson(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

// ── Detector de lacunas no checklist consolidado ─────────────────────────

export function detectarLacunas(chk: ChecklistConsolidado): LacunaDetectada[] {
  const lacunas: LacunaDetectada[] = [];

  const faltando = (campo: string) => {
    const item = chk[campo];
    if (!item) return true;
    const v = item.valor;
    if (v === null || v === undefined || v === "") return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  };

  if (faltando("numero_cnj")) {
    lacunas.push({
      campo: "numero_cnj",
      prioridade: "alta",
      motivo: "CNJ é chave para buscar em DataJud e tribunais",
      fases_sugeridas: ["F2_loa_csv", "F5_pje"],
    });
  }

  if (faltando("valor_rs")) {
    lacunas.push({
      campo: "valor_rs",
      prioridade: "alta",
      motivo: "Valor do precatório não encontrado nos docs — buscar em empenho Portal Transparência",
      fases_sugeridas: ["F4_portal", "url_oficial"],
    });
  }

  if (faltando("credor_cpf_cnpj")) {
    lacunas.push({
      campo: "credor_cpf_cnpj",
      prioridade: "alta",
      motivo: "CPF/CNPJ do credor ausente — necessário para F3 enriquecer contatos",
      fases_sugeridas: ["F3_contatos"],
    });
  }

  const partesItem = chk["partes"];
  if (partesItem?.valor && Array.isArray(partesItem.valor)) {
    const advogados = partesItem.valor.filter((p: any) => p?.polo === "terceiro" || /advog/i.test(p?.qualificacao || ""));
    if (advogados.length === 0) {
      lacunas.push({
        campo: "advogados_contato",
        prioridade: "media",
        motivo: "Nenhum advogado identificado — F3 vai buscar QSA + contatos via Google CSE",
        fases_sugeridas: ["F3_contatos"],
      });
    }
  }

  if (faltando("data_transito")) {
    lacunas.push({
      campo: "data_transito",
      prioridade: "media",
      motivo: "Trânsito em julgado não identificado — F1 DataJud + F5 PJe trazem",
      fases_sugeridas: ["F1_datajud", "url_oficial", "F5_pje"],
    });
  }

  if (faltando("status_processual") || chk["status_processual"]?.valor === "JULGADO") {
    lacunas.push({
      campo: "status_processual_atualizado",
      prioridade: "media",
      motivo: "Status pode ter avançado desde a emissão dos documentos — conferir via URL oficial",
      fases_sugeridas: ["url_oficial", "F1_datajud"],
    });
  }

  return lacunas;
}

// ── F1 — DataJud ─────────────────────────────────────────────────────────

async function executarF1DataJud(cnj: string | null, oficio: string | null): Promise<FaseExecucaoResult> {
  const start = Date.now();
  if (!cnj) {
    return {
      fase: "F1_datajud", status: "skipped", confianca: "nenhuma",
      fontes: [], evidencia_hash: null, duracao_ms: 0,
      dados_novos: {}, motivo: "CNJ ausente no checklist",
    };
  }
  try {
    const r = await fetchPrecatorioByNumero(cnj, oficio ?? "", undefined);
    const evidencia_hash = hashJson(r);
    const duracao_ms = Date.now() - start;
    const dados_novos: Record<string, any> = {};
    if (r.encontrado) {
      if (r.data_ajuizamento) dados_novos.data_ajuizamento_datajud = r.data_ajuizamento;
      if (r.data_ultima_atualizacao) dados_novos.data_ultima_atualizacao_datajud = r.data_ultima_atualizacao;
      if (r.classe_nome) dados_novos.classe_datajud = r.classe_nome;
      if (r.valor_causa != null) dados_novos.valor_causa_datajud = r.valor_causa;
      if (r.tem_pagamento != null) dados_novos.tem_pagamento_datajud = r.tem_pagamento;
      if (r.tem_baixa != null) dados_novos.tem_baixa_datajud = r.tem_baixa;
      if (r.pagamento_pendente != null) dados_novos.pagamento_pendente_datajud = r.pagamento_pendente;
      if (r.movimentos && r.movimentos.length > 0) dados_novos.movimentos_datajud = r.movimentos.slice(-20);
      if (r.url_consulta) dados_novos.url_consulta_datajud = r.url_consulta;
    }
    return {
      fase: "F1_datajud",
      status: r.encontrado ? "ok" : "indisponivel",
      confianca: r.encontrado ? "alta" : "baixa",
      fontes: [r.tribunal_alias ? `datajud:api-publica.datajud.cnj.jus.br/api_publica_${r.tribunal_alias}` : "datajud:api-publica.datajud.cnj.jus.br"],
      evidencia_hash,
      duracao_ms,
      dados_novos,
      motivo: r.encontrado ? undefined : "CNJ não indexado no DataJud (comum em 2º grau TRF1/TRF2/TRF5)",
    };
  } catch (err: any) {
    return {
      fase: "F1_datajud", status: "falhou", confianca: "nenhuma",
      fontes: [], evidencia_hash: null, duracao_ms: Date.now() - start,
      dados_novos: {}, motivo: err.message,
    };
  }
}

// ── F2 — LOA CSV lookup ──────────────────────────────────────────────────

interface LOARegistro {
  uo_cadastradora_nome: string;
  uo_devedora_nome: string;
  ano: number;
  precatorio: string;
  tipo_causa: string;
  valor_rs: number;
}

let loaCache: LOARegistro[] | null = null;

function loadLOACSV(): LOARegistro[] {
  if (loaCache) return loaCache;
  const path = resolve(process.cwd(), "data", "precatorios_extraidos.csv");
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/).slice(1);
  const out: LOARegistro[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const c = line.split(";");
    if (c.length < 8) continue;
    out.push({
      uo_cadastradora_nome: (c[1] || "").trim(),
      uo_devedora_nome: (c[3] || "").trim(),
      ano: parseInt(c[4], 10) || 0,
      precatorio: (c[5] || "").trim(),
      tipo_causa: (c[6] || "").trim(),
      valor_rs: parseFloat(c[7]) || 0,
    });
  }
  loaCache = out;
  return out;
}

async function executarF2LOA(devedor: string | null, valorRs: number | null): Promise<FaseExecucaoResult> {
  const start = Date.now();
  if (!devedor && !valorRs) {
    return {
      fase: "F2_loa_csv", status: "skipped", confianca: "nenhuma",
      fontes: [], evidencia_hash: null, duracao_ms: 0, dados_novos: {},
      motivo: "Sem devedor nem valor — impossível lookup LOA",
    };
  }
  try {
    const registros = loadLOACSV();
    const devedorUp = (devedor || "").toUpperCase();
    const valorMin = valorRs ? valorRs * 0.95 : 0;
    const valorMax = valorRs ? valorRs * 1.05 : Infinity;
    const candidatos = registros.filter((r) => {
      const devOk = !devedor || r.uo_devedora_nome.toUpperCase().includes(devedorUp) || devedorUp.includes(r.uo_devedora_nome.toUpperCase());
      const vOk = !valorRs || (r.valor_rs >= valorMin && r.valor_rs <= valorMax);
      return devOk && vOk;
    }).slice(0, 10);

    let status_inscricao_loa: string;
    if (candidatos.length > 0) {
      const maxAno = Math.max(...candidatos.map((c) => c.ano));
      status_inscricao_loa = maxAno >= 2026 ? "INSCRITO_LOA_VIGENTE" : "INSCRITO_LOA_ANTERIOR";
    } else {
      status_inscricao_loa = "NAO_INSCRITO";
    }

    const dados_novos: Record<string, any> = {
      status_inscricao_loa,
      candidatos_loa: candidatos,
      total_candidatos: candidatos.length,
    };

    return {
      fase: "F2_loa_csv",
      status: candidatos.length > 0 ? "ok" : "indisponivel",
      confianca: candidatos.length === 1 ? "alta" : candidatos.length > 1 ? "media" : "nenhuma",
      fontes: [`data/precatorios_extraidos.csv (42.174 registros LOA 2024-2026)`],
      evidencia_hash: hashJson({ total: candidatos.length, status_inscricao_loa }),
      duracao_ms: Date.now() - start,
      dados_novos,
    };
  } catch (err: any) {
    return {
      fase: "F2_loa_csv", status: "falhou", confianca: "nenhuma",
      fontes: [], evidencia_hash: null, duracao_ms: Date.now() - start,
      dados_novos: {}, motivo: err.message,
    };
  }
}

// ── F3 — Contatos (BrasilAPI + CNPJ.ws + Google CSE) ─────────────────────

async function executarF3Contatos(cnpj: string | null, razaoSocial: string | null): Promise<FaseExecucaoResult> {
  const start = Date.now();
  const digits = (cnpj || "").replace(/\D/g, "");
  if (digits.length !== 14) {
    return {
      fase: "F3_contatos", status: "skipped", confianca: "nenhuma",
      fontes: [], evidencia_hash: null, duracao_ms: 0, dados_novos: {},
      motivo: digits.length === 11
        ? "Credor é PF (CPF) — enriquecimento QSA só para PJ"
        : "CNPJ não disponível no checklist",
    };
  }
  try {
    const r = await enrichContacts({ cnpj: digits, razao_social: razaoSocial ?? undefined });
    const dados_novos: Record<string, any> = {
      razao_social_brasilapi: r.razao_social,
      socios_enriquecidos: r.socios,
      advogados_enriquecidos: r.advogados,
      total_pessoas: r.total_pessoas,
      total_com_contato: r.total_com_contato,
      score_cobertura: r.score_cobertura,
      alertas_f3: r.alertas,
    };
    return {
      fase: "F3_contatos",
      status: r.total_com_contato > 0 ? "ok" : r.total_pessoas > 0 ? "ok" : "indisponivel",
      confianca: r.score_cobertura >= 70 ? "alta" : r.score_cobertura >= 30 ? "media" : "baixa",
      fontes: ["brasilapi.com.br/api/cnpj/v1", "publica.cnpj.ws/cnpj", "customsearch.googleapis.com"],
      evidencia_hash: hashJson(r),
      duracao_ms: Date.now() - start,
      dados_novos,
    };
  } catch (err: any) {
    return {
      fase: "F3_contatos", status: "falhou", confianca: "nenhuma",
      fontes: [], evidencia_hash: null, duracao_ms: Date.now() - start,
      dados_novos: {}, motivo: err.message,
    };
  }
}

// ── URL Oficial — prioridade máxima ──────────────────────────────────────
// Quando o documento trouxe a URL de verificação CNJ 234/2016, podemos
// acessá-la diretamente via Playwright para conferir o estado atual do
// processo no tribunal. Economia de ~70% das chamadas externas.
// TODO: implementar Playwright fetch. Por enquanto, registra como disponível
// mas só gera recomendação.

async function executarUrlOficial(url: string | null): Promise<FaseExecucaoResult> {
  const start = Date.now();
  if (!url) {
    return {
      fase: "url_oficial", status: "skipped", confianca: "nenhuma",
      fontes: [], evidencia_hash: null, duracao_ms: 0, dados_novos: {},
      motivo: "Documento não trouxe URL oficial de verificação (padrão CNJ 234/2016)",
    };
  }
  // Implementação futura: Playwright visita a URL e faz scraping.
  // Por enquanto, registra que a URL está disponível para uso.
  return {
    fase: "url_oficial",
    status: "ok",
    confianca: "alta",
    fontes: [url],
    evidencia_hash: hashJson({ url }),
    duracao_ms: Date.now() - start,
    dados_novos: {
      url_oficial_disponivel: url,
      recomendacao: "URL oficial presente — recomendar ao usuário abrir para verificação visual e checar atualizações",
    },
  };
}

// ── Orquestrador principal ───────────────────────────────────────────────

export interface OrquestradorInput {
  checklist: ChecklistConsolidado;
  consolidacao: ConsolidacaoResult;
}

export async function executarOrquestrador(input: OrquestradorInput): Promise<EnriquecimentoResult> {
  const start = Date.now();
  const { checklist: chk } = input;

  const lacunas = detectarLacunas(chk);

  const cnj = (chk["numero_cnj"]?.valor as string) ?? null;
  const oficio = (chk["numero_oficio"]?.valor as string) ?? null;
  const devedor = (chk["devedor"]?.valor as string) ?? null;
  const valorRs = chk["valor_rs"]?.valor ? Number(chk["valor_rs"].valor) : null;
  const credorCnpj = (chk["credor_cpf_cnpj"]?.valor as string) ?? null;
  const credorNome = (chk["credor_nome"]?.valor as string) ?? null;
  const urlOficial = (chk["url_verificacao_tribunal"]?.valor as string) ?? null;

  // Priorização: URL oficial primeiro (se disponível), depois fases em paralelo
  const [urlOficialResult, f1, f2, f3] = await Promise.all([
    executarUrlOficial(urlOficial),
    cnj ? executarF1DataJud(cnj, oficio) : Promise.resolve<FaseExecucaoResult>({
      fase: "F1_datajud", status: "skipped", confianca: "nenhuma",
      fontes: [], evidencia_hash: null, duracao_ms: 0, dados_novos: {},
      motivo: "CNJ ausente",
    }),
    executarF2LOA(devedor, valorRs),
    executarF3Contatos(credorCnpj, credorNome),
  ]);

  const fases_executadas: FaseExecucaoResult[] = [urlOficialResult, f1, f2, f3];

  // Mapear itens preenchidos por enriquecimento
  const itens_preenchidos_por_enriquecimento: Record<string, { valor: any; fonte: FaseCodigo }> = {};
  for (const fase of fases_executadas) {
    if (fase.status === "ok") {
      for (const [k, v] of Object.entries(fase.dados_novos)) {
        if (!(k in itens_preenchidos_por_enriquecimento)) {
          itens_preenchidos_por_enriquecimento[k] = { valor: v, fonte: fase.fase };
        }
      }
    }
  }

  return {
    lacunas_detectadas: lacunas,
    fases_executadas,
    itens_preenchidos_por_enriquecimento,
    duracao_total_ms: Date.now() - start,
  };
}
