import type { SourceKind } from "../catalog/source_kinds";
import type { JobType } from "./job_types";
import type { ExecutionMode } from "../catalog/auraloa_sources";

export type OpenCrawlStatus =
  | "disabled"
  | "planned"
  | "ready_for_future_integration"
  | "rejected";

export interface OpenCrawlRequest {
  source_name: string;
  source_kind: SourceKind;
  target_agent: string;
  target_job_type: JobType;
  execution_mode: ExecutionMode;
  payload: Record<string, unknown>;
  run_id?: string;
  process_id_uuid?: string;
}

export interface OpenCrawlResponse {
  ok: boolean;
  status: OpenCrawlStatus;
  execution_mode: ExecutionMode;
  message: string;
  blocked_reason?: string;
  dry_run?: boolean;
  metadata?: Record<string, unknown>;
}
