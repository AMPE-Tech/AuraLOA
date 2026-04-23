import { enrichContacts } from "../server/services/contact_enrichment";

const CNPJ_TESTE = process.argv[2] || "10586640000189";
const RAZAO = process.argv[3] || "Grupo Stabia";

console.log(`\n🔍 Testando enrichContacts com CNPJ ${CNPJ_TESTE} (${RAZAO})\n`);
const start = Date.now();

const result = await enrichContacts({
  cnpj: CNPJ_TESTE,
  razao_social: RAZAO,
});

const duracao = Date.now() - start;

console.log(`⏱️  Duração: ${duracao}ms`);
console.log(`📊 Score cobertura: ${result.score_cobertura}%`);
console.log(`👥 Total pessoas: ${result.total_pessoas}`);
console.log(`📞 Total com contato: ${result.total_com_contato}`);
console.log(`\n=== SÓCIOS (${result.socios.length}) ===`);
for (const s of result.socios) {
  console.log(`  • ${s.nome}`);
  console.log(`    CPF: ${s.cpf_cnpj || "—"} | Qualif: ${s.qualificacao || "—"}`);
  console.log(`    📧 Email: ${s.email || "—"}`);
  console.log(`    📱 Telefone: ${s.telefone || "—"}`);
  console.log(`    🔗 LinkedIn: ${s.linkedin_url || "—"}`);
  console.log(`    🌐 Site: ${s.site_pessoal || s.site_escritorio || "—"}`);
  console.log(`    📚 Fontes: ${s.fontes_consultadas.join(", ") || "—"}`);
}
console.log(`\n=== ADVOGADOS (${result.advogados.length}) ===`);
for (const a of result.advogados) {
  console.log(`  • ${a.nome}  OAB ${a.oab_numero || "—"}`);
}
if (result.alertas.length > 0) {
  console.log(`\n⚠️  ALERTAS:`);
  for (const al of result.alertas) console.log(`  - ${al}`);
}
console.log();
process.exit(0);
