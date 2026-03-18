import { EvidencePack } from "../../server/services/evidence_pack";
import { fetchExecucaoAdapter } from "../adapters/transparencia_adapter";
import {
  normalizeExecucao,
  type NormalizedExecucaoRecord,
} from "../normalization/normalize_execucao";
import { insertSourceSnapshot } from "../storage/snapshot_store";
import type { AgentContext, AgentResult } from "../runtime/agent_contracts";

const AGENT_NAME = "execution_finance_agent";
const SOURCE_NAME = "Portal da Transparencia REST API";
const SOURCE_KIND = "api_execucao_financeira";

export async function runExecutionFinanceAgent(
  ctx: AgentContext,
): Promise<AgentResult<NormalizedExecucaoRecord[]>> {
  const started_at = new Date().toISOString();
  const { run_id, process_id_uuid, ente, ano_exercicio } = ctx;

  const evidencePack = new EvidencePack(process_id_uuid);
  evidencePack.log(
    `[${AGENT_NAME}] start run_id=${run_id} ente=${ente} ano=${ano_exercicio}`,
  );

  let normalized: NormalizedExecucaoRecord[] = [];
  let source_url = "";
  let raw_payload_paths: string[] = [];
  let raw_payload_sha256 = "";

  try {
    const adapterResult = await fetchExecucaoAdapter({ ano_exercicio, evidencePack });

    source_url = adapterResult.source_url;
    raw_payload_paths = adapterResult.raw_payload_paths;
    raw_payload_sha256 =
      adapterResult.records.find((r) => r.evidencias[0]?.raw_payload_sha256)
        ?.evidencias[0]?.raw_payload_sha256 ?? "";

    normalized = normalizeExecucao(adapterResult.records, { ente, ano_exercicio });

    const finished_at = new Date().toISOString();

    await insertSourceSnapshot({
      run_id,
      agent_name: AGENT_NAME,
      source_name: SOURCE_NAME,
      source_url: source_url || undefined,
      ente,
      tribunal_alias: undefined,
      ano_exercicio,
      source_kind: SOURCE_KIND,
      raw_payload_path: raw_payload_paths[0] ?? undefined,
      raw_payload_sha256: raw_payload_sha256 || undefined,
      normalized_count: normalized.length,
      collected_at: finished_at,
      metadata_json: adapterResult.summary as Record<string, unknown>,
    });

    evidencePack.log(
      `[${AGENT_NAME}] snapshot persistido normalized_count=${normalized.length} ` +
        `status_funcional=${adapterResult.summary.status_funcional}`,
    );
    evidencePack.saveLog();

    return {
      ok: true,
      agent_name: AGENT_NAME,
      run_id,
      process_id_uuid,
      source_name: SOURCE_NAME,
      source_url,
      started_at,
      finished_at,
      raw_payload_paths,
      raw_payload_sha256,
      normalized_records: normalized.length,
      metrics: {
        total_records: normalized.length,
        acoes_ok: adapterResult.summary.acoes_ok,
        acoes_parciais: adapterResult.summary.acoes_parciais,
        acoes_nao_localizadas: adapterResult.summary.acoes_nao_localizadas,
        status_funcional: adapterResult.summary.status_funcional,
        tem_api_key: adapterResult.summary.tem_api_key,
        observacoes: adapterResult.summary.observacoes,
      },
      data: normalized,
    };
  } catch (err: any) {
    const finished_at = new Date().toISOString();
    evidencePack.log(`[${AGENT_NAME}] ERRO: ${err.message}`);
    evidencePack.saveLog();

    await insertSourceSnapshot({
      run_id,
      agent_name: AGENT_NAME,
      source_name: SOURCE_NAME,
      source_url: source_url || undefined,
      ente,
      tribunal_alias: undefined,
      ano_exercicio,
      source_kind: SOURCE_KIND,
      raw_payload_path: undefined,
      raw_payload_sha256: undefined,
      normalized_count: 0,
      collected_at: finished_at,
      metadata_json: { error: err.message, status_funcional: "NAO_LOCALIZADO" },
    }).catch(() => {});

    throw err;
  }
}
