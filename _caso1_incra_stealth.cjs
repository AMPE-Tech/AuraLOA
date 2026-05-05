/**
 * _caso1_incra_stealth.cjs
 * Mesmo pipeline do caso 1 INCRA, mas com stealth plugin pra atravessar Cloudflare.
 */

const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

const https = require("https");
const fs = require("fs");
const path = require("path");

const CASO = {
  loaNum: "1666808420254010000",
  uoDevedoraCodigo: "49201",
  uoDevedoraNome: "INCRA",
  cnpjInstituicao: "00375972000160",
  valorLoa: 26_400_020,
  tipoCausaLoa: "Desapropriação por Interesse Social para Reforma Agrária",
  anoLoa: 2026,
};

const OUT = path.resolve("Saida/caso1_incra_stealth_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

function datajudSearch(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: "api-publica.datajud.cnj.jus.br",
      path: "/api_publica_trf1/_search",
      method: "POST",
      headers: { "Authorization": "APIKey " + DATAJUD_KEY, "Content-Type": "application/json", "Content-Length": body.length },
    }, (res) => {
      let b = ""; res.on("data", c => b += c);
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("Timeout DataJud")); });
    req.write(body); req.end();
  });
}

function csv(rows, headers) {
  const esc = v => { if (v == null) return ""; const s = String(v).replace(/"/g,'""'); return /[,;"\n]/.test(s) ? `"${s}"` : s; };
  return [headers.join(";"), ...rows.map(r => headers.map(h => esc(r[h])).join(";"))].join("\n");
}

function ehPrecatorioTrf1(cnj) { return /^\d{7}-\d{2}\.\d{4}\.4\.01\.9198$/.test(cnj || ""); }

function simTipo(a, b) {
  const pal = s => new Set((s||"").toLowerCase().replace(/[^a-záàâãéêíóôõúç ]/g," ").split(/\s+/).filter(w => w.length >= 4));
  const sa = pal(a), sb = pal(b);
  let c = 0; for (const w of sa) if (sb.has(w)) c++;
  return c;
}

