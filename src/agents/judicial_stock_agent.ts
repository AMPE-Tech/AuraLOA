import { EvidencePack } from "../../server/services/evidence_pack";
import { CLASSE_PRECATORIO, CLASSE_RPV } from "../../server/services/estoque_datajud";
import { fetchJudicialStockFromDataJud } from "../adapters/datajud_adapter";
import {
  normalizeJudicialStock,
  type NormalizedJudicialRecord,
} from "../normalization/normalize_judicial_stock";
import { insertSourceSnapshot } from "../storage/snapshot_store";
import type { AgentContext, AgentResult } from "../runtime/agent_contracts";

const AGENT_NAME = "judicial_stock_agent";
const SOURCE_NAME = "DataJud CNJ";
const SOURCE_KIND = "api_datajud";

export async function runJudicialStockAgent(
  ctx: AgentContext,
): Promise<AgentResult<NormalizedJudicialRecord[]>> {
  const started_at = new Date().toISOString();
  const { run_id, process_id_uuid, ente, tribunal_alias, ano_exercicio } = ctx;
  const tribunal = tribunal_alias ?? "trf6";

  const evidencePack = new EvidencePack(process_id_uuid);
  evidencePack.log(
    `[${AGENT_NAME}] start run_id=${run_id} tribunal=${tribunal} ano=${ano_exercicio}`,
  );

  const classe_codigos = [CLASSE_PRECATORIO, CLASSE_RPV];
  const max_results = ctx.source_kind === "test" ? 10 : 500;

  let raw_payload_sha256 = "";
  let raw_payload_paths: string[] = [];
  let normalized: NormalizedJudicialRecord[] = [];
  let source_url = "";

  try {
    const adapterResult = await fetchJudicialStockFromDataJud({
      tribunal_alias: tribunal,
      classe_codigos,
      ano_exercicio,
      max_results,
      evidencePack,
    });

    source_url = adapterResult.source_url;
    raw_payload_sha256 = adapterResult.raw_payload_sha256;
    raw_payload_paths = adapterResult.raw_payload_paths;

    normalized = normalizeJudicialStock(adapterResult.processos, {
      ente,
      tribunal_alias: tribunal,
      ano_exercicio,
    });

    const finished_at = new Date().toISOString();

    await insertSourceSnapshot({
      run_id,
      agent_name: AGENT_NAME,
      source_name: SOURCE_NAME,
      source_url: source_url || undefined,
      ente,
      tribunal_alias: tribunal,
      ano_exercicio,
      source_kind: SOURCE_KIND,
      raw_payload_path: raw_payload_paths[0] ?? undefined,
      raw_payload_sha256: raw_payload_sha256 || undefined,
      normalized_count: normalized.length,
      collected_at: finished_at,
      metadata_json: adapterResult.summary as Record<string, unknown>,
    });

    evidencePack.log(
      `[${AGENT_NAME}] snapshot persistido normalized_count=${normalized.length}`,
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
        precatorios: adapterResult.summary.precatorios,
        rpvs: adapterResult.summary.rpvs,
        outros: adapterResult.summary.outros,
        status_fonte: adapterResult.summary.status,
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
      tribunal_alias: tribunal,
      ano_exercicio,
      source_kind: SOURCE_KIND,
      raw_payload_path: undefined,
      raw_payload_sha256: undefined,
      normalized_count: 0,
      collected_at: finished_at,
      metadata_json: { error: err.message, status: "ERRO" },
    }).catch(() => {});

    throw err;
  }
}
