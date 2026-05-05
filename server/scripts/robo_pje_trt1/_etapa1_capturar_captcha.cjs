/**
 * ETAPA 1: abre pagina, captura captcha + token, salva contexto.
 * Mantém o browser aberto e salva o storageState para a etapa 2 reusar a sessão.
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
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  let processoData = null;
  page.on("response", async (resp) => {
    const u = resp.url();
    if (u.match(/\/api\/processos\/\d+$/)) {
      try {
        processoData = JSON.parse(await resp.text());
      } catch {}
    }
  });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3000);

  if (!processoData) {
    console.error("Falha: nao capturou /api/processos/<id>");
    await browser.close();
    process.exit(1);
  }

  // Decodificar imagem
  const buf = Buffer.from(processoData.imagem, "base64");
  fs.writeFileSync(path.join(OUT, "captcha_atual.jpg"), buf);

  const ctxJson = {
    cnj: CNJ,
    url: URL,
    tokenDesafio: processoData.tokenDesafio,
    storageState: await ctx.storageState(),
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "contexto_captcha.json"), JSON.stringify(ctxJson, null, 2), "utf-8");

  await browser.close();
  console.log("Captcha salvo em _evidencia_exploracao/captcha_atual.jpg");
  console.log("Token salvo em _evidencia_exploracao/contexto_captcha.json");
  console.log("Token (primeiros 60):", processoData.tokenDesafio.substring(0, 60));
})();
