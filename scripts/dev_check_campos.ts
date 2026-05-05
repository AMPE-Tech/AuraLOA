import { query } from "../server/db";

const r = await query<any>(
  `SELECT validation_id, extracted_at,
     (classificacao_credito IS NOT NULL) AS tem_classif,
     jsonb_array_length(COALESCE(classificacao_credito, '[]'::jsonb)) AS qtd_classif,
     (advogados IS NOT NULL) AS tem_adv,
     jsonb_array_length(COALESCE(advogados, '[]'::jsonb)) AS qtd_adv,
     (beneficiarios_detalhados IS NOT NULL) AS tem_benef,
     jsonb_array_length(COALESCE(beneficiarios_detalhados, '[]'::jsonb)) AS qtd_benef,
     (metadados_requisicao IS NOT NULL) AS tem_meta,
     (validacao_extracao IS NOT NULL) AS tem_valid
   FROM v2_analises WHERE validation_id = '8bl9b0miS6ot'`
);
console.log(JSON.stringify(r[0], null, 2));
process.exit(0);
