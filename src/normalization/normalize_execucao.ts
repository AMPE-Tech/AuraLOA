import type { ExecucaoItem } from "../../shared/loa_types";

// asset_key é chave lógica PROVISÓRIA no formato "{ente}:{ano_exercicio}:{codigo_acao}".
// Formalização no esquema canônico PrecatorioMaster está pendente para Bloco D+.
export interface NormalizedExecucaoRecord {
  asset_key: string;
  ente: string;
  ano_exercicio: number;
  codigo_acao: string;
  descricao_acao: string;
  empenhado: number | null;
  liquidado: number | null;
  pago: number | null;
  status: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
  source_confidence: number;
}

export interface NormalizeExecucaoParams {
  ente: string;
  ano_exercicio: number;
}

function computeConfidence(item: ExecucaoItem): number {
  if (item.status === "OK" && item.pago !== null) return 0.9;
  if (item.status === "OK" && item.liquidado !== null) return 0.75;
  if (item.status === "OK") return 0.6;
  if (item.status === "PARCIAL") return 0.4;
  return 0.2;
}

export function normalizeExecucao(
  records: ExecucaoItem[],
  params: NormalizeExecucaoParams,
): NormalizedExecucaoRecord[] {
  const { ente, ano_exercicio } = params;

  return records.map((item) => ({
    asset_key: `${ente}:${ano_exercicio}:${item.codigo_acao}`,
    ente,
    ano_exercicio,
    codigo_acao: item.codigo_acao,
    descricao_acao: item.descricao_acao,
    empenhado: item.empenhado,
    liquidado: item.liquidado,
    pago: item.pago,
    status: item.status,
    source_confidence: computeConfidence(item),
  }));
}
