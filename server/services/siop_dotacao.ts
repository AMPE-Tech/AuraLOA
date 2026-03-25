import type { DotacaoItem } from "../../shared/loa_types";
import { ACOES_PRECATORIOS_UNIAO } from "../catalog/acoes_precatorios_uniao";
import { EvidencePack } from "./evidence_pack";

const PORTAL_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";
const ACAO_PRECATORIO = "0005"; // "SENTENÇAS JUDICIAIS TRANSITADAS EM JULGADO (PRECATÓRIOS)"

function getApiKey(): string {
  return process.env.PORTAL_TRANSPARENCIA_API_KEY || "6081aeff3e70fc8c1fb98be64e427669";
}

function buildHeaders(): Record<string, string> {
  return {
    "chave-api-dados": getApiKey(),
    "Accept": "application/json",
    "User-Agent": "AuraLOA/1.0 (Pesquisa Orcamentaria)",
  };
}

interface FuncionalProgramaticaItem {
  ano?: number;
  acao?: string;
  codigoAcao?: string;
  funcao?: string;
  subfuncao?: string;
  programa?: string;
  empenhado?: string | number;
  liquidado?: string | number;
  pago?: string | number;
  dotacaoInicial?: string | number;
  dotacaoAtualizada?: string | number;
}

// Converte string no formato brasileiro ("1.234,56") ou number para float
function parseBRL(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  // Remove pontos de milhar e substitui vírgula decimal por ponto
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  return parseFloat(normalized) || 0;
}

export async function fetchDotacaoFromSIOP(
  anoExercicio: number,
  evidencePack: EvidencePack
): Promise<DotacaoItem[]> {
  evidencePack.log(`fetchDotacao: fonte indisponível — precatórios federais não consolidados no Portal da Transparência por ação orçamentária. Ano=${anoExercicio}`);

  return ACOES_PRECATORIOS_UNIAO.map(acao => ({
    codigo_acao: acao.codigo_acao,
    descricao_acao: acao.descricao,
    dotacao_inicial: null,
    dotacao_atual: null,
    status: "PARCIAL" as const,
    observacoes: `Dotação orçamentária indisponível via API pública. Precatórios federais são registrados por empenho individual, não consolidados por ação no Portal da Transparência.`,
    evidencias: [{
      source_name: "Portal da Transparência (indisponível)",
      source_url: `${PORTAL_BASE}/despesas/por-funcional-programatica`,
      captured_at_iso: new Date().toISOString(),
      raw_payload_sha256: null,
      raw_payload_path: null,
    }],
  }));
}

function fallbackIndisponivel(
  anoExercicio: number,
  url: string,
  captured_at_iso: string,
  motivo: string
): DotacaoItem[] {
  return ACOES_PRECATORIOS_UNIAO.map(acao => ({
    codigo_acao: acao.codigo_acao,
    descricao_acao: acao.descricao,
    dotacao_inicial: null,
    dotacao_atual: null,
    status: "PARCIAL" as const,
    observacoes: `Fonte indisponível: ${motivo}. Exercício ${anoExercicio}.`,
    evidencias: [{
      source_name: "Portal da Transparência (indisponível)",
      source_url: url,
      captured_at_iso,
      raw_payload_sha256: null,
      raw_payload_path: null,
    }],
  }));
}
