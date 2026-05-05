/**
 * buscar-jurisprudencia-tjsp.ts (v2 · com stealth do tjsp_auth.ts)
 * Busca acórdão TJSP via Consulta Pública de Jurisprudência (cjsg).
 * Bypass anti-bot: headful + flags Playwright + addInitScript navigator stealth.
 *
 * USO:
 *   npx tsx server/scripts/buscar-jurisprudencia-tjsp.ts \
 *     --processo="0033717-04.2012.8.26.0577" \
 *     --saida="C:/Temp/auraloa-saida/jurisp"
 */

import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)=?(.*)$/.exec(arg);
    if (m) args[m[1]] = m[2] || "true";
  }
  return args;
}

async function buscarAcordao(processo: string, saida: string) {
  fs.mkdirSync(saida, { recursive: true });
  console.log(`[START] Buscando jurisprudência TJSP para ${processo}`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 120,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--start-maximized",
      "--disable-extensions",
      "--disable-gpu",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["pt-BR", "pt", "en-US"] });
  });

  const page = await context.newPage();
  await page.waitForTimeout(800 + Math.random() * 600);

  try {
    console.log(`[NAV] Acessando portal de Consulta de Jurisprudência...`);
    await page.goto("https://esaj.tjsp.jus.br/cjsg/consultaCompleta.do", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForTimeout(1500 + Math.random() * 1000);

    // Campo correto descoberto via inspeção do HTML: name="dados.nuProcOrigem"
    const campoNumero = page.locator('input[name="dados.nuProcOrigem"]').first();
    const campoVisivel = await campoNumero.isVisible().catch(() => false);

    if (campoVisivel) {
      await campoNumero.click();
      await page.waitForTimeout(300 + Math.random() * 200);
      await campoNumero.fill(processo);
      console.log(`[FORM] Número preenchido em dados.nuProcOrigem: ${processo}`);
    } else {
      console.log(`[WARN] Campo dados.nuProcOrigem não visível · tentando fallbacks`);
      const altField = await page.$('#iddados\\.nuProcOrigem');
      if (altField) {
        await altField.fill(processo);
        console.log(`[FORM] Preenchido via id`);
      }
    }

    await page.waitForTimeout(800 + Math.random() * 500);

    const btnPesquisar = page
      .locator('input[name="pbSubmit"], #pbSubmit, button:has-text("Pesquisar")')
      .first();
    const btnVisivel = await btnPesquisar.isVisible().catch(() => false);

    if (btnVisivel) {
      console.log(`[CLICK] Pesquisar...`);
      await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 60000 }),
        btnPesquisar.click(),
      ]);
    } else {
      console.log(`[CLICK] Enter como fallback`);
      await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 60000 }),
        page.keyboard.press("Enter"),
      ]);
    }

    await page.waitForTimeout(3500);

    let html = await page.content();
    const captchaPresente =
      html.includes("reCAPTCHA") ||
      html.includes("recaptcha") ||
      html.includes("ocorreu um problema de validação");

    if (captchaPresente) {
      console.log(
        `[CAPTCHA] reCAPTCHA detectado · aguardando 90s para resolução manual no browser visível...`,
      );
      await page.waitForTimeout(90000);
      html = await page.content();
    }

    const htmlPath = path.join(saida, `${processo.replace(/[^\d]/g, "")}.html`);
    fs.writeFileSync(htmlPath, html, "utf-8");

    const text = await page.evaluate(() => document.body.innerText);
    const txtPath = path.join(saida, `${processo.replace(/[^\d]/g, "")}.txt`);
    fs.writeFileSync(txtPath, text, "utf-8");

    const ementa = await page
      .evaluate(() => {
        // Seletores mais agressivos · página de resultados eSAJ
        const candidates = Array.from(
          document.querySelectorAll(
            "tr.fundocinza1, .ementaClass, [class*='ementa'], td.dadosClass, .resultado, .ementaProcesso, td.ementaResultado, div.ementa, .conteudoLinhaClasse, table.tabelaResultados td, span.ementa",
          ),
        );
        const textosCandidatos = candidates
          .map((el) => (el as HTMLElement).innerText.trim())
          .filter((t) => t.length > 80);

        // Fallback: pegar todo body se nada encontrado
        if (textosCandidatos.length === 0) {
          return document.body.innerText
            .split("\n")
            .filter((l) => l.trim().length > 60)
            .slice(0, 50)
            .join("\n");
        }

        return textosCandidatos.join("\n\n---\n\n");
      })
      .catch(() => "");

    const links = await page
      .evaluate(() => {
        return Array.from(
          document.querySelectorAll("a[href*='getArquivo.do'], a[href*='cdAcordao']"),
        )
          .map((a) => (a as HTMLAnchorElement).href)
          .filter(Boolean);
      })
      .catch(() => []);

    const pngPath = path.join(saida, `${processo.replace(/[^\d]/g, "")}.png`);
    await page.screenshot({ path: pngPath, fullPage: true });

    console.log(`[OK] HTML: ${htmlPath}`);
    console.log(`[OK] TXT: ${txtPath}`);
    console.log(`[OK] PNG: ${pngPath}`);
    if (ementa) {
      console.log(`\n[EMENTA EXTRAÍDA]:\n${ementa.slice(0, 3000)}`);
    }
    if (links.length > 0) {
      console.log(`\n[LINKS DE INTEIRO TEOR]:`);
      links.forEach((l) => console.log(`  ${l}`));
    }

    return { htmlPath, txtPath, pngPath, ementa, links };
  } finally {
    console.log(`\n[INFO] Browser permanece aberto 30s para inspeção visual...`);
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

async function main() {
  const args = parseArgs();
  const processo = args.processo;
  const saida = args.saida || "C:/Temp/auraloa-saida/jurisp";
  if (!processo) {
    console.error("ERRO: --processo é obrigatório");
    process.exit(1);
  }
  try {
    await buscarAcordao(processo, saida);
  } catch (e: any) {
    console.error(`[ERRO] ${e.message}`);
    process.exit(2);
  }
}

main();
