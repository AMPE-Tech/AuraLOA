/**
 * _pje_3_cnjs.cjs — consulta PJe 1g Pub dos 3 CNJs descobertos
 * Espera 10s entre cada consulta pra não sobrecarregar o servidor
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CNJS = [
  { loa: "1653712820254010000", cnj: "1003345-44.2018.4.01.3400", label: "SUS_27M",      orgao: "08ª Brasília" },
  { loa: "1672653920254010000", cnj: "0001270-54.2016.4.01.4100", label: "Imunidade_32M", orgao: "01ª Porto Velho" },
  { loa: "273212220254019000",  cnj: "0014583-87.2012.4.01.3400", label: "INCRA_33M",     orgao: "07ª Brasília" },
];

const OUT = path.resolve("Saida/pje_3_cnjs_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function consulta(page, caso) {
  console.log(`\n── ${caso.label} · CNJ ${caso.cnj} · ${caso.orgao}`);
  try {
    await page.goto("https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam", { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(4000);

    const input = await page.$('input[id*="NumeroProcesso"]');
    if (!input) { console.log("  campo CNJ não achado"); return null; }
    await input.click();
    await input.fill(caso.cnj);
    await page.waitForTimeout(800);
    const btn = await page.$('input[value="Pesquisar"]');
    if (!btn) { console.log("  botão Pesquisar não achado"); return null; }
    await btn.click();
    await page.waitForTimeout(5000);

    // Check erro sobrecarga
    const body1 = (await page.textContent("body")) || "";
    if (/too many connections|Erro inesperado|FATAL/i.test(body1)) {
      console.log("  ⚠️  PJe sobrecarregado — tente mais tarde");
      await page.screenshot({ path: path.join(OUT, `${caso.label}_sobrecarga.png`) });
      return null;
    }

    // Click no resultado
    const linkInfo = await page.evaluate(() => {
      const link = document.querySelector("a[onclick*='openPopUp']");
      return link ? link.getAttribute("onclick") : null;
    });
    if (!linkInfo) {
      console.log("  nenhum link openPopUp — CNJ não encontrado ou listagem vazia");
      await page.screenshot({ path: path.join(OUT, `${caso.label}_listagem_vazia.png`) });
      return null;
    }
    const m = linkInfo.match(/openPopUp\('[^']+','([^']+)'\)/);
    if (!m) return null;
    const url = "https://pje1g-consultapublica.trf1.jus.br" + m[1];

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(6000);

    const body2 = (await page.textContent("body")) || "";
    if (/too many connections|FATAL/i.test(body2)) {
      console.log("  ⚠️  PJe sobrecarregado no detalhe");
      return null;
    }

    await page.screenshot({ path: path.join(OUT, `${caso.label}_detalhes.png`), fullPage: true });

    // Extração rica
    const dados = await page.evaluate(() => {
      const out = { titulo: "", partes: [], advogados: [], textoCompleto: "" };
      out.titulo = document.title || "";
      // Capturar texto completo (pra grep de CPF/CNPJ/OAB)
      out.textoCompleto = document.body.innerText;
      // Extrair linhas que mencionam advogado
      const linhas = out.textoCompleto.split(/\n/).map(l => l.trim()).filter(Boolean);
      linhas.forEach((l, i) => {
        if (/OAB\s*[A-Z]{2,3}\s*\d+/i.test(l)) out.advogados.push({ linha: l, contexto: linhas[i-1] || "" });
      });
      // Tentar pegar partes por tabela
      const tabs = Array.from(document.querySelectorAll("table"));
      tabs.forEach(t => {
        const txt = (t.innerText || "").trim();
        if (/polo|autor|réu|advogado|requerente/i.test(txt) && txt.length < 3000) {
          out.partes.push(txt);
        }
      });
      return out;
    });

    fs.writeFileSync(path.join(OUT, `${caso.label}_body.txt`), dados.textoCompleto);
    fs.writeFileSync(path.join(OUT, `${caso.label}_extracao.json`), JSON.stringify(dados, null, 2));

    console.log(`  ✓ ${dados.partes.length} tabelas de partes · ${dados.advogados.length} advogados mencionados`);
    if (dados.partes.length > 0) {
      console.log("  PARTES (primeiras 500 chars):");
      dados.partes.slice(0, 2).forEach((p, i) => console.log(`    [${i+1}] ${p.substring(0, 500).replace(/\s+/g," ")}`));
    }
    if (dados.advogados.length > 0) {
      console.log("  ADVOGADOS:");
      dados.advogados.slice(0, 5).forEach((a, i) => console.log(`    #${i+1} ${a.linha}`));
    }
    return { caso, dados };
  } catch (e) {
    console.log(`  erro: ${e.message.substring(0,120)}`);
    return null;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  const resultados = [];
  for (const caso of CNJS) {
    const r = await consulta(page, caso);
    resultados.push({ caso, ok: !!r });
    console.log("  aguardando 12s antes do próximo...");
    await new Promise(r => setTimeout(r, 12000));
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "resumo.json"), JSON.stringify(resultados, null, 2));
  console.log(`\n══ FIM · ${OUT}`);
})();