(async () => {
  console.log(`╔══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║ CASO 1 STEALTH · INCRA R$ ${(CASO.valorLoa/1e6).toFixed(2)}M · Desapropriação · LOA 2026`);
  console.log(`║ Stealth plugin ativo para passar Cloudflare`);
  console.log(`╚══════════════════════════════════════════════════════════════════════╝`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-web-security",
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  // ═══ FASE 1: TRF1 consulta por CNPJ ═══
  console.log("\n[F1] Abrindo TRF1 Consulta Processual (com stealth)...");
  try {
    await page.goto("https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1", { waitUntil: "domcontentloaded", timeout: 60000 });
    // Aguardar Cloudflare processar
    await page.waitForTimeout(6000);

    // Diagnóstico
    const title = await page.title();
    const url = page.url();
    console.log(`  Title: "${title}" · URL: ${url}`);
    await page.screenshot({ path: path.join(OUT, "f1_apos_cloudflare.png"), fullPage: false });

    // Se ainda está no Cloudflare challenge, aguardar mais
    const bodyCheck = await page.textContent("body");
    if (/Just a moment|Verifying you are human|Cloudflare/i.test(bodyCheck || "")) {
      console.log("  ⚠️  Cloudflare challenge detectado — aguardando 15s adicional...");
      await page.waitForTimeout(15000);
      await page.screenshot({ path: path.join(OUT, "f1_apos_wait.png"), fullPage: false });
    }

    // Aguardar campo do form
    await page.waitForSelector("input#cpf_cnpj", { timeout: 30000 });
    console.log("  ✓ Form do TRF1 carregado (passou Cloudflare)");

    await page.fill("input#cpf_cnpj", CASO.cnpjInstituicao);
    await page.click("input#enviar");
    await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(OUT, "f1_lista_inicial.png"), fullPage: true });

    // Clicar em INCRA
    const link = page.locator("a").filter({ hasText: /INCRA|COLONIZA/i }).first();
    await link.waitFor({ timeout: 15000 });
    const txt = (await link.innerText()).trim();
    console.log(`  Entidade: "${txt.slice(0, 80)}"`);
    await link.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
    await page.waitForTimeout(5000);

    // Extrair tabela (paginação)
    const processos = [];
    let pagina = 1;
    while (pagina <= 30) {
      console.log(`  Lendo página ${pagina}...`);
      const linhas = await page.locator("table tr").all();
      for (const l of linhas) {
        const tds = await l.locator("td").all();
        if (tds.length >= 2) {
          try {
            const n1 = (await tds[0].innerText({ timeout: 1000 })).trim();
            const n2 = (await tds[1].innerText({ timeout: 1000 })).trim();
            if (n1 && /\d{5,}/.test(n1.replace(/[.\-\/]/g,""))) {
              processos.push({ numero_processo: n1, processo_originario: n2, pagina });
            }
          } catch {}
        }
      }
      const btn = page.locator('a:has-text("Próxima"), a:has-text("próxima"), a:has-text(">>")').last();
      try {
        const visivel = await btn.isVisible({ timeout: 2000 });
        const href = visivel ? await btn.getAttribute("href") : null;
        if (!visivel || !href || href.includes("javascript:void")) break;
        await btn.click();
        await page.waitForTimeout(3000);
        pagina++;
      } catch { break; }
    }
    console.log(`  TOTAL: ${processos.length} processos em ${pagina} página(s)`);
    fs.writeFileSync(path.join(OUT, "f1_lista.csv"), csv(processos, ["numero_processo","processo_originario","pagina"]));
    fs.writeFileSync(path.join(OUT, "f1_lista.json"), JSON.stringify(processos, null, 2));

    // ═══ FASE 2: filtrar vara 9198 ═══
    console.log("\n[F2] Filtrando CNJs vara 9198 (precatórios TRF1)");
    const candidatos = processos.filter(p => ehPrecatorioTrf1(p.numero_processo) || ehPrecatorioTrf1(p.processo_originario));
    console.log(`  ${candidatos.length} candidatos de ${processos.length} processos`);
    fs.writeFileSync(path.join(OUT, "f2_candidatos.csv"), csv(candidatos, ["numero_processo","processo_originario","pagina"]));

    // ═══ FASE 3: DataJud details ═══
    console.log("\n[F3] Consultando DataJud para cada candidato");
    const detalhes = [];
    const limite = Math.min(candidatos.length, 50); // cap em 50 pra evitar demora
    for (let i = 0; i < limite; i++) {
      const c = candidatos[i];
      const cnjNum = (c.numero_processo || "").replace(/\D/g,"");
      if (cnjNum.length < 15) continue;
      try {
        const r = await datajudSearch({ query: { match: { numeroProcesso: cnjNum } }, size: 1 });
        const hit = r.hits?.hits?.[0]?._source || null;
        if (hit) {
          const assuntos = (hit.assuntos || []).map(a => a.nome).join(" | ");
          const partes = (hit.partes || []).map(p => p.pessoa?.nome || "").filter(Boolean);
          detalhes.push({
            cnj_formatado: c.numero_processo,
            classe: hit.classe?.nome || "",
            assuntos,
            data_ajuizamento: hit.dataAjuizamento || "",
            orgao_julgador: hit.orgaoJulgador?.nome || "",
            partes: partes.join(" // "),
            processo_originario: c.processo_originario,
          });
        }
      } catch {}
      if (i % 10 === 9) console.log(`  ${i+1}/${limite} processados...`);
      await new Promise(r => setTimeout(r, 200));
    }
    fs.writeFileSync(path.join(OUT, "f3_datajud.json"), JSON.stringify(detalhes, null, 2));
    console.log(`  ${detalhes.length} detalhes obtidos`);

    // ═══ FASE 4: match assunto + tipo causa LOA ═══
    console.log("\n[F4] Match por similaridade assunto vs tipo_causa LOA");
    const comScore = detalhes.map(d => ({ ...d, score: simTipo(d.assuntos, CASO.tipoCausaLoa) }));
    const ordenados = comScore.sort((a,b) => b.score - a.score);
    const top10 = ordenados.slice(0, 10);
    console.log(`  Top 10 por similaridade:`);
    top10.forEach((d, i) => console.log(`    #${i+1} score=${d.score} · ${d.cnj_formatado} · assuntos: ${d.assuntos.substring(0,60)}`));
    fs.writeFileSync(path.join(OUT, "f4_match.json"), JSON.stringify(ordenados, null, 2));

    // ═══ FASE 5: screenshot do top 1 ═══
    if (top10.length > 0) {
      console.log(`\n[F5] Screenshot top 1: ${top10[0].cnj_formatado}`);
      const url = `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${top10[0].cnj_formatado}&secao=TRF1`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(OUT, "f5_top1.png"), fullPage: true });
      } catch (e) { console.log(`  erro: ${e.message}`); }
    }

  } catch (e) {
    console.log(`\n❌ ${e.message}`);
    await page.screenshot({ path: path.join(OUT, "erro_final.png"), fullPage: true }).catch(()=>{});
  } finally {
    await browser.close();
    console.log(`\n══ FIM ══ Saída: ${OUT}`);
  }
})();
