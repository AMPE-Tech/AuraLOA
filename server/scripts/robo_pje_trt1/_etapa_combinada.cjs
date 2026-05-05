/**
 * Captura captcha, ESPERA arquivo answer.txt aparecer, submete, captura trafego.
 * Roda em uma unica sessao Playwright (token preservado).
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CNJ = "0110494-40.2024.5.01.0000";
const URL = `https://pje.trt1.jus.br/consultaprocessual/detalhe-processo/${CNJ}/2`;
const OUT = path.join(__dirname, "_evidencia_exploracao");
const CAPTCHA_FILE = path.join(OUT, "captcha_atual.jpg");
const ANSWER_FILE = path.join(OUT, "answer.txt");
const TRAFEGO_FILE = path.join(OUT, "trafego_pos_submit.json");

// limpar arquivo de resposta antigo
if (fs.existsSync(ANSWER_FILE)) fs.unlinkSync(ANSWER_FILE);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  const trafego = [];
  let processoData = null;
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("pje-consulta-api")) {
      trafego.push({
        tipo: "REQ",
        method: req.method(),
        url: u,
        headers: req.headers(),
        postData: req.postData(),
      });
    }
  });
  page.on("response", async (resp) => {
    const u = resp.url();
    if (!u.includes("pje-consulta-api")) return;
    let body = null;
    try { body = await resp.text(); } catch {}
    trafego.push({
      tipo: "RES",
      status: resp.status(),
      url: u,
      bodyLen: body ? body.length : 0,
      bodyFull: body,
    });
    // Capturar captcha do primeiro hit em /processos/<id>
    if (!processoData && u.match(/\/api\/processos\/\d+$/) && body) {
      try {
        const j = JSON.parse(body);
        if (j.imagem && j.tokenDesafio) processoData = j;
      } catch {}
    }
  });

  console.log(`[${new Date().toISOString()}] navegando ${URL}`);
  await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3000);

  if (!processoData || !processoData.imagem) {
    console.error("Sem captcha capturado");
    await browser.close();
    process.exit(1);
  }

  fs.writeFileSync(CAPTCHA_FILE, Buffer.from(processoData.imagem, "base64"));
  console.log(`captcha salvo: ${CAPTCHA_FILE}`);
  console.log(`token: ${processoData.tokenDesafio.substring(0, 60)}...`);
  console.log(`aguardando arquivo: ${ANSWER_FILE}`);
  console.log("(grave a resposta nesse arquivo para prosseguir)");

  // Polling pelo answer
  const ttl = 180; // 3 min
  let secs = 0;
  while (!fs.existsSync(ANSWER_FILE) && secs < ttl) {
    await new Promise(r => setTimeout(r, 1000));
    secs++;
  }
  if (!fs.existsSync(ANSWER_FILE)) {
    console.error("timeout aguardando answer.txt");
    await browser.close();
    process.exit(1);
  }

  const resposta = fs.readFileSync(ANSWER_FILE, "utf-8").trim();
  console.log(`[${new Date().toISOString()}] resposta lida: "${resposta}" - preenchendo`);

  await page.fill("#captchaInput", resposta);
  await page.waitForTimeout(300);

  console.log("clicando ENVIAR...");
  const btn = page.locator('button:has-text("ENVIAR"), button:has-text("Enviar")').first();
  await btn.click({ timeout: 5000 });
  await page.waitForTimeout(10000);

  await page.screenshot({ path: path.join(OUT, "post_submit.png"), fullPage: true });
  const txt = await page.locator("body").innerText();
  fs.writeFileSync(path.join(OUT, "post_submit_text.txt"), txt, "utf-8");

  fs.writeFileSync(TRAFEGO_FILE, JSON.stringify(trafego, null, 2), "utf-8");

  console.log(`\n=== ${trafego.length} eventos ===`);
  trafego.forEach(t => {
    if (t.tipo === "REQ") {
      const tail = (t.url.split("/api/")[1] || "").substring(0, 90);
      console.log(`  REQ ${t.method} /api/${tail}`);
      if (t.postData) console.log(`      body: ${t.postData.substring(0, 200)}`);
    } else {
      const tail = (t.url.split("/api/")[1] || "").substring(0, 90);
      console.log(`  RES ${t.status} (${t.bodyLen}b) /api/${tail}`);
    }
  });

  console.log("\n=== TEXTO DA PAGINA APOS SUBMIT (primeiros 800) ===");
  console.log(txt.substring(0, 800).replace(/\n+/g, " | "));

  await browser.close();
})();
