export interface SourceSnapshotRecord {
  id?: number;
  run_id: string;
  agent_name: string;
  source_name: string;
  source_url?: string;
  ente?: string;
  tribunal_alias?: string;
  ano_exercicio?: number;
  source_kind: string;
  raw_payload_path?: string;
  raw_payload_sha256?: string;
  normalized_count: number;
  collected_at: string;
  metadata_json?: Record<string, unknown>;
}
