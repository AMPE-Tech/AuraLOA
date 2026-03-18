import { fetchExecucaoFromTransparencia } from "../../server/services/transparencia_execucao";
import type { ExecucaoItem } from "../../shared/loa_types";
import type { EvidencePack } from "../../server/services/evidence_pack";

export interface TransparenciaAdapterParams {
  ano_exercicio: number;
  evidencePack: EvidencePack;
}

export interface TransparenciaAdapterResult {
  records: ExecucaoItem[];
  summary: {
    ano_exercicio: number;
    total_acoes: number;
    acoes_ok: number;
    acoes_parciais: number;
    acoes_nao_localizadas: number;
    status_funcional: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
    tem_api_key: boolean;
    observacoes: string;
  };
  source_url: string;
  raw_payload_paths: string[];
}

const API_BASE_URL = "https://api.portaldatransparencia.gov.br/api-de-dados";

export async function fetchExecucaoAdapter(
  params: TransparenciaAdapterParams,
): Promise<TransparenciaAdapterResult> {
  const { ano_exercicio, evidencePack } = params;
  const tem_api_key = !!process.env.PORTAL_TRANSPARENCIA_API_KEY;

  evidencePack.log(
    `[transparencia_adapter] start ano_exercicio=${ano_exercicio} tem_api_key=${tem_api_key}`,
  );

  const records = await fetchExecucaoFromTransparencia(ano_exercicio, evidencePack);

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

  const observacoes = !tem_api_key
    ? `PORTAL_TRANSPARENCIA_API_KEY ausente. Coleta impossível sem chave. Status funcional: NAO_LOCALIZADO.`
    : `${acoes_ok} ações com dados completos, ${acoes_parciais} parciais, ${acoes_nao_localizadas} não localizadas.`;

  evidencePack.log(
    `[transparencia_adapter] done total=${records.length} ok=${acoes_ok} parcial=${acoes_parciais} ` +
      `nao_loc=${acoes_nao_localizadas} status_funcional=${status_funcional}`,
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
      tem_api_key,
      observacoes,
    },
    source_url: API_BASE_URL,
    raw_payload_paths: unique_paths,
  };
}
