import { query } from "../../server/db";
import type { JobRunRecord } from "../schemas/job_run.schema";

export async function insertJobRun(record: JobRunRecord): Promise<void> {
  await query(
    `INSERT INTO job_runs
       (run_id, process_id_uuid, job_type, agent_name, status, priority,
        retry_count, started_at, payload_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (run_id) DO NOTHING`,
    [
      record.run_id,
      record.process_id_uuid,
      record.job_type,
      record.agent_name,
      record.status,
      record.priority,
      record.retry_count,
      record.started_at ?? null,
      record.payload_json,
      record.created_at,
    ],
  );
}

export async function updateJobRun(
  record: Partial<JobRunRecord> & { run_id: string },
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (record.status !== undefined)        { updates.push(`status = $${idx++}`);        values.push(record.status); }
  if (record.finished_at !== undefined)   { updates.push(`finished_at = $${idx++}`);   values.push(record.finished_at); }
  if (record.error_message !== undefined) { updates.push(`error_message = $${idx++}`); values.push(record.error_message); }
  if (record.result_json !== undefined)   { updates.push(`result_json = $${idx++}`);   values.push(record.result_json); }

  if (updates.length === 0) return;

  values.push(record.run_id);
  await query(
    `UPDATE job_runs SET ${updates.join(", ")} WHERE run_id = $${idx}`,
    values,
  );
}
