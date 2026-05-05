import { query } from "../server/db";

const rows = await query<any>(
  `SELECT a.validation_id, a.file_original_name, a.numero_cnj, a.valor_rs
   FROM v2_analises a
   WHERE a.file_original_name ILIKE '%Agrovale%' OR a.file_original_name ILIKE '%Gilson%'
   ORDER BY a.created_at DESC LIMIT 5`
);
console.log("Análises Agrovale/Gilson:");
for (const r of rows) {
  console.log(`  validation_id: ${r.validation_id}`);
  console.log(`  arquivo:       ${r.file_original_name}`);
  console.log(`  CNJ:           ${r.numero_cnj || "—"}`);
  console.log(`  valor:         ${r.valor_rs || "—"}`);
  console.log();
}
process.exit(0);
