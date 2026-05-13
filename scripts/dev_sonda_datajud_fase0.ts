/**
 * Sonda DataJud — Fase 0 (somente leitura, exploração empírica)
 * ─────────────────────────────────────────────────────────────────────
 *
 * Objetivo: descobrir empiricamente o que a API pública do CNJ DataJud
 * realmente cobre, indexa e filtra, ANTES de qualquer extensão arquitetural
 * (TRT, busca por parte, integração Escavador).
 *
 * NÃO assume nada do que está documentado em CLAUDE.md / MASTER.md sobre
 * o comportamento do DataJud — verifica via chamada real à API.
 *
 * Cadeia de custódia (AuraTRUST):
 *   - UUID v4 por run                   → randomUUID()
 *   - SHA-256 do payload bruto por call → createHash("sha256")
 *   - Timestamp UTC ISO-8601            → new Date().toISOString()
 *   - Endpoint, HTTP status, headers    → persistidos em manifest.json
 *   - Payload bruto persistido          → raw/<label>.json
 *   - SHA-256 do manifest agregado      → manifest.sha256
 *
 * Saída: C:/Temp/auraloa-saida/sonda_datajud_<uuid>/
 *   ├── raw/<label>.json     — payload bruto de cada call (~57 arquivos)
 *   ├── manifest.json        — log estruturado de TODAS as chamadas
 *   ├── manifest.sha256      — hash do manifest
 *   └── MATRIZ_REAL.md       — resumo legível por humano
 *
 * Características de risco:
 *   - Read-only: apenas POST /_search com query Elasticsearch
 *   - Sem captura de PII: a API só retorna metadados processuais públicos
 *   - Sem efeito colateral em código de produção
 *   - Saída em C:/Temp (fora do OneDrive, conforme regra do CLAUDE.md)
 *   - ~57 chamadas totais (não estoura quota DataJud)
 *
 * Como executar (APÓS aprovação DPO):
 *   node --env-file=.env --import=tsx scripts/dev_sonda_datajud_fase0.ts
 *
 * Tempo esperado: ~30-60 segundos.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Histórico:
 *   2026-05-11 — Criado por agente Claude Code (Opus 4.7) a pedido de
 *                Marcos Costa, como entregável único da Fase 0 do plano
 *                de extensão DataJud + Escavador. Aguarda revisão DPO
 *                antes de execução.
 */

import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const KEY = process.env.DATAJUD_API_KEY;
if (!KEY) {
  console.error("[sonda] DATAJUD_API_KEY ausente — abortar");
  process.exit(1);
}

const BASE = "https://api-publica.datajud.cnj.jus.br";
const RUN_ID = randomUUID();
const STARTED_AT = new Date().toISOString();
const OUTDIR = `C:/Temp/auraloa-saida/sonda_datajud_${RUN_ID}`;

mkdirSync(`${OUTDIR}/raw`, { recursive: true });

interface SondaEntry {
  label: string;
  alias: string;
  endpoint: string;
  requested_at_iso: string;
  elapsed_ms: number;
  http_status: number;
  err: string | null;
  sha256_payload: string;
  bytes: number;
  response_headers: Record<string, string>;
  query: unknown;
  total_hits: number | null;
  hits_count: number | null;
  first_hit_source_keys: string[] | null;
  raw_file: string;
}

const log: SondaEntry[] = [];

async function sonda(label: string, alias: string, query: unknown): Promise<any> {
  const endpoint = `${BASE}/api_publica_${alias}/_search`;
  const requested_at_iso = new Date().toISOString();
  const t0 = Date.now();

  let http_status = 0;
  const response_headers: Record<string, string> = {};
  let bodyText = "";
  let parsed: any = null;
  let err: string | null = null;

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(25000),
    });
    http_status = resp.status;
    resp.headers.forEach((v, k) => {
      response_headers[k] = v;
    });
    bodyText = await resp.text();
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      /* preservar bodyText cru */
    }
  } catch (e: any) {
    err = e?.message ?? String(e);
  }

  const elapsed_ms = Date.now() - t0;
  const sha256_payload = createHash("sha256").update(bodyText).digest("hex");
  const safeName = label.replace(/[^a-zA-Z0-9._-]/g, "_");
  writeFileSync(`${OUTDIR}/raw/${safeName}.json`, bodyText);

  const total_hits = parsed?.hits?.total?.value ?? null;
  const hits_count = parsed?.hits?.hits?.length ?? null;
  const first_hit_source_keys =
    parsed?.hits?.hits?.[0]?._source
      ? Object.keys(parsed.hits.hits[0]._source)
      : null;

  const entry: SondaEntry = {
    label,
    alias,
    endpoint,
    requested_at_iso,
    elapsed_ms,
    http_status,
    err,
    sha256_payload,
    bytes: bodyText.length,
    response_headers,
    query,
    total_hits,
    hits_count,
    first_hit_source_keys,
    raw_file: `raw/${safeName}.json`,
  };
  log.push(entry);

  const status = err ? `ERR(${err.slice(0, 40)})` : `HTTP${http_status}`;
  console.log(
    `[${status}] ${alias.padEnd(6)} ${label.padEnd(48)} total=${String(total_hits ?? "—").padStart(7)} hits=${String(hits_count ?? "—").padStart(3)} ${elapsed_ms}ms`,
  );
  return parsed;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log(`\n═══ Sonda DataJud Fase 0 ═══`);
