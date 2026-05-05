import { query } from "../db";
import type { ExtractionResult } from "./field_extractor";
import { revisarPosExtracao } from "./revisor_extracao";

// Persiste resultado da extração Haiku num registro v2_analises existente.
// Usado pelo endpoint individual e pelo lote.
export async function persistExtractionResult(
  analiseId: string,
  extraction: ExtractionResult,
): Promise<void> {
  const { fields, checklist, method, tokens_input, tokens_output, cost_usd } = extraction;

  // 🛡️ REVISOR PÓS-EXTRAÇÃO — valida ANTES de persistir
  const validacaoExtracao = revisarPosExtracao(fields);

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
       advogados = $29::jsonb,
       classificacao_credito = $30::jsonb,
       beneficiarios_detalhados = $31::jsonb,
       metadados_requisicao = $32::jsonb,
       validacao_extracao = $33::jsonb,
       extracted_at = NOW(), updated_at = NOW()
     WHERE id = $34`,
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
      JSON.stringify(fields.advogados ?? []),
      JSON.stringify(fields.classificacao_credito ?? []),
      JSON.stringify(fields.beneficiarios_detalhados ?? []),
      JSON.stringify(fields.metadados_requisicao ?? {}),
      JSON.stringify(validacaoExtracao),
      analiseId,
    ],
  );

  // Log audit da validação
  await query(
    `INSERT INTO v2_audit_log (analise_id, fase, fonte_url, status, confianca, alertas, duracao_ms)
     VALUES ($1, 'revisor_pos_extracao', 'local://revisor_extracao.ts', $2, $3, $4::jsonb, 0)`,
    [
      analiseId,
      validacaoExtracao.score >= 80 ? "ok" : validacaoExtracao.score >= 60 ? "parcial" : "erro",
      validacaoExtracao.score >= 80 ? "alta" : validacaoExtracao.score >= 60 ? "media" : "baixa",
      JSON.stringify({
        score: validacaoExtracao.score,
        total_alertas: validacaoExtracao.total_alertas,
        alertas: validacaoExtracao.alertas,
        checksums: validacaoExtracao.checksums,
        recomenda_reextrair: validacaoExtracao.recomenda_reextrair,
      }),
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
