import { opencrawlConfig } from "../config/opencrawl_config";
import type { OpenCrawlRequest, OpenCrawlResponse } from "./opencrawl_contract";

// Execution modes que indicam que a fonte já possui agente nativo aprovado.
// Essas fontes nunca devem ser desviadas para OpenCrawl nesta etapa.
const NATIVE_AGENT_MODES = new Set(["existing_api_agent", "existing_sparql_agent"]);

// Execution modes que indicam que a fonte é candidata futura ao OpenCrawl.
const FUTURE_MODES = new Set([
  "future_pdf_agent",
  "future_html_agent",
  "future_csv_agent",
  "future_zip_agent",
]);

export function executeOpenCrawlBridge(request: OpenCrawlRequest): OpenCrawlResponse {
  // ── Guarda 1: fonte com agente nativo → rejected (independente da flag) ──
  if (NATIVE_AGENT_MODES.has(request.execution_mode)) {
    return {
      ok: false,
      status: "rejected",
      execution_mode: request.execution_mode,
      message: `Fonte "${request.source_name}" já possui agente nativo aprovado (${request.target_agent}). Não deve usar OpenCrawl nesta etapa. Use o agente nativo via job_runner.`,
      blocked_reason: `Agente nativo ativo: ${request.target_agent} / job_type: ${request.target_job_type}`,
      metadata: {
        source_name: request.source_name,
        native_agent: request.target_agent,
        native_job_type: request.target_job_type,
      },
    };
  }

  // ── Guarda 2: OpenCrawl desabilitado → disabled ─────────────────────────
  if (!opencrawlConfig.enabled) {
    return {
      ok: false,
      status: "disabled",
      execution_mode: request.execution_mode,
      message: `OpenCrawl está desabilitado por padrão. Fonte "${request.source_name}" não pode ser processada agora.`,
      blocked_reason: opencrawlConfig.observacao,
      dry_run: false,
      metadata: {
        source_name: request.source_name,
        source_kind: request.source_kind,
        config_mode: opencrawlConfig.mode,
      },
    };
  }

  // ── Guarda 3: fonte futura + OpenCrawl habilitado → planned ─────────────
  // (hipotético — este bloco não ativa execução real)
  if (FUTURE_MODES.has(request.execution_mode)) {
    return {
      ok: false,
      status: "planned",
      execution_mode: request.execution_mode,
      message: `Fonte "${request.source_name}" é candidata futura ao OpenCrawl, mas o agente alvo (${request.target_agent}) ainda não está implementado. Roteamento declarativo registrado.`,
      dry_run: true,
      metadata: {
        source_name: request.source_name,
        source_kind: request.source_kind,
        target_agent: request.target_agent,
        target_job_type: request.target_job_type,
      },
    };
  }

  // ── Fallback: estado não reconhecido ────────────────────────────────────
  return {
    ok: false,
    status: "rejected",
    execution_mode: request.execution_mode,
    message: `Execution mode "${request.execution_mode}" não reconhecido pela bridge OpenCrawl.`,
    blocked_reason: "execution_mode desconhecido",
  };
}
