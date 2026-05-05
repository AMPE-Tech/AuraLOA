/**
 * Submete o captcha (com resposta errada) para descobrir o endpoint de validacao.
 * Captura tanto request quanto response.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CNJ = "0110494-40.2024.5.01.0000";
const URL = `https://pje.trt1.jus.br/consultaprocessual/detalhe-processo/${CNJ}/2`;
const OUT = path.join(__dirname, "_evidencia_exploracao");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  // Capturar TODOS requests + responses do api
  const trafego = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("pje-consulta-api")) {
      trafego.push({
        tipo: "REQUEST",
        method: req.method(),
        url: u,
        headers: req.headers(),
        postData: req.postData(),
      });
    }
  });
  page.on("response", async (resp) => {
    const u = resp.url();
    if (u.includes("pje-consulta-api")) {
      let body = null;
      try {
        body = await resp.text();
        if (body.length > 500) body = body.substring(0, 500) + "...[truncated]";
      } catch {}
      trafego.push({
        tipo: "RESPONSE",
        status: resp.status(),
        url: u,
        body,
      });
    }
  });

  console.log(`Abrindo ${URL}`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(8000);

  // Achar o campo de input de captcha (geralmente label "Resposta" ou similar)
  console.log("Buscando campo de captcha...");
  const inputs = await page.locator("input").all();
  console.log(`Total inputs visiveis: ${inputs.length}`);
  for (let i = 0; i < inputs.length; i++) {
    try {
      const id = await inputs[i].getAttribute("id");
      const name = await inputs[i].getAttribute("name");
      const type = await inputs[i].getAttribute("type");
      const placeholder = await inputs[i].getAttribute("placeholder");
      console.log(`  [${i}] id=${id} name=${name} type=${type} placeholder=${placeholder}`);
    } catch {}
  }

  // Tentar encontrar o input por label "Resposta"
  const captchaInput = page.locator('input[type="text"]:visible').first();
  await captchaInput.fill("XXXXXX").catch(() => {});

  // Achar botao "Enviar"
  const btn = page.locator('button:has-text("ENVIAR"), button:has-text("Enviar")').first();
  console.log("Clicando ENVIAR (com resposta errada XXXXXX)...");
  await btn.click({ timeout: 5000 }).catch((e) => console.log(`Erro click: ${e.message}`));
  await page.waitForTimeout(5000);

  fs.writeFileSync(
    path.join(OUT, "trafego_submit_captcha.json"),
    JSON.stringify(trafego, null, 2),
    "utf-8"
  );
  console.log(`\nTrafego salvo: ${trafego.length} eventos`);

  // Mostrar requests POST/PUT que sao candidatos a submissao
  console.log("\n=== Requests POST/PUT/PATCH ===");
  trafego
    .filter((t) => t.tipo === "REQUEST" && ["POST", "PUT", "PATCH"].includes(t.method))
    .forEach((t) => {
      console.log(`  ${t.method} ${t.url}`);
      if (t.postData) console.log(`    body: ${t.postData.substring(0, 300)}`);
    });

  await browser.close();
})();
