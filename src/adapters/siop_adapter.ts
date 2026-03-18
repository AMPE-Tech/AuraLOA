import { fetchDotacaoFromSIOP } from "../../server/services/siop_dotacao";
import type { DotacaoItem } from "../../shared/loa_types";
import type { EvidencePack } from "../../server/services/evidence_pack";

export interface SiopAdapterParams {
  ano_exercicio: number;
  evidencePack: EvidencePack;
}

export interface SiopAdapterResult {
  records: DotacaoItem[];
  summary: {
    ano_exercicio: number;
    total_acoes: number;
    acoes_ok: number;
    acoes_parciais: number;
    acoes_nao_localizadas: number;
    status_funcional: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
    observacoes: string;
  };
  source_url: string;
  raw_payload_paths: string[];
}

const ORCAMENTO_SPARQL_URL = "http://orcamento.dados.gov.br/sparql";

export async function fetchDotacaoAdapter(
  params: SiopAdapterParams,
): Promise<SiopAdapterResult> {
  const { ano_exercicio, evidencePack } = params;

  evidencePack.log(
    `[siop_adapter] start ano_exercicio=${ano_exercicio}`,
  );

  const records = await fetchDotacaoFromSIOP(ano_exercicio, evidencePack);

  const acoes_ok = records.filter((r) => r.status === "OK").length;
  const acoes_parciais = records.filter((r) => r.status === "PARCIAL").length;
  const acoes_nao_localizadas = records.filter((r) => r.status === "NAO_LOCALIZADO").length;

  let status_funcional: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
  if (acoes_ok === records.length && records.length > 0) {
    status_funcional = "OK";
  } else if (acoes_ok === 0 && acoes_parciais === 0) {
    status_funcional = "NAO_LOCALIZADO";
  } else {
    status_funcional = "PARCIAL";
  }

  const raw_payload_paths = records
    .flatMap((r) => r.evidencias.map((e) => e.raw_payload_path))
    .filter((p): p is string => p !== null && p !== undefined);

  const unique_paths = [...new Set(raw_payload_paths)];

  const observacoes =
    status_funcional === "PARCIAL" && ano_exercicio > 2016
      ? `Endpoints SPARQL públicos cobrem apenas até ~2016. SIOP SPARQL bloqueado externamente para ${ano_exercicio}. Status funcional: PARCIAL — limitação conhecida da fonte.`
      : `${acoes_ok} ações com dados completos, ${acoes_parciais} parciais, ${acoes_nao_localizadas} não localizadas.`;

  evidencePack.log(
    `[siop_adapter] done total=${records.length} ok=${acoes_ok} parcial=${acoes_parciais} nao_loc=${acoes_nao_localizadas} status_funcional=${status_funcional}`,
  );

  return {
    records,
    summary: {
      ano_exercicio,
      total_acoes: records.length,
      acoes_ok,
      acoes_parciais,
      acoes_nao_localizadas,
      status_funcional,
      observacoes,
    },
    source_url: ORCAMENTO_SPARQL_URL,
    raw_payload_paths: unique_paths,
  };
}
