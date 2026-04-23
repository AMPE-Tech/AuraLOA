import { query } from "../db";
import type { ExtractionResult } from "./field_extractor";

// Persiste resultado da extração Haiku num registro v2_analises existente.
// Usado pelo endpoint individual e pelo lote.
export async function persistExtractionResult(
  analiseId: string,
  extraction: ExtractionResult,
): Promise<void> {
  const { fields, checklist, method, tokens_input, tokens_output, cost_usd } = extraction;

  await query(
    `UPDATE v2_analises SET
       numero_cnj = $1, numero_oficio = $2, tribunal = $3, tipo = $4,
       credor_nome = $5, credor_cpf_cnpj = $6, devedor = $7, valor_rs = $8,
       data_transito = $9, orgao_julgador = $10,
       url_verificacao_tribunal = $11, qrcode_tribunal = $12, codigo_verificador = $13,
       checklist_auditoria = $14::jsonb,
       extraction_method = $15,
       extraction_tokens_input = $16, extraction_tokens_output = $17, extraction_cost_usd = $18,
       raw_text = $19,
       natureza_documento = $20,
       processos_identificados = $21::jsonb,
       documentos_identificados = $22::jsonb,
       partes = $23::jsonb,
       autoridades = $24::jsonb,
       datas_identificadas = $25::jsonb,
       decisao_resumo = $26,
       status_processual = $27,
       observacoes_gerais = $28::jsonb,
       extracted_at = NOW(), updated_at = NOW()
     WHERE id = $29`,
    [
      fields.numero_cnj, fields.numero_oficio, fields.tribunal, fields.tipo,
      fields.credor_nome, fields.credor_cpf_cnpj, fields.devedor, fields.valor_rs,
      fields.data_transito, fields.orgao_julgador,
      fields.url_verificacao_tribunal, fields.qrcode_tribunal, fields.codigo_verificador,
      JSON.stringify(checklist),
      method,
      tokens_input, tokens_output, cost_usd,
      extraction.raw_text_pdf,
      fields.natureza_documento,
      JSON.stringify(fields.processos_identificados),
      JSON.stringify(fields.documentos_identificados),
      JSON.stringify(fields.partes),
      JSON.stringify(fields.autoridades),
      JSON.stringify(fields.datas_identificadas),
      fields.decisao_resumo,
      fields.status_processual,
      JSON.stringify(fields.observacoes_gerais),
      analiseId,
    ],
  );
}

export async function logAuditEvent(params: {
  analise_id: string;
  fase: string;
  fonte_url: string;
  status: string;
  confianca: string;
  alertas?: Record<string, unknown>;
  duracao_ms: number;
}): Promise<void> {
  await query(
    `INSERT INTO v2_audit_log (analise_id, fase, fonte_url, status, confianca, alertas, duracao_ms)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      params.analise_id,
      params.fase,
      params.fonte_url,
      params.status,
      params.confianca,
      JSON.stringify(params.alertas ?? {}),
      params.duracao_ms,
    ],
  );
}
