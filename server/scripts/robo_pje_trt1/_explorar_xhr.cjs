/**
 * Captura TODOS os XHRs da consulta de processo TRT1 e salva conteudo.
 * Objetivo: descobrir se a API retorna partes sem resolver captcha,
 * ou se o captcha eh barreira efetiva.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CNJ = "0110494-40.2024.5.01.0000";
const GRAU = "2";
const URL = `https://pje.trt1.jus.br/consultaprocessual/detalhe-processo/${CNJ}/${GRAU}`;
const OUT = path.join(__dirname, "_evidencia_exploracao", "xhrs");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  let counter = 0;
  page.on("response", async (resp) => {
    const u = resp.url();
    if (!u.includes("pje-consulta-api")) return;
    counter++;
    try {
      const body = await resp.text();
      const safe = u.replace(/[^a-zA-Z0-9]/g, "_").slice(-80);
      const fname = path.join(OUT, `${String(counter).padStart(3,"0")}_${resp.status()}_${safe}.txt`);
      fs.writeFileSync(fname, `URL: ${u}\nSTATUS: ${resp.status()}\n\n${body}`, "utf-8");
      console.log(`[xhr ${counter}] ${resp.status()} ${u.substring(40, 130)} (${body.length} bytes)`);
    } catch (e) {
      console.log(`[xhr ${counter}] ERR ${u.substring(0,90)}: ${e.message}`);
    }
  });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(10000);
  await browser.close();
  console.log(`\nDone. ${counter} XHRs capturados em ${OUT}`);
})();
