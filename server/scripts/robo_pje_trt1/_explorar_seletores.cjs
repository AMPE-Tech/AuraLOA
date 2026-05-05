/**
 * Explorador de seletores PJe TRT1.
 * Abre a pagina de detalhe-processo com Playwright, espera renderizar,
 * salva HTML + screenshot, e dumpa amostra de elementos potenciais.
 *
 * Uso: node _explorar_seletores.cjs
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CNJ = "0110494-40.2024.5.01.0000";
const GRAU = "2";
const URL_DETALHE = `https://pje.trt1.jus.br/consultaprocessual/detalhe-processo/${CNJ}/${GRAU}`;
const URL_BUSCA = "https://pje.trt1.jus.br/consultaprocessual/";

const OUT_DIR = path.join(__dirname, "_evidencia_exploracao");
fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  console.log(`[explorar] Abrindo URL direta: ${URL_DETALHE}`);
  let respostaXhr = null;
  page.on("response", async (resp) => {
    const u = resp.url();
    if (/api|process|detalhe/i.test(u) && resp.request().resourceType() === "xhr") {
      console.log(`  XHR ${resp.status()} ${u.substring(0, 110)}`);
      if (resp.status() === 200 && /processo|detalhe/i.test(u) && !respostaXhr) {
        try {
          const body = await resp.text();
          if (body && body.length > 100 && body.length < 200000) {
            respostaXhr = { url: u, body };
          }
        } catch {}
      }
    }
  });

  await page.goto(URL_DETALHE, { waitUntil: "domcontentloaded", timeout: 45000 });
  // Esperar SPA renderizar
  await page.waitForTimeout(8000);

  // Screenshot e HTML
  const png = path.join(OUT_DIR, "detalhe_direto.png");
  await page.screenshot({ path: png, fullPage: true });
  console.log(`  screenshot: ${png}`);

  const html = await page.content();
  fs.writeFileSync(path.join(OUT_DIR, "detalhe_direto.html"), html, "utf-8");
  console.log(`  html: ${html.length} bytes`);

  // Texto visível
  const texto = await page.locator("body").innerText().catch(() => "");
  fs.writeFileSync(path.join(OUT_DIR, "detalhe_direto_text.txt"), texto, "utf-8");
  console.log(`  texto: ${texto.length} chars`);
  console.log(`  primeiros 500 chars do texto: ${texto.substring(0, 500).replace(/\n/g, " | ")}`);

  // Tentar extrair elementos chave
  console.log("\n[explorar] Procurando elementos com palavras-chave 'parte', 'autor', 'reu':");
  const candidatos = await page.evaluate(() => {
    const palavras = /parte|polo|autor|reclamante|reu|reclamado|exequente|executado/i;
    const out = [];
    document.querySelectorAll("*").forEach((el) => {
      const id = el.id || "";
      const cls = el.className && typeof el.className === "string" ? el.className : "";
      if (palavras.test(id) || palavras.test(cls)) {
        out.push({
          tag: el.tagName.toLowerCase(),
          id,
          class: cls.substring(0, 100),
          text: (el.innerText || "").substring(0, 100).replace(/\n/g, " | "),
        });
      }
    });
    return out.slice(0, 50);
  });
  fs.writeFileSync(path.join(OUT_DIR, "elementos_candidatos.json"), JSON.stringify(candidatos, null, 2), "utf-8");
  console.log(`  elementos com id/class de partes: ${candidatos.length}`);
  candidatos.slice(0, 10).forEach((c) => {
    console.log(`    <${c.tag} id="${c.id}" class="${c.class.substring(0, 50)}"> "${c.text.substring(0, 60)}"`);
  });

  // Salvar XHR de detalhes se capturado
  if (respostaXhr) {
    fs.writeFileSync(
      path.join(OUT_DIR, "xhr_detalhes.json"),
      JSON.stringify(respostaXhr, null, 2),
      "utf-8"
    );
    console.log(`\n  XHR de detalhes capturado: ${respostaXhr.url.substring(0, 100)}`);
    console.log(`  preview: ${respostaXhr.body.substring(0, 300)}`);
  } else {
    console.log("\n  Nenhum XHR de detalhes capturado");
  }

  await browser.close();
  console.log("\n[explorar] Done.");
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