console.log(`Run UUID:  ${RUN_ID}`);
console.log(`Iniciado:  ${STARTED_AT}`);
console.log(`Base URL:  ${BASE}`);
console.log(`Saída:     ${OUTDIR}\n`);

// ════════════════════════════════════════════════════════════════════════
// Q0 — Sanity check: TRF1 sabidamente funciona (validado 23/04/2026).
//      Se este falhar, há problema de conectividade/chave. As demais
//      perguntas seguem mesmo assim para preservar evidência do erro.
// ════════════════════════════════════════════════════════════════════════
console.log(`─── Q0: sanity ping TRF1 ───`);
await sonda("q0_sanity_trf1", "trf1", {
  query: { match_all: {} },
  size: 1,
});
await sleep(200);

// ════════════════════════════════════════════════════════════════════════
// Q1 — TRTs indexados? Smoke match_all em todos os 24 TRTs.
//      Pergunta-mãe: o índice api_publica_trtN existe e responde?
// ════════════════════════════════════════════════════════════════════════
console.log(`\n─── Q1: indexação de cada TRT (match_all size 1) ───`);
const TRTS = Array.from({ length: 24 }, (_, i) => `trt${i + 1}`);
for (const trt of TRTS) {
  await sonda(`q1_${trt}_match_all`, trt, {
    query: { match_all: {} },
    size: 1,
    track_total_hits: true,
  });
  await sleep(200);
}

// ════════════════════════════════════════════════════════════════════════
// Q2/Q3 — Estrutura completa do _source.
//         Q2: o _source traz partes/polo/envolvidos?
//         Q3: qual é o caminho exato do nó de partes?
//         Amostragem em TRT1, TRT2, TRT3 (3 hits cada) — capta variações.
// ════════════════════════════════════════════════════════════════════════
console.log(`\n─── Q2/Q3: estrutura _source em TRT1/TRT2/TRT3 ───`);
for (const trt of ["trt1", "trt2", "trt3"]) {
  await sonda(`q2_${trt}_source_completo`, trt, {
    query: { match_all: {} },
    size: 3,
    _source: true,
  });
  await sleep(200);
}
// também TRF1 e TJSP para comparar com a Justiça do Trabalho
for (const alias of ["trf1", "tjsp"]) {
  await sonda(`q2_${alias}_source_completo`, alias, {
    query: { match_all: {} },
    size: 3,
    _source: true,
  });
  await sleep(200);
}

// ════════════════════════════════════════════════════════════════════════
// Q4 — Filtro por CNPJ da parte (raiz ECT). Varredura de paths candidatos
//      em TRT2 (maior volume, SP). A maioria deve retornar HTTP 400
//      ("path inválido") ou total=0. O path que retornar total>0 é o real.
// ════════════════════════════════════════════════════════════════════════
console.log(`\n─── Q4: filtro por CNPJ ECT em TRT2 — varredura de paths ───`);
const CNPJ_ECT_BASE = "34028316000158"; // ECT/EBCT matriz — público

const PATHS_CANDIDATOS = [
  "poloPassivo.documento",
  "poloAtivo.documento",
  "polo.documento",
  "partes.documento",
  "partes.cpfCnpj",
  "partes.numeroDocumento",
  "envolvidos.documento",
  "envolvidos.cnpj",
  "parteRe.documento",
  "parteRe.cnpj",
  "documentoParte",
  "cpfCnpjParte",
];

