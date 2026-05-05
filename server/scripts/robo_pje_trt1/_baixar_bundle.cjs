const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "_evidencia_exploracao");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 Chrome/124" });
  const page = await ctx.newPage();

  const jsFiles = [];
  page.on("response", async (resp) => {
    const u = resp.url();
    if (u.endsWith(".js") && resp.status() === 200) {
      try {
        const body = await resp.text();
        const fname = u.split("/").pop().split("?")[0];
        fs.writeFileSync(path.join(OUT, "js_" + fname), body, "utf-8");
        jsFiles.push({ url: u, size: body.length, fname });
      } catch {}
    }
  });

  await page.goto("https://pje.trt1.jus.br/consultaprocessual/detalhe-processo/0110494-40.2024.5.01.0000/2",
    { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(5000);
  await browser.close();

  console.log(`${jsFiles.length} JS baixados:`);
  jsFiles.forEach(j => console.log(`  ${j.size.toString().padStart(8)} ${j.fname}`));
})();
