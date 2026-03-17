import { query } from "./db";

export async function initDb(): Promise<void> {
  // ── Tabela: aura_users ────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS aura_users (
      email         TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user',
      name          TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      active        BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at    TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ
    )
  `);

  // ── Tabela: loa_history ───────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS loa_history (
      id                   TEXT PRIMARY KEY,
      process_id_uuid      TEXT NOT NULL,
      ano_exercicio        INTEGER NOT NULL,
      mes                  INTEGER,
      status_geral         TEXT,
      generated_at_iso     TEXT,
      evidencias_count     INTEGER,
      execucao_total_pago  NUMERIC,
      dotacao_total        NUMERIC,
      zip_downloaded       BOOLEAN,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Tabela: sp_loa_rows ───────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS sp_loa_rows (
      id               SERIAL PRIMARY KEY,
      ente             TEXT NOT NULL,
      ano              INTEGER NOT NULL,
      orgao            TEXT,
      uo               TEXT,
      programa         TEXT,
      acao_local       TEXT,
      dotacao_inicial  NUMERIC,
      dotacao_atual    NUMERIC,
      raw              JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Tabela: sp_despesas_rows ──────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS sp_despesas_rows (
      id          SERIAL PRIMARY KEY,
      ente        TEXT NOT NULL,
      ano         INTEGER NOT NULL,
      orgao       TEXT,
      uo          TEXT,
      fase        TEXT,
      valor       NUMERIC,
      favorecido  TEXT,
      data        TEXT,
      raw         JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Seed: usuário admin padrão ────────────────────────────────────────────
  await query(`
    INSERT INTO aura_users (email, password_hash, role, name, created_at, active)
    VALUES ($1, $2, 'admin', 'Marcos', '2025-01-01T00:00:00.000Z', TRUE)
    ON CONFLICT (email) DO NOTHING
  `, [
    "marcos@auradue.com",
    "8b2fbcc9e81edb71958e1b965f626452f2733e105a5b67b5a016200bf0162001",
  ]);

  console.log("[DB] Tabelas inicializadas com sucesso.");
}
