import { EvidencePack } from "../../server/services/evidence_pack";
import { runPdfIntakeAdapter } from "../adapters/pdf_intake_adapter";
import {
  classifyPdfDocument,
  type PdfClassificationResult,
} from "../normalization/classify_pdf_document";
import { insertSourceSnapshot } from "../storage/snapshot_store";
import type { AgentContext, AgentResult } from "../runtime/agent_contracts";

const AGENT_NAME = "pdf_intake_agent";
const SOURCE_NAME = "PDF Oficial de Precatórios (Tribunais)";
const SOURCE_KIND = "pdf_oficial";

export interface PdfIntakeRecord {
  intake_mode: string;
  reference_name: string;
  reference_url: string | null;
  reference_sha256: string;
  classification: PdfClassificationResult;
  note: string;
}

export async function runPdfIntakeAgent(
  ctx: AgentContext,
): Promise<AgentResult<PdfIntakeRecord[]>> {
  const started_at = new Date().toISOString();
  const { run_id, process_id_uuid, ente, tribunal_alias, ano_exercicio } = ctx;

  const evidencePack = new EvidencePack(process_id_uuid);
  evidencePack.log(
    `[${AGENT_NAME}] start run_id=${run_id} tribunal=${tribunal_alias ?? "desconhecido"} ` +
    `ano=${ano_exercicio} ente=${ente}`,
  );

  // Monta url_referencia a partir do contexto, se disponível via source_kind payload.
  // O agente aceita url_referencia opcional via ctx.evidence_base_path como convenção de teste.
  const url_referencia =
    ctx.source_kind === "pdf_oficial_ref"
      ? ctx.evidence_base_path
      : undefined;

  try {
    // ── 1. Intake do PDF ou referência controlada ──────────────────────────
    const intakeResult = await runPdfIntakeAdapter({
      tribunal: tribunal_alias,
      ano: ano_exercicio,
      url_referencia,
      evidencePack,
    });

    evidencePack.log(
      `[${AGENT_NAME}] intake ok mode=${intakeResult.intake_mode} ` +
      `sha256=${intakeResult.reference_sha256.slice(0, 16)}...`,
    );

    // ── 2. Classificação heurística ────────────────────────────────────────
    const classification = classifyPdfDocument(intakeResult);

    evidencePack.log(
      `[${AGENT_NAME}] classification doc_type=${classification.document_type} ` +
      `confidence=${classification.confidence_score} ` +
      `signals=${classification.signals_detected.length}`,
    );

    const finished_at = new Date().toISOString();

    // ── 3. Persistência em source_snapshots ────────────────────────────────
    const metadata_json: Record<string, unknown> = {
      intake_mode: intakeResult.intake_mode,
      file_name: intakeResult.file_name,
      reference_url: intakeResult.reference_url,
      document_type: classification.document_type,
      confidence_score: classification.confidence_score,
      signals_count: classification.signals_detected.length,
      signals: classification.signals_detected.map((s) => s.signal),
      classification_note: classification.classification_note,
      status_funcional: classification.document_type !== "desconhecido" ? "PARCIAL" : "NAO_LOCALIZADO",
    };

    await insertSourceSnapshot({
      run_id,
      agent_name: AGENT_NAME,
      source_name: SOURCE_NAME,
      source_url: intakeResult.reference_url ?? undefined,
      ente,
      tribunal_alias: tribunal_alias ?? classification.tribunal_alias ?? undefined,
      ano_exercicio,
      source_kind: SOURCE_KIND,
      raw_payload_path: undefined,
      raw_payload_sha256: intakeResult.reference_sha256,
      normalized_count: 1,
      collected_at: finished_at,
      metadata_json,
    });

    evidencePack.log(
      `[${AGENT_NAME}] snapshot persistido status_funcional=${metadata_json.status_funcional}`,
    );
    evidencePack.saveLog();

    const record: PdfIntakeRecord = {
      intake_mode: intakeResult.intake_mode,
      reference_name: intakeResult.reference_name,
      reference_url: intakeResult.reference_url,
      reference_sha256: intakeResult.reference_sha256,
      classification,
      note: intakeResult.note,
    };

    return {
      ok: true,
      agent_name: AGENT_NAME,
      run_id,
      process_id_uuid,
      source_name: SOURCE_NAME,
      source_url: intakeResult.reference_url ?? undefined,
      started_at,
      finished_at,
      raw_payload_paths: [],
      raw_payload_sha256: intakeResult.reference_sha256,
      normalized_records: 1,
      metrics: {
        total_records: 1,
        intake_mode: intakeResult.intake_mode,
        document_type: classification.document_type,
        confidence_score: classification.confidence_score,
        signals_detected: classification.signals_detected.length,
        status_funcional: metadata_json.status_funcional,
      },
      note: intakeResult.note,
      data: [record],
    };
  } catch (err: unknown) {
    const finished_at = new Date().toISOString();
    const error_message = err instanceof Error ? err.message : String(err);

    evidencePack.log(`[${AGENT_NAME}] ERROR ${error_message}`);
    evidencePack.saveLog();

    return {
      ok: false,
      agent_name: AGENT_NAME,
      run_id,
      process_id_uuid,
      source_name: SOURCE_NAME,
      started_at,
      finished_at,
      raw_payload_paths: [],
      raw_payload_sha256: "",
      normalized_records: 0,
      metrics: { total_records: 0, error: error_message },
      note: `Erro no intake: ${error_message}`,
      data: [],
    };
  }
}
