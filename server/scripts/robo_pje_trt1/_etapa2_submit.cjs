/**
 * ETAPA 2: usa o storageState salvo, preenche o captcha com a resposta lida,
 * clica enviar e captura TODOS os requests + responses.
 *
 * Uso: node _etapa2_submit.cjs <RESPOSTA_CAPTCHA>
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const RESPOSTA = process.argv[2];
if (!RESPOSTA) {
  console.error("USO: node _etapa2_submit.cjs <RESPOSTA_CAPTCHA>");
  process.exit(2);
}

const OUT = path.join(__dirname, "_evidencia_exploracao");
const CTX_JSON = JSON.parse(fs.readFileSync(path.join(OUT, "contexto_captcha.json"), "utf-8"));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 Chrome/124",
    viewport: { width: 1440, height: 900 },
    storageState: CTX_JSON.storageState,
  });
  const page = await ctx.newPage();

  const trafego = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("pje-consulta-api")) {
      trafego.push({
        tipo: "REQ",
        method: req.method(),
        url: u,
        headers: req.headers(),
        postData: req.postData(),
        time: Date.now(),
      });
    }
  });
  page.on("response", async (resp) => {
    const u = resp.url();
    if (u.includes("pje-consulta-api")) {
      let body = null;
      try {
        body = await resp.text();
      } catch {}
      trafego.push({
        tipo: "RES",
        status: resp.status(),
        url: u,
        bodyLen: body ? body.length : 0,
        bodyPreview: body ? body.substring(0, 500) : null,
        bodyFull: body,
        time: Date.now(),
      });
    }
  });

  console.log("Navegando para detalhe-processo...");
  await page.goto(CTX_JSON.url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(4000);

  console.log(`Preenchendo captcha com "${RESPOSTA}"...`);
  await page.fill("#captchaInput", RESPOSTA);
  await page.waitForTimeout(500);

  console.log("Clicando ENVIAR...");
  const btn = page.locator('button:has-text("ENVIAR"), button:has-text("Enviar")').first();
  await btn.click({ timeout: 5000 });
  await page.waitForTimeout(8000); // espera resposta full

  // Re-extrair texto da pagina
  const txt = await page.locator("body").innerText();
  fs.writeFileSync(path.join(OUT, "post_submit_text.txt"), txt, "utf-8");

  await page.screenshot({ path: path.join(OUT, "post_submit.png"), fullPage: true });

  fs.writeFileSync(
    path.join(OUT, "trafego_pos_submit.json"),
    JSON.stringify(trafego, null, 2),
    "utf-8"
  );

  console.log(`\n=== ${trafego.length} eventos capturados ===`);
  // Imprimir em ordem
  trafego.forEach((t) => {
    if (t.tipo === "REQ") {
      const tail = t.url.split("/api/")[1] || t.url.substring(40, 100);
      console.log(`  REQ ${t.method.padEnd(4)} /api/${tail.substring(0, 80)}`);
      if (t.postData) console.log(`      body: ${t.postData.substring(0, 200)}`);
      // Headers de interesse
      const hdrs = ["x-desafio", "desafio", "x-token", "token-desafio", "authorization"];
      hdrs.forEach((h) => {
        const v = t.headers[h];
        if (v) console.log(`      header ${h}: ${v.substring(0, 80)}`);
      });
    } else {
      const tail = t.url.split("/api/")[1] || t.url.substring(40, 100);
      console.log(`  RES ${t.status} (${t.bodyLen}b) /api/${tail.substring(0, 80)}`);
      if (t.bodyPreview && t.bodyLen < 2000) {
        console.log(`      body: ${t.bodyPreview.substring(0, 200)}`);
      }
    }
  });

  // Texto da pagina após submit
  console.log("\n=== Texto da pagina apos submit (primeiros 600 chars) ===");
  console.log(txt.substring(0, 600).replace(/\n/g, " | "));

  await browser.close();
})();
