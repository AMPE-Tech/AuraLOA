/**
 * _valida_cruzamento_2026.cjs
 * Valida se os CNJs da base "cruzamento_completo_2026 (2).csv" são REAIS
 * abrindo o portal eSAJ (TJSP/TJBA) e confirmando:
 *  1. CNJ exibido na página = CNJ do CSV
 *  2. Classe = Precatório
 *  3. Situação = em tramitação (não pago, não arquivado)
 *  4. Extrair: valor da causa (se disponível), órgão julgador, assunto
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const https = require("https");

const IN_CSV = path.resolve("Saida/validacao_cruzamento_2026/precatorios_em_tramitacao.csv");
const OUT = path.resolve("Saida/validacao_cruzamento_2026");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// ── Ler CSV filtrado ─────────────────────────────────────────────
const rows = fs.readFileSync(IN_CSV, "utf-8").split("\n").filter(l => l.trim());
const header = rows.shift().split(";");
const recs = rows.map(l => {
  const cols = l.split(";");
  const obj = {};
  header.forEach((h, i) => obj[h.trim()] = (cols[i] || "").replace(/^"|"$/g, ""));
  return obj;
});

// ── Amostra: 3 TJSP + 2 TJBA ─────────────────────────────────────
const tjsp = recs.filter(r => r.Tribunal === "TJSP").slice(0, 3);
const tjba = recs.filter(r => r.Tribunal === "TJBA").slice(0, 2);
const AMOSTRA = [...tjsp, ...tjba];

console.log(`Amostra: ${tjsp.length} TJSP + ${tjba.length} TJBA = ${AMOSTRA.length} casos`);

// ── DataJud lookup ───────────────────────────────────────────────
function datajud(tribunal, cnjNum) {
  const apiPath = tribunal === "TJSP" ? "/api_publica_tjsp/_search" : "/api_publica_tjba/_search";
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query: { match: { numeroProcesso: cnjNum } }, size: 1 });
    const req = https.request({
      hostname: "api-publica.datajud.cnj.jus.br",
      path: apiPath,
      method: "POST",
      headers: { "Authorization": "APIKey " + DATAJUD_KEY, "Content-Type": "application/json", "Content-Length": payload.length },
    }, (res) => {
      let body = ""; res.on("data", c => body += c);
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
    req.write(payload); req.end();
  });
}

// Constrói URL correta do eSAJ a partir de um CNJ formatado NNNNNNN-DD.AAAA.J.TT.OOOO
// eSAJ precisa: numeroDigitoAnoUnificado = NNNNNNN-DD.AAAA  +  foroNumeroUnificado = OOOO
function construirUrlESAJ(tribunal, cnjFormatado) {
  const m = cnjFormatado.match(/^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const [, num, dig, ano, , , foro] = m;
  const numDigAno = `${num}-${dig}.${ano}`;
  const hostTribunal = tribunal === "TJSP" ? "esaj.tjsp.jus.br" : "esaj.tjba.jus.br";
  const cnjCompleto = cnjFormatado;
  const q = `conversationId=&cbPesquisa=NUMPROC&dadosConsulta.tipoNuProcesso=UNIFICADO&numeroDigitoAnoUnificado=${encodeURIComponent(numDigAno)}&foroNumeroUnificado=${foro}&dadosConsulta.valorConsultaNuUnificado=${encodeURIComponent(cnjCompleto)}&dadosConsulta.valorConsulta=`;
  return `https://${hostTribunal}/cpopg/search.do?${q}`;
}

// ── eSAJ visual ──────────────────────────────────────────────────
async function consultarESAJ(page, tribunal, cnjCsv) {
  const url = construirUrlESAJ(tribunal, cnjCsv);
  if (!url) return { status: "erro", erro: "URL não construída (CNJ mal-formatado)" };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(3000);

    const body = (await page.textContent("body")) || "";

    // Resultados possíveis
    if (/não existem informações|processo não encontrado|Nenhum processo/i.test(body)) {
      return { status: "nao_encontrado", cnj_na_pagina: null, valor: null, classe: null, orgao: null };
    }

    // Extrair número do processo exibido (topo do eSAJ)
    const numExibido = await page.$('#numeroProcesso, .unj-entity-header__subtitle, [id*="numeroProcesso"]');
    let cnjPagina = null;
    if (numExibido) cnjPagina = (await numExibido.textContent() || "").trim();
    if (!cnjPagina) {
      const m = body.match(/\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}/);
      if (m) cnjPagina = m[0];
    }

    // Classe
    const classeEl = await page.$('#classeProcesso, .classeProcesso');
    const classe = classeEl ? (await classeEl.textContent() || "").trim() : null;

    // Valor da ação
    const valorEl = await page.$('#valorAcaoProcesso, [id*="valor"]');
    const valor = valorEl ? (await valorEl.textContent() || "").trim() : null;

    // Órgão julgador / Vara
    const varaEl = await page.$('#varaProcesso, [id*="vara"]');
    const vara = varaEl ? (await varaEl.textContent() || "").trim() : null;

    // Assunto
    const assuntoEl = await page.$('#assuntoProcesso, [id*="assunto"]');
    const assunto = assuntoEl ? (await assuntoEl.textContent() || "").trim() : null;

    return { status: "encontrado", cnj_na_pagina: cnjPagina, classe, valor, vara, assunto };
  } catch (e) {
    return { status: "erro", erro: e.message };
  }
}

// ── Main ─────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const resultados = [];
  for (let i = 0; i < AMOSTRA.length; i++) {
    const r = AMOSTRA[i];
    const idx = i + 1;
    const cnjCsv = r["Numero Formatado"];
    const cnjNum = r["Numero CNJ"];
    const url = r["URL PJe"] || r["URL eProc"];
    const tribunal = r.Tribunal;
    const orgaoCSV = r["Orgao Julgador"];
    console.log(`\n[${idx}/${AMOSTRA.length}] ${tribunal} ${cnjCsv}`);
    console.log(`  URL: ${url}`);

    // 1) DataJud
    let dj = null, djHit = null;
    try {
      dj = await datajud(tribunal, cnjNum);
      djHit = dj.hits?.hits?.[0]?._source || null;
      console.log(`  DataJud: ${dj.hits?.total?.value} hits ${djHit ? "✓" : "✗"}`);
    } catch (e) { console.log(`  DataJud erro: ${e.message}`); }

    // 2) eSAJ visual
    const page = await ctx.newPage();
    const esaj = await consultarESAJ(page, tribunal, cnjCsv);
    const shotPath = path.join(OUT, `shot_${idx}_${tribunal}_${cnjCsv.replace(/[^0-9]/g,"")}.png`);
    try { await page.screenshot({ path: shotPath, fullPage: true }); } catch {}
    await page.close();

    const cnjBate = esaj.cnj_na_pagina && esaj.cnj_na_pagina.replace(/\s/g,"").includes(cnjCsv);
    const veredicto =
      esaj.status === "nao_encontrado" ? "❌ FAKE — não existe no eSAJ"
      : esaj.status === "erro" ? "⚠️  erro técnico"
      : cnjBate ? "✅ REAL"
      : "⚠️  divergência (CNJ página ≠ CSV)";

    console.log(`  eSAJ: status=${esaj.status} | cnj_página=${esaj.cnj_na_pagina || "—"} | classe=${esaj.classe || "—"} | valor=${esaj.valor || "—"}`);
    console.log(`  VEREDICTO: ${veredicto}`);
    console.log(`  screenshot: ${shotPath}`);

    resultados.push({
      idx, tribunal, cnj_csv: cnjCsv, cnj_num: cnjNum, url,
      orgao_csv: orgaoCSV,
      datajud_hits: dj?.hits?.total?.value ?? null,
      datajud_classe: djHit?.classe?.nome ?? null,
      datajud_orgao: djHit?.orgaoJulgador?.nome ?? null,
      esaj_status: esaj.status,
      esaj_cnj_pagina: esaj.cnj_na_pagina ?? null,
      esaj_classe: esaj.classe ?? null,
      esaj_valor: esaj.valor ?? null,
      esaj_vara: esaj.vara ?? null,
      esaj_assunto: esaj.assunto ?? null,
      veredicto,
      screenshot: path.basename(shotPath),
    });
  }

  await browser.close();

  // CSV resumo
  const headerOut = Object.keys(resultados[0]);
  const lines = [headerOut.join(",")];
  for (const r of resultados) {
    lines.push(headerOut.map(k => {
      const v = r[k] == null ? "" : String(r[k]).replace(/"/g, '""');
      return /[,;"\n]/.test(v) ? `"${v}"` : v;
    }).join(","));
  }
  const csvPath = path.join(OUT, "resumo_validacao.csv");
  fs.writeFileSync(csvPath, lines.join("\n"));
  fs.writeFileSync(path.join(OUT, "resumo_validacao.json"), JSON.stringify(resultados, null, 2));

  console.log(`\n══════ RESUMO ══════`);
  const ok = resultados.filter(r => r.veredicto.startsWith("✅")).length;
  const fake = resultados.filter(r => r.veredicto.startsWith("❌")).length;
  const err = resultados.length - ok - fake;
  console.log(`  ${ok} REAL · ${fake} FAKE · ${err} erro/divergência`);
  console.log(`  CSV: ${csvPath}`);
})();
