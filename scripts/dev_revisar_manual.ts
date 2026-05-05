import { query } from "../server/db";
import { revisarPosExtracao } from "../server/v2/revisor_extracao";

const r = await query<any>(
  `SELECT * FROM v2_analises WHERE validation_id = '8bl9b0miS6ot' LIMIT 1`
);
const d = r[0];

// Reconstrói fields a partir da DB
const fields: any = {
  natureza_documento: d.natureza_documento,
  numero_cnj: d.numero_cnj,
  numero_oficio: d.numero_oficio,
  tribunal: d.tribunal,
  tipo: d.tipo,
  credor_nome: d.credor_nome,
  credor_cpf_cnpj: d.credor_cpf_cnpj,
  devedor: d.devedor,
  valor_rs: d.valor_rs,
  data_transito: d.data_transito,
  orgao_julgador: d.orgao_julgador,
  url_verificacao_tribunal: d.url_verificacao_tribunal,
  qrcode_tribunal: d.qrcode_tribunal,
  codigo_verificador: d.codigo_verificador,
  decisao_resumo: d.decisao_resumo,
  status_processual: d.status_processual,
  processos_identificados: d.processos_identificados || [],
  documentos_identificados: d.documentos_identificados || [],
  partes: d.partes || [],
  autoridades: d.autoridades || [],
  datas_identificadas: d.datas_identificadas || [],
  advogados: d.advogados || [],
  classificacao_credito: d.classificacao_credito || [],
  beneficiarios_detalhados: d.beneficiarios_detalhados || [],
  metadados_requisicao: d.metadados_requisicao || {},
  observacoes_gerais: d.observacoes_gerais || [],
};

console.log(`\n🔍 REVISÃO PÓS-EXTRAÇÃO — ${d.file_original_name}\n`);
console.log(`  CNJ:    ${fields.numero_cnj || "NULL"}`);
console.log(`  Ofício: ${fields.numero_oficio || "NULL"}`);
console.log(`  Valor:  R$ ${Number(fields.valor_rs || 0).toLocaleString("pt-BR")}`);
console.log();

const v = revisarPosExtracao(fields);

console.log(`⭐ SCORE: ${v.score}/100  (recomenda_reextrair: ${v.recomenda_reextrair})`);
console.log();
console.log("📋 CHECKSUMS:");
for (const [k, ok] of Object.entries(v.checksums)) {
  console.log(`   ${ok ? "✅" : "❌"}  ${k}`);
}
console.log();
console.log(`🚨 ALERTAS: ${v.total_alertas}`);
for (const a of v.alertas) {
  console.log();
  console.log(`  ━━━ [${a.severidade.toUpperCase()}] ${a.codigo} ━━━`);
  if (a.campo) console.log(`  campo: ${a.campo}`);
  console.log(`  ${a.descricao}`);
  if (a.sugestao) console.log(`  💡 ${a.sugestao}`);
}
console.log();
process.exit(0);
