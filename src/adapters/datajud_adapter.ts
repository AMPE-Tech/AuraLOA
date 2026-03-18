import {
  fetchEstoqueFromDataJud,
  type DataJudFetchOptions,
  CLASSE_PRECATORIO,
  CLASSE_RPV,
} from "../../server/services/estoque_datajud";
import type { EstoqueProcesso } from "../../shared/loa_types";

export type { DataJudFetchOptions };

export interface DataJudAdapterResult {
  processos: EstoqueProcesso[];
  summary: {
    tribunal_alias: string;
    total: number;
    precatorios: number;
    rpvs: number;
    outros: number;
    status: string;
    observacoes: string;
  };
  source_url: string;
  raw_payload_sha256: string;
  raw_payload_paths: string[];
}

export async function fetchJudicialStockFromDataJud(
  params: DataJudFetchOptions,
): Promise<DataJudAdapterResult> {
  const { tribunal_alias, classe_codigos, ano_exercicio, max_results, evidencePack } = params;

  evidencePack.log(
    `[datajud_adapter] start tribunal=${tribunal_alias} ano=${ano_exercicio} ` +
      `classes=[${classe_codigos.join(",")}] max=${max_results}`,
  );

  const result = await fetchEstoqueFromDataJud(params);

  const precatorios = result.processos.filter((p) => p.classe_codigo === CLASSE_PRECATORIO).length;
  const rpvs = result.processos.filter((p) => p.classe_codigo === CLASSE_RPV).length;
  const outros = result.processos.length - precatorios - rpvs;

  evidencePack.log(
    `[datajud_adapter] done total=${result.processos.length} precatorios=${precatorios} ` +
      `rpvs=${rpvs} status=${result.summary.status}`,
  );

  const source_url = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal_alias}/_search`;
  const raw_payload_sha256 = result.evidences[0]?.raw_payload_sha256 ?? "";
  const raw_payload_paths = result.evidences.map((e) => e.raw_payload_path).filter(Boolean);

  return {
    processos: result.processos,
    summary: {
      tribunal_alias,
      total: result.processos.length,
      precatorios,
      rpvs,
      outros,
      status: result.summary.status,
      observacoes: result.summary.observacoes ?? "",
    },
    source_url,
    raw_payload_sha256,
    raw_payload_paths,
  };
}
