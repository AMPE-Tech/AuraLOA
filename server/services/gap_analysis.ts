import type {
  GapAcaoItem,
  CruzamentoAcaoItem,
  EstoqueSummaryByTribunal,
} from "../../shared/loa_types";
import { ACOES_PRECATORIOS_UNIAO } from "../catalog/acoes_precatorios_uniao";

export interface GapAnalysisInput {
  cruzamento: CruzamentoAcaoItem[];
  estoque_por_tribunal: EstoqueSummaryByTribunal[];
  estoque_total_processos: number;
  estoque_total_precatorios: number;
  estoque_total_rpvs: number;
}

export interface GapAnalysisOutput {
  por_acao: GapAcaoItem[];
  totais: {
    dotacao_total: number | null;
    pago_total: number | null;
    empenhado_total: number | null;
    estoque_total_processos: number;
    estoque_total_precatorios: number;
    estoque_total_rpvs: number;
    gap_dotacao_vs_pago: number | null;
    cobertura_pct: number | null;
  };
  status_geral: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
}

export function computeGapAnalysis(input: GapAnalysisInput): GapAnalysisOutput {
  const { cruzamento, estoque_por_tribunal, estoque_total_processos, estoque_total_precatorios, estoque_total_rpvs } = input;

  const fonteEstoque = estoque_total_processos > 0 ? "CNJ DataJud" : "Indisponivel";

  const por_acao: GapAcaoItem[] = ACOES_PRECATORIOS_UNIAO.map((acao) => {
    const cruz = cruzamento.find((c) => c.codigo_acao === acao.codigo_acao);

    const dotAtual = cruz?.dotacao_atual ?? null;
    const totalPago = cruz?.pago_final ?? null;
    const totalEmp = cruz?.empenhado_final ?? null;

    let gapDotVsPago: number | null = null;
    if (dotAtual !== null && totalPago !== null) {
      gapDotVsPago = dotAtual - totalPago;
    }

    let coberturaPct: number | null = null;
    if (dotAtual !== null && dotAtual > 0 && totalPago !== null) {
      coberturaPct = (totalPago / dotAtual) * 100;
    } else if (totalEmp !== null && totalEmp > 0 && totalPago !== null) {
      coberturaPct = (totalPago / totalEmp) * 100;
    }

    const hasDot = dotAtual !== null;
    const hasExec = totalPago !== null || totalEmp !== null;
    const hasEstoque = estoque_total_processos > 0;

    let status: "OK" | "PARCIAL" | "NAO_LOCALIZADO" = "OK";
    if (!hasDot && !hasExec && !hasEstoque) status = "NAO_LOCALIZADO";
    else if (!hasDot || !hasExec || !hasEstoque) status = "PARCIAL";

    return {
      codigo_acao: acao.codigo_acao,
      descricao_acao: acao.descricao,
      dotacao_atual: dotAtual,
      total_pago: totalPago,
      total_empenhado: totalEmp,
      estoque_processos: estoque_total_processos,
      estoque_precatorios: estoque_total_precatorios,
      estoque_rpvs: estoque_total_rpvs,
      gap_dotacao_vs_pago: gapDotVsPago,
      cobertura_pct: coberturaPct,
      fonte_dotacao: cruz?.fonte_dotacao ?? "Indisponivel",
      fonte_execucao: cruz?.fonte_execucao ?? "Indisponivel",
      fonte_estoque: fonteEstoque,
      status,
    };
  });

  let dotTotal: number | null = null;
  let pagoTotal: number | null = null;
  let empTotal: number | null = null;

  for (const item of por_acao) {
    if (item.dotacao_atual !== null) dotTotal = (dotTotal ?? 0) + item.dotacao_atual;
    if (item.total_pago !== null) pagoTotal = (pagoTotal ?? 0) + item.total_pago;
    if (item.total_empenhado !== null) empTotal = (empTotal ?? 0) + item.total_empenhado;
  }

  let gapTotal: number | null = null;
  if (dotTotal !== null && pagoTotal !== null) {
    gapTotal = dotTotal - pagoTotal;
  }

  let coberturaTotal: number | null = null;
  if (dotTotal !== null && dotTotal > 0 && pagoTotal !== null) {
    coberturaTotal = (pagoTotal / dotTotal) * 100;
  } else if (empTotal !== null && empTotal > 0 && pagoTotal !== null) {
    coberturaTotal = (pagoTotal / empTotal) * 100;
  }

  const allNAO = por_acao.every((a) => a.status === "NAO_LOCALIZADO");
  const allOK = por_acao.every((a) => a.status === "OK");

  return {
    por_acao,
    totais: {
      dotacao_total: dotTotal,
      pago_total: pagoTotal,
      empenhado_total: empTotal,
      estoque_total_processos,
      estoque_total_precatorios,
      estoque_total_rpvs,
      gap_dotacao_vs_pago: gapTotal,
      cobertura_pct: coberturaTotal,
    },
    status_geral: allNAO ? "NAO_LOCALIZADO" : allOK ? "OK" : "PARCIAL",
  };
}
