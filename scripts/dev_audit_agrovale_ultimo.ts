import { query } from "../server/db";

// Busca a MAIS RECENTE análise do Agrovale (pós-ajustes)
const rows = await query<any>(
  `SELECT a.*, ld.lote_id, ld.ordem
   FROM v2_analises a
   LEFT JOIN v2_lote_docs ld ON ld.analise_id = a.id
   WHERE a.file_original_name ILIKE '%Agrovale%'
   ORDER BY a.extracted_at DESC NULLS LAST, a.created_at DESC
   LIMIT 1`
);

if (!rows[0]) {
  console.log("Nenhuma análise Agrovale encontrada");
  process.exit(1);
}

const d = rows[0];
console.log("═════════════════════════════════════════════════════════════");
console.log(`📄 ${d.file_original_name}`);
console.log(`   validation_id: ${d.validation_id}`);
console.log(`   lote_id:       ${d.lote_id || "—"}`);
console.log(`   páginas:       ${d.paginas} | chars: ${d.chars_extraidos}`);
console.log(`   extraction:    ${d.extraction_method}`);
console.log(`   extracted_at:  ${d.extracted_at}`);
console.log(`   tokens:        in=${d.extraction_tokens_input} out=${d.extraction_tokens_output}`);
console.log(`   custo:         US$ ${d.extraction_cost_usd}`);
console.log("═════════════════════════════════════════════════════════════\n");

console.log("▶️ CAMPOS PRINCIPAIS:");
console.log("  natureza_documento  :", d.natureza_documento || "❌ NULL");
console.log("  numero_cnj          :", d.numero_cnj || "❌ NULL");
console.log("  numero_oficio       :", d.numero_oficio || "❌ NULL");
console.log("  tribunal            :", d.tribunal || "❌ NULL");
console.log("  tipo                :", d.tipo || "❌ NULL");
console.log("  credor_nome         :", d.credor_nome || "❌ NULL");
console.log("  credor_cpf_cnpj     :", d.credor_cpf_cnpj || "❌ NULL");
console.log("  devedor             :", d.devedor || "❌ NULL");
console.log("  valor_rs            :", d.valor_rs || "❌ NULL");
console.log("  data_transito       :", d.data_transito || "❌ NULL");
console.log("  orgao_julgador      :", d.orgao_julgador || "❌ NULL");
console.log("  url_verificacao     :", d.url_verificacao_tribunal || "❌ NULL");
console.log("  qrcode              :", d.qrcode_tribunal || "❌ NULL");
console.log("  codigo_verificador  :", d.codigo_verificador || "❌ NULL");
console.log("  status_processual   :", d.status_processual || "❌ NULL");

const arr = (f: string) => Array.isArray(d[f]) ? d[f] : [];
const obj = (f: string) => d[f] || {};

console.log("\n▶️ NOVOS CAMPOS (ajustes 5):");
console.log("  advogados                : ", arr("advogados").length, "itens");
for (const a of arr("advogados")) console.log(`     → ${a.nome} | OAB/${a.oab_seccional} ${a.oab_numero} | CPF ${a.cpf}`);

console.log("  classificacao_credito    : ", arr("classificacao_credito").length, "itens");
for (const c of arr("classificacao_credito")) console.log(`     → ofício ${c.oficio}: ${c.natureza_credito} | ${c.natureza_obrigacao_codigo} ${c.natureza_obrigacao_descricao}`);

console.log("  beneficiarios_detalhados : ", arr("beneficiarios_detalhados").length, "itens");
for (const b of arr("beneficiarios_detalhados")) console.log(`     → ${b.nome} (${b.tipo}) | CNPJ ${b.cnpj} | principal=${b.principal} juros=${b.juros_selic} total=${b.total}`);

const meta = obj("metadados_requisicao");
console.log("  metadados_requisicao     :");
console.log(`     especie             : ${meta.especie || "❌ NULL"}`);
console.log(`     tipo_requisicao     : ${meta.tipo_requisicao || "❌ NULL"}`);
console.log(`     incidentes          : ${meta.incidentes || "❌ NULL"}`);
console.log(`     percentual_juros    : ${meta.percentual_juros_mora || "❌ NULL"}`);
console.log(`     valor_principal     : ${meta.valor_total_principal || "❌ NULL"}`);
console.log(`     valor_juros         : ${meta.valor_total_juros || "❌ NULL"}`);
console.log(`     valor_requisitado   : ${meta.valor_total_requisitado || "❌ NULL"}`);
console.log(`     qtd_beneficiarios   : ${meta.quantidade_beneficiarios || "❌ NULL"}`);
console.log(`     qtd_cessionarios    : ${meta.quantidade_cessionarios || "❌ NULL"}`);

console.log("\n▶️ LISTAS CLÁSSICAS:");
console.log("  processos_identificados  :", arr("processos_identificados").length);
console.log("  documentos_identificados :", arr("documentos_identificados").length);
console.log("  partes                   :", arr("partes").length);
console.log("  autoridades              :", arr("autoridades").length);
console.log("  datas_identificadas      :", arr("datas_identificadas").length);
console.log("  observacoes_gerais       :", arr("observacoes_gerais").length);

process.exit(0);
