import { query } from "../server/db";

const r = await query<any>(
  `SELECT validation_id, numero_cnj, numero_oficio, valor_rs, validacao_extracao
   FROM v2_analises WHERE validation_id = '8bl9b0miS6ot' LIMIT 1`
);
const d = r[0];
console.log("═══════════════════════════════════════════════════");
console.log(`validation_id : ${d.validation_id}`);
console.log(`numero_cnj    : ${d.numero_cnj || "❌ NULL"}`);
console.log(`numero_oficio : ${d.numero_oficio || "❌ NULL"}`);
console.log(`valor_rs      : R$ ${Number(d.valor_rs).toLocaleString("pt-BR")}`);
console.log("═══════════════════════════════════════════════════\n");

const v = d.validacao_extracao;
if (!v) {
  console.log("❌ validacao_extracao está NULL");
  process.exit(0);
}
console.log(`⭐ SCORE: ${v.score}/100`);
console.log(`   total_alertas: ${v.total_alertas}`);
console.log(`   recomenda_reextrair: ${v.recomenda_reextrair}`);
console.log("\n📋 CHECKSUMS:");
for (const [k, ok] of Object.entries(v.checksums || {})) {
  console.log(`  ${ok ? "✅" : "❌"} ${k}`);
}
console.log("\n🚨 ALERTAS:");
for (const a of (v.alertas || [])) {
  console.log(`\n  [${a.severidade.toUpperCase()}] ${a.codigo}`);
  console.log(`    campo: ${a.campo || "—"}`);
  console.log(`    ${a.descricao}`);
  if (a.sugestao) console.log(`    💡 ${a.sugestao}`);
}
process.exit(0);
