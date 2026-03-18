import type { DotacaoItem } from "../../shared/loa_types";

// asset_key é chave lógica PROVISÓRIA no formato "{ente}:{ano_exercicio}:{codigo_acao}".
// Formalização no esquema canônico PrecatorioMaster está pendente para Bloco D+.
export interface NormalizedDotacaoRecord {
  asset_key: string;
  ente: string;
  ano_exercicio: number;
  codigo_acao: string;
  descricao_acao: string;
  dotacao_inicial: number | null;
  dotacao_atual: number | null;
  status: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
  source_confidence: number;
}

export interface NormalizeDotacaoParams {
  ente: string;
  ano_exercicio: number;
}

function computeConfidence(item: DotacaoItem): number {
  if (item.status === "OK" && item.dotacao_atual !== null) return 0.85;
  if (item.status === "OK" && item.dotacao_inicial !== null) return 0.7;
  if (item.status === "PARCIAL") return 0.4;
  return 0.2;
}

export function normalizeDotacao(
  records: DotacaoItem[],
  params: NormalizeDotacaoParams,
): NormalizedDotacaoRecord[] {
  const { ente, ano_exercicio } = params;

  return records.map((item) => ({
    asset_key: `${ente}:${ano_exercicio}:${item.codigo_acao}`,
    ente,
    ano_exercicio,
    codigo_acao: item.codigo_acao,
    descricao_acao: item.descricao_acao,
    dotacao_inicial: item.dotacao_inicial,
    dotacao_atual: item.dotacao_atual,
    status: item.status,
    source_confidence: computeConfidence(item),
  }));
}
