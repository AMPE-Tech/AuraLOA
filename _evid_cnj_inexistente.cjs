/**
 * _evid_cnj_inexistente.cjs — Evidência visual de que cnj_candidato NÃO existe no TRF1
 * Abre PJe-TRF1 Consulta Pública, busca o CNJ candidato e captura screenshot do resultado.
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.resolve("Saida/evidencias_cnj_candidato_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const CASOS = [
  { label: "EFU_FUNDEF_29M",     loa: "1661378120254010000", cnj_candidato: "0166137-81.2025.4.01.9198" },
  { label: "INCRA_Reintegracao_27M", loa: "569062220254019000", cnj_candidato: "0056906-22.2025.4.01.9198" },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const caso of CASOS) {
    console.log(`\n▶ ${caso.label} · CNJ candidato: ${caso.cnj_candidato}`);
    try {
      await page.goto("https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam", { waitUntil: "networkidle", timeout: 30000 });

      // Preencher campo CNJ
      const input = await page.$('input[id*="NumeroProcesso"]');
      if (input) {
        await input.click();
        await input.fill(caso.cnj_candidato);
        console.log(`   preencheu CNJ no formulário`);
      }

      // Clicar em Pesquisar
      const btn = await page.$('input[value="Pesquisar"]');
      if (btn) {
        await btn.click();
        await page.waitForTimeout(4000);
        console.log(`   clicou Pesquisar`);
      }

      const screenshotPath = path.join(OUT, `${caso.label}_${caso.cnj_candidato.replace(/\./g,"_").replace(/-/g,"_")}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`   ✓ screenshot: ${screenshotPath}`);

      // Extrair texto visível
      const content = await page.textContent("body");
      const naoEncontrado = /nenhum processo encontrado|nenhum registro encontrado/i.test(content || "");
      const foiEncontrado = /total de processos/i.test(content || "");
      console.log(`   resultado: ${naoEncontrado ? "❌ CNJ INEXISTENTE (nenhum processo encontrado)" : foiEncontrado ? "✓ ENCONTRADO" : "? verificar screenshot"}`);

    } catch (e) {
      console.log(`   ERRO: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\n══ Evidências salvas em: ${OUT}`);
})();
