/**
 * _caso_A_1661378.cjs
 * Precatório 1661378120254010000 · R$ 29,77M · 8 anos · EFU · FUNDEF
 * Tentativas em cascata para obter CNJ originário + credor + advogado.
 */

const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PRECATORIO = "1661378120254010000";
const OUT = path.resolve("Saida/caso_A_" + PRECATORIO + "_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

function datajudQuery(idx, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: "api-publica.datajud.cnj.jus.br",
      path: `/${idx}/_search`,
      method: "POST",
      headers: { "Authorization": "APIKey " + DATAJUD_KEY, "Content-Type": "application/json", "Content-Length": body.length },
    }, (res) => { let b = ""; res.on("data", c => b += c); res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.write(body); req.end();
  });
}

(async () => {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║ CASO A · ${PRECATORIO}                                   ║`);
  console.log(`║ Valor R$ 29,77M · 8 anos · EFU · FUNDEF                   ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "pt-BR",
  });

  // ── TENTATIVA 1 — PJe 1g Consulta Pública, campo "Processo" (numeroProcesso)
  console.log("\n[T1] PJe 1g — busca direta pelo Nº LOA como CNJ");
  const page1 = await ctx.newPage();
  try {
    await page1.goto("https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam", { waitUntil: "domcontentloaded", timeout: 40000 });
    await page1.waitForTimeout(3000);
    const inputProc = await page1.$('input[id*="NumeroProcesso"]');
    if (inputProc) {
      await inputProc.click();
      await inputProc.fill(PRECATORIO);
      await page1.waitForTimeout(1000);
      const btn = await page1.$('input[type="submit"][value*="Pesquisar"], button:has-text("Pesquisar")');
      if (btn) {
        await btn.click();
        await page1.waitForTimeout(5000);
      }
      await page1.screenshot({ path: path.join(OUT, "t1_pje_num_processo.png"), fullPage: true });
      const body = (await page1.textContent("body")) || "";
      const achou = !/nenhum processo encontrado|nenhum registro/i.test(body);
      console.log(`     resultado: ${achou ? "✓ possivelmente achou — checar screenshot" : "✗ nada encontrado"}`);
    }
  } catch (e) { console.log(`     erro: ${e.message.substring(0,100)}`); }
  await page1.close();

  // ── TENTATIVA 2 — PJe 1g, campo "Número Outro" (referência externa)
  console.log("\n[T2] PJe 1g — campo 'Número Outro' (referência externa)");
  const page2 = await ctx.newPage();
  try {
    await page2.goto("https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam", { waitUntil: "domcontentloaded", timeout: 40000 });
    await page2.waitForTimeout(3000);
    // Listar todos os inputs visíveis pra debug
    const inputs = await page2.$$eval("input", els => els.map(e => ({ id: e.id, name: e.name, type: e.type, placeholder: e.placeholder })));
    fs.writeFileSync(path.join(OUT, "t2_inputs_pje.json"), JSON.stringify(inputs, null, 2));
    console.log(`     ${inputs.length} inputs encontrados na página (lista em t2_inputs_pje.json)`);

    // Tentar campo "Número Referência" (varia de layout, tentamos vários)
    let usou = null;
    for (const seletor of ['input[id*="numeroProcessoReferencia"]', 'input[id*="Referencia"]', 'input[id*="Outro"]']) {
      const el = await page2.$(seletor);
      if (el) { await el.click(); await el.fill(PRECATORIO); usou = seletor; break; }
    }
    if (usou) {
      console.log(`     usei seletor: ${usou}`);
      const btn = await page2.$('input[type="submit"][value*="Pesquisar"], button:has-text("Pesquisar")');
      if (btn) { await btn.click(); await page2.waitForTimeout(5000); }
      await page2.screenshot({ path: path.join(OUT, "t2_pje_num_outro.png"), fullPage: true });
    } else {
      console.log("     nenhum campo de 'referência externa' encontrado no form");
    }
  } catch (e) { console.log(`     erro: ${e.message.substring(0,100)}`); }
  await page2.close();

  // ── TENTATIVA 3 — DataJud match em numeroProcesso variando padrões
  console.log("\n[T3] DataJud — varreduras por variações do Nº LOA");
  const variantes = [
    PRECATORIO,                                 // 1661378120254010000 (19 díg)
    "0" + PRECATORIO,                           // 01661378120254010000 (20 díg)
    PRECATORIO.substring(0, 7) + "-" + PRECATORIO.substring(7, 9) + "." + PRECATORIO.substring(9, 13) + ".4.01." + PRECATORIO.substring(15, 19), // formato CNJ tentativo
  ];
  const achados = [];
  for (const idx of ["api_publica_trf1", "api_publica_tst", "api_publica_trt3", "api_publica_stf", "api_publica_stj"]) {
    for (const variante of variantes) {
      try {
        const r = await datajudQuery(idx, { query: { match: { numeroProcesso: variante.replace(/\D/g, "") } }, size: 2 });
        const total = r.hits?.total?.value || 0;
        if (total > 0) {
          achados.push({ idx, variante, total, hits: r.hits.hits.map(h => h._source) });
          console.log(`     ${idx} · variante "${variante}" → ${total} hits ✓`);
        }
      } catch {}
    }
  }
  if (achados.length === 0) console.log("     nenhum match no DataJud em nenhuma variante");
  fs.writeFileSync(path.join(OUT, "t3_datajud_variantes.json"), JSON.stringify(achados, null, 2));

  // ── TENTATIVA 4 — DataJud: buscar por termo literal do processo FUNDEF com UO EFU e valor próximo
  console.log("\n[T4] DataJud — FUNDEF + União Federal como parte");
  try {
    const r = await datajudQuery("api_publica_trf1", {
      query: {
        bool: {
          must: [
            { match: { "assuntos.nome": "FUNDEF" } },
            { range: { dataAjuizamento: { gte: "2016-01-01", lte: "2017-12-31" } } },
          ],
        },
      },
      size: 10,
      _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "orgaoJulgador", "partes.pessoa.nome"],
    });
    const hits = r.hits?.hits || [];
    console.log(`     FUNDEF ajuizados 2016-2017: ${r.hits?.total?.value} hits`);
    hits.forEach((h, i) => {
      const s = h._source;
      const partes = (s.partes || []).map(p => p.pessoa?.nome || "").filter(Boolean).slice(0, 3);
      console.log(`     #${i+1} ${s.numeroProcesso} · ${s.classe?.nome} · ajuiz=${s.dataAjuizamento?.slice(0,10)} · partes: ${partes.join(" // ")}`);
    });
    fs.writeFileSync(path.join(OUT, "t4_datajud_fundef_2016.json"), JSON.stringify(hits, null, 2));
  } catch (e) { console.log(`     erro: ${e.message}`); }

  await browser.close();
  console.log(`\n══ FIM ══ Saídas em ${OUT}`);
})();
