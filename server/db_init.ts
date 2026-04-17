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

  // ── Tabela: pesquisas_validador ───────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS pesquisas_validador (
      id                      SERIAL PRIMARY KEY,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      numero_processo         TEXT NOT NULL,
      numero_oficio           TEXT,
      tribunal                TEXT,
      encontrado              BOOLEAN NOT NULL DEFAULT FALSE,
      status_datajud          TEXT,
      valor_rs                NUMERIC(18,2),
      data_autuacao           DATE,
      data_transito           DATE,
      pagamento_pendente      BOOLEAN,
      url_consulta            TEXT,
      url_origem              TEXT,
      ip_origem               TEXT,
      user_plan               TEXT,
      fonte_cache             BOOLEAN NOT NULL DEFAULT FALSE,
      resultado_json          JSONB
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_pesquisas_validador_numero
    ON pesquisas_validador (numero_processo)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pesquisas_validador_created
    ON pesquisas_validador (created_at DESC)`);

  // ── Coluna pode_lote em aura_users (idempotente) ──────────────────────────
  await query(`ALTER TABLE aura_users ADD COLUMN IF NOT EXISTS pode_lote BOOLEAN NOT NULL DEFAULT FALSE`);

  // ── Tabela: lote_pesquisas ────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS lote_pesquisas (
      id               SERIAL PRIMARY KEY,
      uuid             TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
      criado_por       TEXT NOT NULL,
      nome             TEXT NOT NULL,
      descricao        TEXT,
      ano_exercicio    INTEGER,
      status           TEXT NOT NULL DEFAULT 'criado' CHECK (status IN ('criado','enriquecendo','concluido','erro')),
      total_processos  INTEGER NOT NULL DEFAULT 0,
      total_encontrados INTEGER NOT NULL DEFAULT 0,
      total_manuais    INTEGER NOT NULL DEFAULT 0,
      csv_origem_sha256 TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_lp_criado_por ON lote_pesquisas (criado_por)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lp_status ON lote_pesquisas (status)`);

  // ── Tabela: lote_processos ────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS lote_processos (
      id               SERIAL PRIMARY KEY,
      lote_id          INTEGER NOT NULL REFERENCES lote_pesquisas(id) ON DELETE CASCADE,
      numero_cnj       TEXT NOT NULL,
      numero_formatado TEXT NOT NULL,
      tribunal         TEXT NOT NULL,
      classe           TEXT NOT NULL,
      situacao         TEXT,
      valor_original   NUMERIC(18,2),
      valor_enriquecido NUMERIC(18,2),
      fonte_valor      TEXT,
      status_valor     TEXT NOT NULL DEFAULT 'pendente' CHECK (status_valor IN ('pendente','encontrado','manual','nao_encontrado')),
      data_ajuizamento TEXT,
      orgao_julgador   TEXT,
      url_esaj         TEXT,
      url_eproc        TEXT,
      atualizado_por   TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_lproc_lote ON lote_processos (lote_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lproc_cnj ON lote_processos (numero_cnj)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_lproc_status ON lote_processos (status_valor)`);

  // ═══════════════════════════════════════════════════════════════════════
  // MÓDULO KYC + NDA + BILLING (AuraLOA Marketplace — 14/04/2026)
  // ═══════════════════════════════════════════════════════════════════════

  // ── Tabela: kyc_clientes ──────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS kyc_clientes (
      id                   SERIAL PRIMARY KEY,
      cliente_slug         VARCHAR(50) UNIQUE NOT NULL,
      nome_completo        VARCHAR(200) NOT NULL,
      cpf_cnpj             VARCHAR(20) UNIQUE NOT NULL,
      tipo                 VARCHAR(10) NOT NULL CHECK (tipo IN ('PF','PJ')),
      email                VARCHAR(200) UNIQUE NOT NULL,
      telefone             VARCHAR(20),
      whatsapp             VARCHAR(20),
      endereco             JSONB,
      razao_social         VARCHAR(300),
      nome_fantasia        VARCHAR(200),
      perfil_atuacao       VARCHAR(30),
      status               VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','aprovado','rejeitado','suspenso','expulso')),
      status_nda           VARCHAR(20) DEFAULT 'pendente' CHECK (status_nda IN ('pendente','assinado')),
      status_biometria     VARCHAR(20) DEFAULT 'pendente' CHECK (status_biometria IN ('pendente','capturada','aprovada','rejeitada')),
      motivo_rejeicao      TEXT,
      cadastrado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      aprovado_em          TIMESTAMPTZ,
      aprovado_por         VARCHAR(100),
      expulso_em           TIMESTAMPTZ,
      expulso_motivo       TEXT,
      ip_cadastro          VARCHAR(50),
      user_agent_cadastro  TEXT,
      geolocalizacao       JSONB,
      ultimo_acesso_em     TIMESTAMPTZ,
      atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_kyc_slug ON kyc_clientes (cliente_slug)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_kyc_cpfcnpj ON kyc_clientes (cpf_cnpj)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_clientes (status)`);

  // ── Tabela: kyc_documentos ────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS kyc_documentos (
      id               SERIAL PRIMARY KEY,
      cliente_slug     VARCHAR(50) NOT NULL REFERENCES kyc_clientes(cliente_slug) ON DELETE CASCADE,
      tipo             VARCHAR(40) NOT NULL,
      nome_original    VARCHAR(300) NOT NULL,
      caminho_arquivo  VARCHAR(500) NOT NULL,
      mime_type        VARCHAR(80),
      tamanho_bytes    BIGINT,
      sha256           VARCHAR(64) NOT NULL,
      ocr_extraido     JSONB,
      upload_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip               VARCHAR(50),
      user_agent       TEXT
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_kycdoc_cliente ON kyc_documentos (cliente_slug)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_kycdoc_tipo ON kyc_documentos (tipo)`);

  // ── Tabela: kyc_biometria ─────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS kyc_biometria (
      id               SERIAL PRIMARY KEY,
      cliente_slug     VARCHAR(50) NOT NULL REFERENCES kyc_clientes(cliente_slug) ON DELETE CASCADE,
      tipo             VARCHAR(30) NOT NULL,
      selfie_sha256    VARCHAR(64) NOT NULL,
      cnh_sha256       VARCHAR(64),
      score_liveness   NUMERIC(5,2),
      score_match      NUMERIC(5,2),
      aprovado         BOOLEAN NOT NULL DEFAULT FALSE,
      provider         VARCHAR(50),
      detalhes         JSONB,
      capturado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip               VARCHAR(50)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_kycbio_cliente ON kyc_biometria (cliente_slug)`);

  // ── Tabela: nda_assinaturas ───────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS nda_assinaturas (
      id                   SERIAL PRIMARY KEY,
      cliente_slug         VARCHAR(50) NOT NULL REFERENCES kyc_clientes(cliente_slug) ON DELETE CASCADE,
      nda_versao           VARCHAR(20) NOT NULL,
      nda_sha256           VARCHAR(64) NOT NULL,
      texto_integral       TEXT NOT NULL,
      nome_assinante       VARCHAR(200) NOT NULL,
      cpf_cnpj             VARCHAR(20) NOT NULL,
      email                VARCHAR(200),
      ip                   VARCHAR(50) NOT NULL,
      user_agent           TEXT NOT NULL,
      geolocalizacao       JSONB,
      aceites_checkboxes   JSONB NOT NULL,
      assinado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      assinado_em_iso      VARCHAR(30) NOT NULL,
      evidencia_sha256     VARCHAR(64) NOT NULL,
      pdf_gerado_caminho   VARCHAR(500),
      email_enviado        BOOLEAN DEFAULT FALSE,
      email_enviado_em     TIMESTAMPTZ
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_nda_cliente ON nda_assinaturas (cliente_slug)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_nda_sha ON nda_assinaturas (evidencia_sha256)`);

  // ── Tabela: billing_cotas ─────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS billing_cotas (
      id                     SERIAL PRIMARY KEY,
      cliente_slug           VARCHAR(50) NOT NULL REFERENCES kyc_clientes(cliente_slug) ON DELETE CASCADE,
      stripe_customer_id     VARCHAR(100),
      stripe_subscription_id VARCHAR(100),
      subscription_status    VARCHAR(30) DEFAULT 'pending',
      periodo_inicio         DATE NOT NULL,
      periodo_fim            DATE NOT NULL,
      cota_inclusa           INT DEFAULT 2,
      cota_usada             INT DEFAULT 0,
      excedentes_cobrados    INT DEFAULT 0,
      excedentes_valor_usd   NUMERIC(10,2) DEFAULT 0,
      oficios_baixados       INT DEFAULT 0,
      oficios_valor_usd      NUMERIC(10,2) DEFAULT 0,
      total_pago_mes_usd     NUMERIC(10,2) DEFAULT 0,
      criado_em              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (cliente_slug, periodo_inicio)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_cotas_cliente ON billing_cotas (cliente_slug)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cotas_periodo ON billing_cotas (periodo_inicio, periodo_fim)`);

  // ── Tabela: billing_consumo ───────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS billing_consumo (
      id                     SERIAL PRIMARY KEY,
      cliente_slug           VARCHAR(50) NOT NULL REFERENCES kyc_clientes(cliente_slug) ON DELETE CASCADE,
      numero_precatorio      VARCHAR(30),
      cnj_originario         VARCHAR(30),
      tipo                   VARCHAR(30) NOT NULL CHECK (tipo IN ('dd_incluso','dd_excedente','oficio_requisitorio')),
      valor_usd              NUMERIC(10,2) DEFAULT 0,
      stripe_charge_id       VARCHAR(100),
      stripe_payment_status  VARCHAR(30),
      relatorio_gerado       VARCHAR(500),
      consumido_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip                     VARCHAR(50),
      consentimento_registrado BOOLEAN DEFAULT FALSE
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_consumo_cliente ON billing_consumo (cliente_slug)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_consumo_tipo ON billing_consumo (tipo)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_consumo_prec ON billing_consumo (numero_precatorio)`);

  // ── Tabela: kyc_acessos (auditoria) ───────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS kyc_acessos (
      id               SERIAL PRIMARY KEY,
      cliente_slug     VARCHAR(50),
      tipo             VARCHAR(30) NOT NULL,
      rota             VARCHAR(300),
      sucesso          BOOLEAN,
      detalhes         JSONB,
      ip               VARCHAR(50),
      user_agent       TEXT,
      timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_acessos_cliente ON kyc_acessos (cliente_slug)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_acessos_timestamp ON kyc_acessos (timestamp DESC)`);

  // ── CRM do cliente — contatos e negociações ──────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS cliente_crm (
      id                SERIAL PRIMARY KEY,
      cliente_slug      VARCHAR(50) NOT NULL,
      contato_nome      VARCHAR(200) NOT NULL,
      telefone          VARCHAR(50),
      email             VARCHAR(200),
      precatorio_ref    VARCHAR(100),
      valor_negociado   NUMERIC(18,2),
      estagio           VARCHAR(30) NOT NULL DEFAULT 'prospeccao',
      proximo_followup  DATE,
      observacoes       TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_crm_cliente ON cliente_crm (cliente_slug)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_crm_followup ON cliente_crm (proximo_followup)`);

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
