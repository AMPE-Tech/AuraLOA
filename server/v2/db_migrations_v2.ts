import { query } from "../db";

export async function initDbV2(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS v2_analises (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      validation_id TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      user_email TEXT,

      file_sha256 TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size_bytes INTEGER,
      file_original_name TEXT,

      paginas INTEGER,
      chars_extraidos INTEGER,
      ocr_usado BOOLEAN DEFAULT FALSE,
      extraction_method TEXT,

      lgpd_consent_at TIMESTAMPTZ NOT NULL,
      lgpd_consent_ip TEXT NOT NULL,
      lgpd_consent_user_agent TEXT,

      numero_cnj TEXT,
      numero_oficio TEXT,
      tribunal TEXT,
      tipo TEXT,
      credor_nome TEXT,
      credor_cpf_cnpj TEXT,
      devedor TEXT,
      valor_rs NUMERIC(18,2),
      data_transito DATE,
      orgao_julgador TEXT,

      fase1_datajud_json JSONB,
      fase2_loa_json JSONB,
      fase3_cnpj_json JSONB,
      fase4_portal_json JSONB,
      fase5_pje_json JSONB,

      auditoria_score INTEGER,
      auditoria_alertas JSONB,

      tier_preco TEXT,
      status_pagamento TEXT DEFAULT 'free',
      stripe_session_id TEXT,
      stripe_payment_intent TEXT,
      revealed_at TIMESTAMPTZ,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_v2_analises_validation_id ON v2_analises(validation_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_v2_analises_user_email ON v2_analises(user_email)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_v2_analises_sha256 ON v2_analises(file_sha256)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_v2_analises_numero_cnj ON v2_analises(numero_cnj)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_v2_analises_status_pag ON v2_analises(status_pagamento)`);

  // ── B2 incremento: URL/QR/código verificador do rodapé do ofício CNJ ──
  await query(`ALTER TABLE v2_analises ADD COLUMN IF NOT EXISTS url_verificacao_tribunal TEXT`);
  await query(`ALTER TABLE v2_analises ADD COLUMN IF NOT EXISTS qrcode_tribunal TEXT`);
  await query(`ALTER TABLE v2_analises ADD COLUMN IF NOT EXISTS codigo_verificador TEXT`);
  await query(`ALTER TABLE v2_analises ADD COLUMN IF NOT EXISTS checklist_auditoria JSONB`);
  await query(`ALTER TABLE v2_analises ADD COLUMN IF NOT EXISTS extraction_tokens_input INTEGER`);
  await query(`ALTER TABLE v2_analises ADD COLUMN IF NOT EXISTS extraction_tokens_output INTEGER`);
  await query(`ALTER TABLE v2_analises ADD COLUMN IF NOT EXISTS extraction_cost_usd NUMERIC(10,6)`);
  await query(`ALTER TABLE v2_analises ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ`);

  await query(`
    CREATE TABLE IF NOT EXISTS v2_audit_log (
      id BIGSERIAL PRIMARY KEY,
      analise_id UUID NOT NULL REFERENCES v2_analises(id) ON DELETE CASCADE,
      fase TEXT NOT NULL,
      fonte_url TEXT,
      request_hash TEXT,
      response_hash TEXT,
      confianca TEXT,
      status TEXT,
      alertas JSONB,
      duracao_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_v2_audit_analise ON v2_audit_log(analise_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_v2_audit_fase ON v2_audit_log(fase)`);

  await query(`
    CREATE TABLE IF NOT EXISTS v2_membros_fundadores (
      id SERIAL PRIMARY KEY,
      user_email TEXT UNIQUE NOT NULL,
      numero_membro INTEGER UNIQUE,
      plano TEXT,
      desconto_pct INTEGER DEFAULT 30,
      valido_enquanto_assinatura_ativa BOOLEAN DEFAULT TRUE,
      stripe_subscription_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS v2_rate_limit (
      ip TEXT NOT NULL,
      day DATE NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ip, day)
    )
  `);

  console.log("[DB V2] Tabelas v2_analises, v2_audit_log, v2_membros_fundadores, v2_rate_limit inicializadas.");
}
