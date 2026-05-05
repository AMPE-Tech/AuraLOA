import { query } from "../server/db";

const r = await query<any>(
  `SELECT ld.lote_id, l.status, l.total_docs, l.created_at, l.cnj_consolidado
   FROM v2_lote_docs ld
   JOIN v2_analises a ON a.id = ld.analise_id
   JOIN v2_lotes_analise l ON l.lote_id = ld.lote_id
   WHERE a.validation_id = '8bl9b0miS6ot'
   LIMIT 1`
);
console.log(JSON.stringify(r[0], null, 2));
process.exit(0);