for (const p of PATHS_CANDIDATOS) {
  await sonda(`q4_trt2_term_${p.replace(/\./g, "_")}`, "trt2", {
    query: { term: { [p]: CNPJ_ECT_BASE } },
    size: 1,
    track_total_hits: true,
  });
  await sleep(200);
}

// fallback texto livre
await sonda("q4_trt2_multimatch_cnpj_completo", "trt2", {
  query: { multi_match: { query: CNPJ_ECT_BASE, fields: ["*"] } },
  size: 3,
  track_total_hits: true,
});
await sleep(200);

await sonda("q4_trt2_multimatch_cnpj_raiz", "trt2", {
  query: { multi_match: { query: "34028316", fields: ["*"] } },
  size: 3,
  track_total_hits: true,
});
await sleep(200);

// ════════════════════════════════════════════════════════════════════════
// Q5 — Classes processuais usadas no TRT2.
//      Aggregation revela quais códigos de classe carregam precatório/RPV
//      trabalhista (1265/1266 são federais — TRT pode usar outros).
// ════════════════════════════════════════════════════════════════════════
console.log(`\n─── Q5: classes em TRT2 ───`);
await sonda("q5_trt2_aggs_classe_codigo", "trt2", {
  query: { match_all: {} },
  size: 0,
  aggs: { classes: { terms: { field: "classe.codigo", size: 30 } } },
});
await sleep(200);

await sonda("q5_trt2_classe_1265", "trt2", {
  query: { term: { "classe.codigo": 1265 } },
  size: 3,
  track_total_hits: true,
  _source: ["classe", "numeroProcesso"],
});
await sleep(200);
await sonda("q5_trt2_classe_1266", "trt2", {
  query: { term: { "classe.codigo": 1266 } },
  size: 3,
  track_total_hits: true,
  _source: ["classe", "numeroProcesso"],
});
await sleep(200);

await sonda("q5_trt2_match_phrase_precatorio", "trt2", {
  query: { match_phrase: { "classe.nome": "precatório" } },
  size: 5,
  track_total_hits: true,
  _source: ["classe", "numeroProcesso"],
});
await sleep(200);
await sonda("q5_trt2_match_phrase_requisicao", "trt2", {
  query: { match_phrase: { "classe.nome": "requisição" } },
  size: 5,
  track_total_hits: true,
  _source: ["classe", "numeroProcesso"],
});
await sleep(200);

// ════════════════════════════════════════════════════════════════════════
// Q7 — TJRJ por numeroProcesso (20 dígitos).
//      Comentário em estoque_datajud.ts:573-579 diz "não funciona".
//      Verificar empiricamente: pegamos 1 amostra do próprio TJRJ
//      e tentamos buscar por dígitos puros.
// ════════════════════════════════════════════════════════════════════════
console.log(`\n─── Q7: TJRJ por numeroProcesso ───`);
const q7Sample = await sonda("q7_tjrj_pega_amostra", "tjrj", {
  query: { match_all: {} },
  size: 1,
  _source: ["numeroProcesso"],
});
await sleep(200);
const cnjAmostraTJRJ: string | null =
  q7Sample?.hits?.hits?.[0]?._source?.numeroProcesso ?? null;
if (cnjAmostraTJRJ) {
  const digitos = cnjAmostraTJRJ.replace(/\D/g, "");
  await sonda("q7_tjrj_match_numeroProcesso_digitos", "tjrj", {
    query: { match: { numeroProcesso: digitos } },
    size: 1,
    track_total_hits: true,
  });
  await sleep(200);
} else {
  console.log("[sonda] Q7 sem amostra TJRJ — pulando teste de match");
}

// ════════════════════════════════════════════════════════════════════════
// Q8 — Rajada de 20 reqs em TRF1 sem delay.
//      Mede rate-limit real do DataJud sob carga.
// ════════════════════════════════════════════════════════════════════════
console.log(`\n─── Q8: rajada 20 reqs match_all TRF1 (sem delay) ───`);
const burstStart = Date.now();
for (let i = 0; i < 20; i++) {
  await sonda(`q8_burst_${String(i).padStart(2, "0")}`, "trf1", {
    query: { match_all: {} },
    size: 1,
  });
}
const burstMs = Date.now() - burstStart;
console.log(`Burst total: ${burstMs}ms (média ${Math.round(burstMs / 20)}ms/req)`);

