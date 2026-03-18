import { query } from "../../server/db";
import type { SourceSnapshotRecord } from "../schemas/source_snapshot.schema";

export async function insertSourceSnapshot(record: SourceSnapshotRecord): Promise<void> {
  await query(
    `INSERT INTO source_snapshots
       (run_id, agent_name, source_name, source_url, ente, tribunal_alias,
        ano_exercicio, source_kind, raw_payload_path, raw_payload_sha256,
        normalized_count, collected_at, metadata_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      record.run_id,
      record.agent_name,
      record.source_name,
      record.source_url ?? null,
      record.ente ?? null,
      record.tribunal_alias ?? null,
      record.ano_exercicio ?? null,
      record.source_kind,
      record.raw_payload_path ?? null,
      record.raw_payload_sha256 ?? null,
      record.normalized_count,
      record.collected_at,
      record.metadata_json ?? null,
    ],
  );
}

export async function findLatestSnapshots(filters: {
  run_id?: string;
  agent_name?: string;
  ente?: string;
  source_kind?: string;
  limit?: number;
}): Promise<SourceSnapshotRecord[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (filters.run_id)      { conditions.push(`run_id = $${idx++}`);      values.push(filters.run_id); }
  if (filters.agent_name)  { conditions.push(`agent_name = $${idx++}`);  values.push(filters.agent_name); }
  if (filters.ente)        { conditions.push(`ente = $${idx++}`);        values.push(filters.ente); }
  if (filters.source_kind) { conditions.push(`source_kind = $${idx++}`); values.push(filters.source_kind); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  values.push(limit);

  return query<SourceSnapshotRecord>(
    `SELECT * FROM source_snapshots ${where} ORDER BY collected_at DESC LIMIT $${idx}`,
    values,
  );
}
