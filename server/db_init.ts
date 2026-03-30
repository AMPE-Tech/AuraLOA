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

  // ── Colunas reset de senha em aura_users (idempotente) ──────────────────
  await query(`ALTER TABLE aura_users ADD COLUMN IF NOT EXISTS password_reset_token TEXT`);
  await query(`ALTER TABLE aura_users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ`);

  // ── Colunas Stripe em aura_users (idempotente) ───────────────────────────
  await query(`ALTER TABLE aura_users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE`);
  await query(`ALTER TABLE aura_users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`);
  await query(`ALTER TABLE aura_users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free'`);
  await query(`ALTER TABLE aura_users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free'`);
  await query(`ALTER TABLE aura_users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ`);

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

  // ── Tabela: job_runs ─────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS job_runs (
      run_id           TEXT PRIMARY KEY,
      process_id_uuid  TEXT NOT NULL,
      job_type         TEXT NOT NULL,
      agent_name       TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'PENDING',
      priority         INTEGER NOT NULL DEFAULT 5,
      retry_count      INTEGER NOT NULL DEFAULT 0,
      started_at       TIMESTAMPTZ,
      finished_at      TIMESTAMPTZ,
      error_message    TEXT,
      payload_json     JSONB NOT NULL DEFAULT '{}',
      result_json      JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Tabela: source_snapshots ──────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS source_snapshots (
      id                  SERIAL PRIMARY KEY,
      run_id              TEXT NOT NULL,
      agent_name          TEXT NOT NULL,
      source_name         TEXT NOT NULL,
      source_url          TEXT,
      ente                TEXT,
      tribunal_alias      TEXT,
      ano_exercicio       INTEGER,
      source_kind         TEXT NOT NULL,
      raw_payload_path    TEXT,
      raw_payload_sha256  TEXT,
      normalized_count    INTEGER NOT NULL DEFAULT 0,
      collected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata_json       JSONB
    )
  `);

  // ── Índices: source_snapshots ─────────────────────────────────────────────
  // Débito técnico: source_snapshots.run_id não possui FK para job_runs.run_id
  // no MVP — evita overhead de constraint em volume alto. Registrado para Bloco B.
  await query(`CREATE INDEX IF NOT EXISTS idx_ss_run_id
    ON source_snapshots (run_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ss_agent_collected
    ON source_snapshots (agent_name, collected_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ss_tribunal_ano
    ON source_snapshots (tribunal_alias, ano_exercicio)`);

  // ─── Validações de documentos (AuraRISK BR) ──────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS document_validations (
      id                    SERIAL PRIMARY KEY,
      uuid                  TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      file_hash_sha256      TEXT NOT NULL,
      score                 INTEGER NOT NULL,
      status                TEXT NOT NULL CHECK (status IN ('APROVADO','VERIFICAR','SUSPEITO')),
      numero_cnj            TEXT,
      numero_oficio         TEXT,
      tribunal              TEXT,
      juiz_assinante        TEXT,
      credor_nome           TEXT,
      credor_cpf_cnpj       TEXT,
      devedor               TEXT,
      valor_rs              TEXT,
      data_transito         TEXT,
      url_verificacao       TEXT,
      codigo_verificador    TEXT,
      tem_qrcode            BOOLEAN DEFAULT FALSE,
      tem_assinatura_digital BOOLEAN DEFAULT FALSE,
      findings_json         JSONB,
      ip_origem             TEXT,
      user_agent            TEXT
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_dv_status
      ON document_validations (status);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_dv_created_at
      ON document_validations (created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_dv_cnj
      ON document_validations (numero_cnj)
      WHERE numero_cnj IS NOT NULL;
  `);

  // ─── Suspeitos (score < 50) ───────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS document_suspects (
      id                SERIAL PRIMARY KEY,
      validation_id     INTEGER NOT NULL REFERENCES document_validations(id),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      motivo_reprovacao TEXT NOT NULL,
      alertas_json      JSONB,
      ip_origem         TEXT,
      file_hash_sha256  TEXT NOT NULL
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_ds_created_at
      ON document_suspects (created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_ds_hash
      ON document_suspects (file_hash_sha256);
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
