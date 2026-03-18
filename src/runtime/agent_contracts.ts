export interface AgentContext {
  run_id: string;
  process_id_uuid: string;
  ente: string;
  ente_sigla?: string;
  tribunal_alias?: string;
  ano_exercicio: number;
  source_kind: string;
  priority: number;
  retry_count: number;
  evidence_base_path: string;
}

export interface AgentResult<T = unknown> {
  ok: boolean;
  agent_name: string;
  run_id: string;
  process_id_uuid: string;
  source_name: string;
  source_url?: string;
  started_at: string;
  finished_at: string;
  raw_payload_paths: string[];
  raw_payload_sha256: string;
  normalized_records: number;
  metrics: Record<string, unknown>;
  note?: string;
  data?: T;
}