// ════════════════════════════════════════════════════════════════════════
// Finalização: manifest agregado + MATRIZ_REAL.md
// ════════════════════════════════════════════════════════════════════════
const ENDED_AT = new Date().toISOString();
const manifest = {
  schema_version: "sonda_datajud_v1",
  run_uuid: RUN_ID,
  started_at: STARTED_AT,
  ended_at: ENDED_AT,
  base_url: BASE,
  key_source: "process.env.DATAJUD_API_KEY",
  total_calls: log.length,
  entries: log,
};
const manifestStr = JSON.stringify(manifest, null, 2);
const manifestSha = createHash("sha256").update(manifestStr).digest("hex");
writeFileSync(`${OUTDIR}/manifest.json`, manifestStr);
writeFileSync(`${OUTDIR}/manifest.sha256`, `${manifestSha}  manifest.json\n`);

// ─── MATRIZ_REAL.md (resumo humano) ─────────────────────────────────────
const md: string[] = [];
md.push(`# Sonda DataJud Fase 0 — Matriz Empírica`);
md.push("");
md.push(`- **Run UUID:** \`${RUN_ID}\``);
md.push(`- **Iniciado:** ${STARTED_AT}`);
md.push(`- **Encerrado:** ${ENDED_AT}`);
md.push(`- **Manifest SHA-256:** \`${manifestSha}\``);
md.push(`- **Total de chamadas:** ${log.length}`);
md.push(`- **Base URL:** ${BASE}`);
md.push(`- **Fonte da chave:** \`process.env.DATAJUD_API_KEY\``);
md.push("");

md.push(`## Q0 — Sanity check TRF1`);
const q0e = log.find((l) => l.label === "q0_sanity_trf1");
md.push("");
md.push(`- HTTP: ${q0e?.http_status} · total_hits: ${q0e?.total_hits ?? "—"} · ${q0e?.elapsed_ms}ms`);
md.push(`- Chaves do \`_source\`: \`${JSON.stringify(q0e?.first_hit_source_keys)}\``);
md.push("");

md.push(`## Q1 — TRTs indexados (24 índices)`);
md.push("");
md.push(`| TRT | HTTP | total_hits | tempo (ms) | _source keys (top 6) |`);
md.push(`|---|---|---|---|---|`);
for (const e of log.filter((l) => l.label.startsWith("q1_"))) {
  const keys = e.first_hit_source_keys
    ? e.first_hit_source_keys.slice(0, 6).join(", ") +
      (e.first_hit_source_keys.length > 6 ? "…" : "")
    : "—";
  md.push(`| ${e.alias} | ${e.http_status} | ${e.total_hits ?? "—"} | ${e.elapsed_ms} | ${keys} |`);
}
md.push("");

md.push(`## Q2/Q3 — Estrutura completa do \`_source\``);
md.push("");
md.push(`| Alias | HTTP | total | Chaves do primeiro hit |`);
md.push(`|---|---|---|---|`);
for (const e of log.filter((l) => l.label.startsWith("q2_"))) {
  md.push(`| ${e.alias} | ${e.http_status} | ${e.total_hits ?? "—"} | \`${JSON.stringify(e.first_hit_source_keys)}\` |`);
}
md.push("");
md.push(`**Detecção heurística de partes/polo/envolvidos no _source:**`);
md.push("");
for (const e of log.filter((l) => l.label.startsWith("q2_"))) {
  const temPartes =
    e.first_hit_source_keys?.some((k) => /part|polo|envolv/i.test(k)) ?? false;
  md.push(`- ${e.alias}: ${temPartes ? "✅ SIM — chave detectada no top-level" : "❌ não detectado no top-level (pode estar aninhado — ver raw)"}`);
}
md.push("");

md.push(`## Q4 — Filtro por CNPJ ECT (${CNPJ_ECT_BASE}) em TRT2`);
md.push("");
md.push(`| Path tentado | HTTP | total_hits |`);
md.push(`|---|---|---|`);
for (const e of log.filter((l) => l.label.startsWith("q4_"))) {
  md.push(`| ${e.label.replace("q4_trt2_", "")} | ${e.http_status} | ${e.total_hits ?? "—"} |`);
}
md.push("");
md.push(`**Decisão derivada:** path com \`total_hits > 0\` é o caminho real de indexação. HTTP 400 = path inválido (Elastic recusou o term). HTTP 200 com total=0 = path válido mas a empresa não tem processo lá.`);
md.push("");

