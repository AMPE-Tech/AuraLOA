const KEY = process.env.DATAJUD_API_KEY;
if (!KEY) { console.error("DATAJUD_API_KEY ausente"); process.exit(1); }

const BASE = "https://api-publica.datajud.cnj.jus.br";
const CNJ_SANTA_CASA_1G = "1061297-10.2020.4.01.3400"; // ação originária/execução 1º grau
const CNJ_SANTA_CASA_2G = "1048421-33.2023.4.01.0000"; // agravo interno 2º grau

const endpoint = `${BASE}/api_publica_trf1/_search`;

async function consultar(titulo: string, esQuery: any) {
  console.log(`\n═══ ${titulo} ═══`);
  console.log(`Query: ${JSON.stringify(esQuery).slice(0, 200)}...`);
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `APIKey ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(esQuery),
  });
  console.log(`HTTP ${resp.status}`);
  const data: any = await resp.json();
  const total = data.hits?.total?.value ?? 0;
  const hits = data.hits?.hits ?? [];
  console.log(`Total: ${total}`);
  if (total > 0) {
    console.log(`Primeiros ${Math.min(3, hits.length)} resultados:`);
    for (const h of hits.slice(0, 3)) {
      const s = h._source;
      console.log(`  CNJ: ${s.numeroProcesso} | classe: ${s.classe?.nome} (${s.classe?.codigo}) | grau: ${s.grau} | movimentos: ${(s.movimentos||[]).length}`);
    }
  }
  return { total, hits };
}

// ── TESTE 1: busca direta pelo CNJ 1º grau (número sem pontos) ──
await consultar("CNJ 1º grau por numeroProcesso", {
  query: { match: { numeroProcesso: CNJ_SANTA_CASA_1G.replace(/\D/g, "") } },
  size: 5,
});

// ── TESTE 2: CNJ 2º grau ──
await consultar("CNJ 2º grau por numeroProcesso", {
  query: { match: { numeroProcesso: CNJ_SANTA_CASA_2G.replace(/\D/g, "") } },
  size: 5,
});

// ── TESTE 3: apenas classe precatório 1265 no TRF1 ──
await consultar("Classe Precatório (1265) no TRF1", {
  query: { term: { "classe.codigo": 1265 } },
  size: 3,
});

// ── TESTE 4: classe Cumprimento de Sentença (156) ──
await consultar("Classe Cumprimento de Sentença contra Faz. Pública (156) TRF1", {
  query: { term: { "classe.codigo": 156 } },
  size: 3,
});

// ── TESTE 5: buscar por fragmento do número ──
await consultar("Busca 'query_string' por 1061297", {
  query: { query_string: { query: "1061297", default_field: "numeroProcesso" } },
  size: 3,
});

process.exit(0);
