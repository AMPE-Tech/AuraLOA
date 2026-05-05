/**
 * _evid_trf1_antigo.cjs — Evidência via TRF1 sistema antigo + DataJud API (JSON cru)
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const https = require("https");

const OUT = path.resolve("Saida/evidencias_cnj_candidato_20260422");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const CASOS = [
  { label: "EFU_FUNDEF_29M",        loa: "1661378120254010000", cnj: "0166137-81.2025.4.01.9198", cnj_numerico: "01661378120254019198" },
  { label: "INCRA_Reintegracao_27M", loa: "569062220254019000",  cnj: "0056906-22.2025.4.01.9198", cnj_numerico: "00569062220254019198" },
];

const DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

async function consultaDataJud(cnjNumerico) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query: { match: { numeroProcesso: cnjNumerico } }, size: 3 });
    const req = https.request({
      hostname: "api-publica.datajud.cnj.jus.br",
      path: "/api_publica_trf1/_search",
      method: "POST",
      headers: { "Authorization": "APIKey " + DATAJUD_KEY, "Content-Type": "application/json", "Content-Length": payload.length },
    }, (res) => {
      let body = ""; res.on("data", c => body += c);
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
    req.write(payload); req.end();
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  for (const caso of CASOS) {
    console.log(`\n══ ${caso.label} · CNJ: ${caso.cnj} · LOA: ${caso.loa}`);

    // 1. DataJud API (prova programática)
    try {
      const rjson = await consultaDataJud(caso.cnj_numerico);
      const hits = rjson.hits?.hits || [];
      console.log(`  ► DataJud TRF1: ${rjson.hits?.total?.value} hits`);
      fs.writeFileSync(path.join(OUT, `${caso.label}_datajud.json`), JSON.stringify(rjson, null, 2));
      if (hits.length > 0) hits.forEach(h => console.log(`    CNJ: ${h._source.numeroProcesso} · classe: ${h._source.classe?.nome}`));
    } catch (e) { console.log(`  ✗ DataJud erro: ${e.message}`); }

    // 2. TRF1 sistema antigo (processual.trf1.jus.br) — Playwright
    const page = await ctx.newPage();
    try {
      // processual.trf1.jus.br aceita número CNJ ou número interno. Vamos tentar com CNJ formatado.
      const url = `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${caso.cnj}&secao=TRF1`;
      console.log(`  ► TRF1 antigo: ${url}`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      const shot = path.join(OUT, `${caso.label}_trf1antigo.png`);
      await page.screenshot({ path: shot, fullPage: true });
      const txt = await page.textContent("body");
      const naoAchou = /não foi encontrado|nenhum processo encontrado|processo não localizado/i.test(txt || "");
      console.log(`    ✓ screenshot salvo: ${shot}`);
      console.log(`    texto na página: ${naoAchou ? "❌ NÃO ENCONTRADO" : "✓ página carregou (verificar visualmente)"}`);
    } catch (e) { console.log(`  ✗ TRF1 antigo erro: ${e.message}`); }
    await page.close();
  }

  await browser.close();
  console.log(`\n══ Evidências em: ${OUT}`);
})();
