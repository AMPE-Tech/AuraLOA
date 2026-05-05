/**
 * _pje_partes_sus.cjs — Consulta PJe 1g Pub do CNJ matched + extrai partes/advogado
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CNJ = "1003345-44.2018.4.01.3400";
const OUT = path.resolve("Saida/caso_SUS_1653712820254010000_20260422");

(async () => {
  console.log(`Consultando PJe 1g Consulta Pública · CNJ ${CNJ}`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  try {
    await page.goto("https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam", { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(3000);

    const input = await page.$('input[id*="NumeroProcesso"]');
    await input.click();
    await input.fill(CNJ);
    await page.waitForTimeout(800);
    const btn = await page.$('input[type="submit"][value*="Pesquisar"], button:has-text("Pesquisar")');
    await btn.click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(OUT, "pje_listagem.png"), fullPage: true });

    const bodyTxt = (await page.textContent("body")) || "";
    if (/nenhum processo encontrado/i.test(bodyTxt)) {
      console.log("❌ CNJ não encontrado no PJe 1g");
      await browser.close();
      return;
    }

    // Clicar no resultado para abrir detalhes
    const link = await page.$('a[onclick*="openPopUp"], a.btn-link');
    if (link) {
      const onclick = await link.getAttribute("onclick");
      console.log("Link do resultado encontrado · onclick:", (onclick||"").substring(0,150));
      // Extrair URL do openPopUp
      const m = (onclick||"").match(/openPopUp\('[^']+','([^']+)'\)/);
      if (m) {
        const detalheUrl = "https://pje1g-consultapublica.trf1.jus.br" + m[1];
        console.log("Abrindo detalhes:", detalheUrl);
        await page.goto(detalheUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(OUT, "pje_detalhes.png"), fullPage: true });

        // Extrair texto visível
        const texto = (await page.textContent("body")) || "";
        fs.writeFileSync(path.join(OUT, "pje_detalhes_texto.txt"), texto);
        console.log("✓ Detalhes capturados · texto salvo em pje_detalhes_texto.txt");

        // Tentar extrair seção de partes e advogados (layout PJe)
        // As partes vêm em tabelas com cabeçalhos "Polo Ativo" e "Polo Passivo"
        const partesHtml = await page.$$eval("table", tabs => tabs.map(t => t.textContent.trim()));
        const partesInfo = partesHtml.filter(t => /polo|ativo|passivo|autor|réu|advogado/i.test(t));
        console.log(`\n${partesInfo.length} tabelas com info de partes encontradas`);
        partesInfo.forEach((t, i) => {
          const resumo = t.replace(/\s+/g, " ").substring(0, 400);
          console.log(`\n── Tabela ${i+1} ──`);
          console.log(resumo);
        });
      }
    } else {
      console.log("Nenhum link de detalhe encontrado — ver screenshot pje_listagem.png");
    }
  } catch (e) {
    console.log("ERRO:", e.message);
    try { await page.screenshot({ path: path.join(OUT, "pje_erro.png"), fullPage: true }); } catch {}
  }
  await browser.close();
  console.log("\nFIM");
})();
