import { fetchPrecatorioByNumero } from "../server/services/estoque_datajud";

const r = await fetchPrecatorioByNumero("1061297-10.2020.4.01.3400", "");
console.log("encontrado:     ", r.encontrado);
console.log("tribunal:       ", r.tribunal);
console.log("tribunal_alias: ", r.tribunal_alias);
console.log("tipo:           ", r.tipo);
console.log("classe_nome:    ", r.classe_nome);
console.log("situacao:       ", r.situacao);
console.log("grau:           ", r.grau);
console.log("total_movimentos:", r.total_movimentos);
console.log("valor_causa:    ", r.valor_causa);
console.log("data_ajuiz:     ", r.data_ajuizamento);
console.log("orgao_julgador: ", r.orgao_julgador);
console.log("movimentos.len: ", (r.movimentos || []).length);
if (r.movimentos && r.movimentos.length > 0) {
  console.log("primeiros 3 movimentos:");
  for (const m of r.movimentos.slice(0, 3)) {
    console.log(`  [${m.codigo}] ${m.nome} — ${m.data}`);
  }
  console.log("ultimos 3 movimentos:");
  for (const m of r.movimentos.slice(-3)) {
    console.log(`  [${m.codigo}] ${m.nome} — ${m.data}`);
  }
}
process.exit(0);
