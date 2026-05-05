/**
 * _evid_pje_retry.cjs — retry PJe TRF1 Consulta Pública com intervalo maior
 * + evidência visual da resposta DataJud via browser
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.resolve("Saida/evidencias_cnj_candidato_20260422");

const CASOS = [
  { label: "EFU_FUNDEF_29M", cnj: "0166137-81.2025.4.01.9198" },
  { label: "INCRA_Reintegracao_27M", cnj: "0056906-22.2025.4.01.9198" },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  for (const caso of CASOS) {
    const page = await ctx.newPage();
    console.log(`\n▶ ${caso.label} · CNJ: ${caso.cnj}`);
    let sucesso = false;
    for (let tentativa = 1; tentativa <= 3 && !sucesso; tentativa++) {
      try {
        console.log(`  tentativa ${tentativa}/3...`);
        await page.goto("https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam", { waitUntil: "domcontentloaded", timeout: 40000 });
        await page.waitForTimeout(2000);

        const numInput = await page.$('input[id*="NumeroProcesso"]');
        if (!numInput) { console.log(`    campo CNJ não encontrado`); continue; }
        await numInput.click();
        await numInput.fill(caso.cnj);
        await page.waitForTimeout(500);

        const btn = await page.$('input[type="submit"][value*="Pesquisar"], button:has-text("Pesquisar")');
        if (btn) {
          await Promise.all([
            page.waitForLoadState("networkidle", { timeout: 30000 }).catch(()=>{}),
            btn.click(),
          ]);
          await page.waitForTimeout(3000);
        }

        const body = await page.textContent("body");
        if (/Erro inesperado/i.test(body || "")) {
          console.log(`    PJe devolveu erro JBoss, aguardando 8s...`);
          await page.waitForTimeout(8000);
          continue;
        }

        const shot = path.join(OUT, `${caso.label}_PJe_consulta_publica.png`);
        await page.screenshot({ path: shot, fullPage: true });
        const naoAchou = /nenhum processo encontrado|nenhum registro encontrado/i.test(body || "");
        console.log(`    ✓ screenshot: ${shot}`);
        console.log(`    resultado: ${naoAchou ? "❌ CNJ INEXISTENTE (nenhum processo encontrado)" : "verificar imagem"}`);
        sucesso = true;
      } catch (e) {
        console.log(`    erro: ${e.message.split("\n")[0]}`);
      }
    }
    await page.close();
  }

  await browser.close();
})();