md.push(`## Q5 — Classes processuais em TRT2`);
md.push("");
md.push(`- Aggregation top 30 classes: \`raw/q5_trt2_aggs_classe_codigo.json\` (ver \`aggregations.classes.buckets\`)`);
md.push(`- Classe 1265 (precatório federal): total=${log.find((l) => l.label === "q5_trt2_classe_1265")?.total_hits ?? "—"}`);
md.push(`- Classe 1266 (RPV federal): total=${log.find((l) => l.label === "q5_trt2_classe_1266")?.total_hits ?? "—"}`);
md.push(`- Match phrase "precatório" em classe.nome: total=${log.find((l) => l.label === "q5_trt2_match_phrase_precatorio")?.total_hits ?? "—"}`);
md.push(`- Match phrase "requisição" em classe.nome: total=${log.find((l) => l.label === "q5_trt2_match_phrase_requisicao")?.total_hits ?? "—"}`);
md.push("");

md.push(`## Q7 — TJRJ por numeroProcesso (20 dígitos)`);
const q7sample = log.find((l) => l.label === "q7_tjrj_pega_amostra");
const q7match = log.find((l) => l.label === "q7_tjrj_match_numeroProcesso_digitos");
md.push("");
md.push(`- Amostra TJRJ (match_all size 1): HTTP ${q7sample?.http_status}, total=${q7sample?.total_hits ?? "—"}`);
if (q7match) {
  md.push(`- Busca por dígitos puros do CNJ amostra: HTTP ${q7match.http_status}, total=${q7match.total_hits ?? "—"}`);
  md.push(`- **Conclusão:** ${(q7match.total_hits ?? 0) > 0 ? "✅ TJRJ via DataJud por numeroProcesso FUNCIONA (comentário no código atual é falso)" : "❌ TJRJ via DataJud por numeroProcesso retorna 0 (comentário no código atual procede)"}`);
} else {
  md.push(`- Teste de match não rodou (sem amostra prévia).`);
}
md.push("");

md.push(`## Q8 — Rajada 20 reqs em TRF1 (sem delay)`);
const q8s = log.filter((l) => l.label.startsWith("q8_"));
md.push("");
md.push(`- Tempo total: ${q8s.reduce((s, e) => s + e.elapsed_ms, 0)}ms`);
md.push(`- HTTP 200: ${q8s.filter((e) => e.http_status === 200).length}/20`);
md.push(`- HTTP 429 (rate limit): ${q8s.filter((e) => e.http_status === 429).length}/20`);
md.push(`- Outros status: ${q8s.filter((e) => e.http_status !== 200 && e.http_status !== 429).map((e) => e.http_status).join(", ") || "nenhum"}`);
const q8headers = q8s[0]?.response_headers ?? {};
const rateLimitHeaders = Object.keys(q8headers).filter((k) =>
  /rate|limit|quota|retry/i.test(k),
);
md.push(`- Headers de rate-limit detectados na primeira resposta: ${rateLimitHeaders.length > 0 ? rateLimitHeaders.join(", ") : "**nenhum**"}`);
md.push("");

md.push(`---`);
md.push("");
md.push(`## Cadeia de custódia (AuraTRUST)`);
md.push("");
md.push(`| Selo | Status | Onde |`);
md.push(`|---|---|---|`);
md.push(`| UUID v4 por run | ✅ | \`run_uuid\` no manifest |`);
md.push(`| SHA-256 do payload bruto por call | ✅ | \`sha256_payload\` em cada entry |`);
md.push(`| Timestamp UTC ISO-8601 | ✅ | \`requested_at_iso\` em cada entry |`);
md.push(`| Endpoint persistido | ✅ | \`endpoint\` |`);
md.push(`| HTTP status persistido | ✅ | \`http_status\` |`);
md.push(`| Response headers persistidos | ✅ | \`response_headers\` |`);
md.push(`| Payload bruto em arquivo | ✅ | \`raw/<label>.json\` |`);
md.push(`| Manifest agregado selado | ✅ | \`manifest.sha256\` |`);
md.push("");

writeFileSync(`${OUTDIR}/MATRIZ_REAL.md`, md.join("\n"));

console.log(`\n═══ Sonda concluída ═══`);
console.log(`📁 ${OUTDIR}`);
console.log(`📄 ${OUTDIR}/MATRIZ_REAL.md`);
console.log(`🔒 manifest SHA-256: ${manifestSha}`);
process.exit(0);
