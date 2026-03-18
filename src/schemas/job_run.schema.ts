export interface JobRunRecord {
  id: string;
  run_id: string;
  process_id_uuid: string;
  job_type: string;
  agent_name: string;
  status: "PENDING" | "RUNNING" | "DONE" | "ERROR";
  priority: number;
  retry_count: number;
  started_at?: string;
  finished_at?: string;
  error_message?: string;
  payload_json: Record<string, unknown>;
  result_json?: Record<string, unknown>;
  created_at: string;
}
