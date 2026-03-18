import { randomUUID } from "crypto";
import type { JobType } from "./job_types";
import type { JobRunRecord } from "../schemas/job_run.schema";
import { insertJobRun, updateJobRun } from "../storage/job_run_store";

export interface RunJobOptions {
  priority?: number;
  retry_count?: number;
  agent_name?: string;
  run_id?: string;
}

export async function runJob(
  jobType: JobType,
  handler: () => Promise<unknown>,
  payload: Record<string, unknown>,
  options?: RunJobOptions,
): Promise<JobRunRecord> {
  const run_id = options?.run_id ?? randomUUID();
  const process_id_uuid = randomUUID();
  const agent_name = options?.agent_name ?? "job_runner";
  const priority = options?.priority ?? 5;
  const retry_count = options?.retry_count ?? 0;
  const created_at = new Date().toISOString();
  const started_at = new Date().toISOString();

  const record: JobRunRecord = {
    id: run_id,
    run_id,
    process_id_uuid,
    job_type: jobType,
    agent_name,
    status: "RUNNING",
    priority,
    retry_count,
    started_at,
    payload_json: payload,
    created_at,
  };

  console.log(
    `[JOB START] type=${jobType} run_id=${run_id} process_id_uuid=${process_id_uuid} agent=${agent_name}`,
  );

  await insertJobRun(record);

  try {
    const result = await handler();
    const finished_at = new Date().toISOString();

    await updateJobRun({
      run_id,
      status: "DONE",
      finished_at,
      result_json: result as Record<string, unknown>,
    });

    const final: JobRunRecord = {
      ...record,
      status: "DONE",
      finished_at,
      result_json: result as Record<string, unknown>,
    };

    console.log(
      `[JOB DONE] type=${jobType} run_id=${run_id} finished_at=${finished_at}`,
    );

    return final;
  } catch (err: unknown) {
    const finished_at = new Date().toISOString();
    const error_message = err instanceof Error ? err.message : String(err);

    await updateJobRun({ run_id, status: "ERROR", finished_at, error_message });

    console.error(
      `[JOB ERROR] type=${jobType} run_id=${run_id} error=${error_message}`,
    );

    throw err;
  }
}
