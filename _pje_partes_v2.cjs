/**
 * _pje_partes_v2.cjs — Consulta PJe com mais robustez + salva TUDO
 * Se falhar no form, salva screenshot + HTML pra debug.
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CNJ_FMT = "1003345-44.2018.4.01.3400";
const OUT = path.resolve("Saida/caso_SUS_1653712820254010000_20260422");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  console.log(`Consultando PJe · CNJ ${CNJ_FMT}`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  try {
    await page.goto("https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam", { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(5000);

    // Debug: listar todos os inputs + buttons visíveis
    const elems = await page.evaluate(() => {
      const out = { inputs: [], buttons: [] };
      document.querySelectorAll("input").forEach(e => {
        if (e.offsetParent !== null) out.inputs.push({ id: e.id, name: e.name, type: e.type, value: e.value, placeholder: e.placeholder });
      });
      document.querySelectorAll("button, input[type=submit], input[type=button]").forEach(e => {
        if (e.offsetParent !== null) out.buttons.push({ tag: e.tagName, id: e.id, name: e.name, value: e.value, text: (e.innerText||e.value||"").substring(0,50) });
      });
      return out;
    });
    fs.writeFileSync(path.join(OUT, "pje_form_elements.json"), JSON.stringify(elems, null, 2));
    console.log(`Form: ${elems.inputs.length} inputs, ${elems.buttons.length} botões`);

    // Preencher CNJ no campo "NumeroProcesso" (é um radio-dependente)
    const inputCnj = await page.$('input[id*="NumeroProcesso"]');
    if (!inputCnj) { throw new Error("campo NumeroProcesso não encontrado"); }
    await inputCnj.click();
    await inputCnj.fill(CNJ_FMT);
    await page.waitForTimeout(1000);

    // Achar botão "Pesquisar" — tentando múltiplos seletores
    let botaoClicado = false;
    const candSeletores = [
      'input[value="Pesquisar"]',
      'button:has-text("Pesquisar")',
      'input[type="submit"]',
      'a:has-text("Pesquisar")',
    ];
    for (const sel of candSeletores) {
      const b = await page.$(sel);
      if (b) {
        console.log(`  clicando: ${sel}`);
        await b.click();
        botaoClicado = true;
        break;
      }
    }
    if (!botaoClicado) {
      // Submit via JS direto
      console.log("  botão não achado — submit via JS");
      await page.evaluate(() => {
        const f = document.querySelector("form");
        if (f) f.submit();
      });
    }

    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(OUT, "pje_apos_pesquisar.png"), fullPage: true });

    // Inspecionar listagem
    const listagem = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      return rows.map(r => {
        const tds = Array.from(r.querySelectorAll("td")).map(t => t.innerText.trim());
        const link = r.querySelector("a[onclick*='openPopUp'], a[onclick]");
        const onclick = link ? link.getAttribute("onclick") : null;
        return { tds, onclick: (onclick||"").substring(0, 250) };
      });
    });
    fs.writeFileSync(path.join(OUT, "pje_listagem.json"), JSON.stringify(listagem, null, 2));
    console.log(`Listagem: ${listagem.length} linhas`);

    // Extrair URL do primeiro processo encontrado
    let detailUrl = null;
    for (const row of listagem) {
      const m = (row.onclick||"").match(/openPopUp\('[^']+','([^']+)'\)/);
      if (m) { detailUrl = "https://pje1g-consultapublica.trf1.jus.br" + m[1]; break; }
    }

    if (!detailUrl) {
      console.log("Nenhum link openPopUp encontrado — ver pje_apos_pesquisar.png");
    } else {
      console.log(`Abrindo detalhes: ${detailUrl}`);
      await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
      await page.waitForTimeout(7000);
      await page.screenshot({ path: path.join(OUT, "pje_detalhes.png"), fullPage: true });

      // Extrair partes e advogados
      const partes = await page.evaluate(() => {
        // PJe mostra partes em tabelas ou cards — tentar varios layouts
        const out = { polos: [], partes: [], html_debug: null };
        // Tabelas
        const tables = Array.from(document.querySelectorAll("table"));
        tables.forEach(t => {
          const text = (t.innerText || "").trim();
          if (/polo|autor|réu|requerente|requerido|advogado|oab/i.test(text) && text.length < 5000) {
            out.polos.push(text);
          }
        });
        // Cards/divs
        const divs = Array.from(document.querySelectorAll("div"));
        divs.forEach(d => {
          const t = (d.innerText || "").trim();
          if (/OAB\s*[A-Z]{2}\s*\d+/i.test(t) && t.length < 1000) out.partes.push(t);
        });
        out.html_debug = document.body.innerText.substring(0, 5000);
        return out;
      });

      fs.writeFileSync(path.join(OUT, "pje_partes_extraidas.json"), JSON.stringify(partes, null, 2));
      fs.writeFileSync(path.join(OUT, "pje_body.txt"), partes.html_debug);
      console.log(`\n── POLOS/TABELAS COM PARTES (${partes.polos.length}):`);
      partes.polos.slice(0, 3).forEach((p, i) => console.log(`[${i+1}] ${p.substring(0, 400)}`));
      console.log(`\n── DIVS COM OAB (${partes.partes.length}):`);
      partes.partes.slice(0, 3).forEach((p, i) => console.log(`[${i+1}] ${p.substring(0, 400)}`));
    }

  } catch (e) {
    console.log("ERRO:", e.message);
    try { await page.screenshot({ path: path.join(OUT, "pje_erro.png"), fullPage: true }); } catch {}
  }
  await browser.close();
  console.log("\nFIM · artifacts em:", OUT);
})();
