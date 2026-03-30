/**
 * Script de criação da tabela pesquisas_validador
 * Executa: npx tsx server/scripts/create_pesquisas_validador.ts
 */
import { query } from "../db";

async function main() {
  await query(`
    CREATE TABLE IF NOT EXISTS pesquisas_validador (
      id                      SERIAL PRIMARY KEY,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Identificação do processo
      numero_processo         TEXT NOT NULL,
      numero_oficio           TEXT,
      tribunal                TEXT,

      -- Resultado da pesquisa
      encontrado              BOOLEAN NOT NULL DEFAULT FALSE,
      status_datajud          TEXT,
      valor_rs                NUMERIC(18,2),
      data_autuacao           DATE,
      data_transito           DATE,
      pagamento_pendente      BOOLEAN,
      url_consulta            TEXT,
      url_origem              TEXT,

      -- Rastreabilidade
      ip_origem               TEXT,
      user_plan               TEXT,
      fonte_cache             BOOLEAN NOT NULL DEFAULT FALSE,

      -- Payload completo para auditoria
      resultado_json          JSONB
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_pesquisas_validador_numero
      ON pesquisas_validador (numero_processo);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_pesquisas_validador_created
      ON pesquisas_validador (created_at DESC);
  `);

  console.log("[OK] Tabela pesquisas_validador criada com sucesso.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[ERRO]", err);
  process.exit(1);
});
