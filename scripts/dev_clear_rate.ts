import { query } from "../server/db";

const rows = await query<{ ip: string; count: number }>(
  "DELETE FROM v2_rate_limit WHERE day = CURRENT_DATE RETURNING ip, count"
);
console.log(`Rate limit de hoje limpo: ${rows.length} linha(s)`);
process.exit(0);
