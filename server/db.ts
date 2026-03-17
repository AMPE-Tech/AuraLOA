import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("[DB] DATABASE_URL não encontrado nas variáveis de ambiente.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost")
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
    const rows = await query<{ now: string }>("SELECT NOW() AS now");
    console.log(`[DB] Conexão estabelecida com sucesso — servidor: ${rows[0].now}`);
  } catch (err) {
    console.error("[DB] Falha na conexão com o banco de dados:", err);
    throw err;
  }
}
