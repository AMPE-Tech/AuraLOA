import { Pool } from "pg";

const connectionString = process.env.PG_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("[DB] PG_URL (ou DATABASE_URL) não encontrado nas variáveis de ambiente.");
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false },
});

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function testConnection(): Promise<void> {
  try {
    const rows = await query<{ now: string; current_database: string }>(
      "SELECT NOW() AS now, current_database()"
    );
    console.log(`[DB] Conexão estabelecida — banco: ${rows[0].current_database} — servidor: ${rows[0].now}`);
  } catch (err) {
    console.error("[DB] Falha na conexão:", err);
    throw err;
  }
}
