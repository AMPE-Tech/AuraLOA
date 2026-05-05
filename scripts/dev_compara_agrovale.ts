import { query } from "../server/db";

const LOTE_ID = "M8Q812qqvE";

const lote = await query<any>(`SELECT * FROM v2_lotes_analise WHERE lote_id = $1`, [LOTE_ID]);
if (!lote[0]) { console.log("Lote não encontrado"); process.exit(1); }

const docs = await query<any>(
  `SELECT a.* FROM v2_lote_docs ld JOIN v2_analises a ON a.id = ld.analise_id
   WHERE ld.lote_id = $1 ORDER BY ld.ordem`,
  [LOTE_ID]
);

const d = docs[0];
console.log("═══════════════════════════════════════════════════════");
console.log(`📄 Arquivo: ${d.file_original_name}`);
console.log(`📊 Páginas: ${d.paginas} | chars: ${d.chars_extraidos}`);
console.log("═══════════════════════════════════════════════════════\n");

console.log("▶️ CAMPOS ESTRUTURADOS (Haiku extraiu):\n");
console.log("natureza_documento :", d.natureza_documento || "[NULL]");
console.log("numero_cnj         :", d.numero_cnj || "[NULL]");
console.log("numero_oficio      :", d.numero_oficio || "[NULL]");
console.log("tribunal           :", d.tribunal || "[NULL]");
console.log("tipo               :", d.tipo || "[NULL]");
console.log("credor_nome        :", d.credor_nome || "[NULL]");
console.log("credor_cpf_cnpj    :", d.credor_cpf_cnpj || "[NULL]");
console.log("devedor            :", d.devedor || "[NULL]");
console.log("valor_rs           :", d.valor_rs || "[NULL]");
console.log("data_transito      :", d.data_transito || "[NULL]");
console.log("orgao_julgador     :", d.orgao_julgador || "[NULL]");
console.log("url_verificacao    :", d.url_verificacao_tribunal || "[NULL]");
console.log("qrcode             :", d.qrcode_tribunal || "[NULL]");
console.log("codigo_verificador :", d.codigo_verificador || "[NULL]");
console.log("decisao_resumo     :", (d.decisao_resumo || "[NULL]").slice(0, 100));
console.log("status_processual  :", d.status_processual || "[NULL]");

console.log("\n▶️ LISTAS (JSONB):\n");

const arr = (field: string) => {
  const v = d[field];
  if (!v) return [];
  return Array.isArray(v) ? v : [];
};

console.log(`processos_identificados: ${arr("processos_identificados").length}`);
for (const p of arr("processos_identificados")) {
  console.log(`  • ${p.numero} [${p.tipo}] grau=${p.grau} — ${p.tribunal}`);
}

console.log(`\npartes: ${arr("partes").length}`);
for (const p of arr("partes")) {
  console.log(`  • ${p.nome} [${p.polo}] — CNPJ: ${p.cpf_cnpj || "—"} — ${p.qualificacao || ""}`);
}

console.log(`\nautoridades: ${arr("autoridades").length}`);
for (const a of arr("autoridades")) {
  console.log(`  • ${a.nome} [${a.funcao}] — ${a.orgao || ""}`);
}

console.log(`\ndocumentos_identificados: ${arr("documentos_identificados").length}`);
for (const doc of arr("documentos_identificados")) {
  console.log(`  • ${doc.tipo}: ${doc.valor}`);
}

console.log(`\ndatas: ${arr("datas_identificadas").length}`);
for (const dt of arr("datas_identificadas")) {
  console.log(`  • ${dt.data} — ${dt.descricao}`);
}

console.log(`\nobservacoes_gerais: ${arr("observacoes_gerais").length}`);
for (const o of arr("observacoes_gerais")) {
  console.log(`  • ${typeof o === "string" ? o : JSON.stringify(o)}`);
}

process.exit(0);
