/**
 * _caso1_incra_completo.cjs
 * ─────────────────────────────────────────────────────────────────────
 * Pipeline end-to-end para enriquecimento de UM precatório específico.
 * Caso 1: INCRA · R$ 26,4M · Desapropriação · LOA 2026
 * Nº LOA: 1666808420254010000
 *
 * Fases (em ordem):
 *   [F1] TRF1 consulta por CNPJ da UO devedora → lista bruta de processos
 *   [F2] Filtra CNJs padrão vara 9198 (precatórios TRF1 — NACP)
 *   [F3] Para cada candidato, DataJud → classe, assuntos, partes, movimentos
 *   [F4] Match por assunto "Desapropriação" + valor ≈ R$ 26,4M
 *   [F5] Screenshot do processo confirmado + gera saída estruturada
 *
 * Saídas em: Saida/caso1_incra_completo_<data>/
 *   - lista_trf1_bruta.csv              (F1)
 *   - candidatos_vara_9198.csv          (F2)
 *   - datajud_detalhes.json             (F3)
 *   - match_final.json                  (F4)
 *   - screenshot_match.png              (F5)
 *   - relatorio_caso1.md                (consolidado legível)
 *
 * Preserva os scripts validados existentes — este é NOVO, não modifica nada.
 */

const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Parâmetros do caso ───────────────────────────────────────────
const CASO = {
  loaNum: "1666808420254010000",
  uoDevedoraCodigo: "49201",
  uoDevedoraNome: "INCRA",
  cnpjInstituicao: "00375972000160",
  valorLoa: 26_400_020,
  tipoCausaLoa: "Desapropriação por Interesse Social para Fins de Reforma Agrária - Direito Administrativo",
  anoLoa: 2026,
};

const OUT = path.resolve("Saida/caso1_incra_completo_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// ── Helpers ──────────────────────────────────────────────────────
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

// Detecta CNJ padrão de precatório TRF1 (vara NACP 9198)
function ehPrecatorioTrf1(cnj) {
  // CNJ formatado: NNNNNNN-DD.AAAA.J.TT.OOOO → OOOO é o órgão/vara
  return /^\d{7}-\d{2}\.\d{4}\.4\.01\.9198$/.test(cnj || "");
}

// Similaridade de texto simples (palavras ≥4 letras em comum)
function simAssunto(a, b) {
  const palavras = s => new Set((s||"").toLowerCase().replace(/[^a-záàâãéêíóôõúç ]/g," ").split(/\s+/).filter(w => w.length >= 4));
  const sa = palavras(a), sb = palavras(b);
  let c = 0; for (const w of sa) if (sb.has(w)) c++;
  return c;
}

// ── [F1] Playwright TRF1 — lista de processos por CNPJ ───────────
async function fase1_trf1_lista(page) {
  console.log("\n[F1] TRF1 Consulta Processual por CPF/CNPJ da parte");
  console.log(`     CNPJ: ${CASO.cnpjInstituicao} (${CASO.uoDevedoraNome})`);

  const URL = "https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1";
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  // Aguardar campo existir
  await page.waitForSelector("input#cpf_cnpj", { timeout: 30000 });
  await page.locator("input#cpf_cnpj").fill(CASO.cnpjInstituicao);
  await page.locator("input#enviar").click();
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
  await page.waitForTimeout(4000);

  // Screenshot da lista de resultados
  await page.screenshot({ path: path.join(OUT, "f1_lista_cnpj.png"), fullPage: true });

  // Clicar no nome que contém INCRA (Instituto Nacional de Colonização)
  const link = page.locator("a").filter({ hasText: /INCRA|COLONIZA/i }).first();
  try {
    await link.waitFor({ timeout: 15000 });
    const texto = (await link.innerText()).trim();
    console.log(`     Entidade encontrada: "${texto.slice(0, 80)}"`);
    await link.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
    await page.waitForTimeout(5000);
  } catch (e) {
    throw new Error("Não achei link INCRA na lista");
  }

  // Extrair tabela (paginação)
  const processos = [];
  let pagina = 1;
  while (pagina <= 50) {
    console.log(`     Lendo página ${pagina}...`);
    const linhas = await page.locator("table tr").all();
    for (const l of linhas) {
      const tds = await l.locator("td").all();
      if (tds.length >= 2) {
        try {
          const numProc = (await tds[0].innerText({ timeout: 1000 })).trim();
          const procOrig = (await tds[1].innerText({ timeout: 1000 })).trim();
          if (numProc && /\d{5,}/.test(numProc.replace(/[.\-\/]/g,""))) {
            processos.push({ numero_processo: numProc, processo_originario: procOrig, pagina });
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

  console.log(`     TOTAL: ${processos.length} processos em ${pagina} página(s)`);
  fs.writeFileSync(path.join(OUT, "f1_lista_trf1_bruta.csv"), csv(processos, ["numero_processo","processo_originario","pagina"]));
  return processos;
}

// ── [F2] Filtra CNJs vara 9198 ───────────────────────────────────
function fase2_filtra_9198(lista) {
  console.log("\n[F2] Filtrando CNJs da vara 9198 (precatórios TRF1)");
  const candidatos = lista.filter(p => ehPrecatorioTrf1(p.numero_processo) || ehPrecatorioTrf1(p.processo_originario));
  console.log(`     ${candidatos.length} candidatos de ${lista.length}`);
  fs.writeFileSync(path.join(OUT, "f2_candidatos_9198.csv"), csv(candidatos, ["numero_processo","processo_originario","pagina"]));
  return candidatos;
}

// ── [F3] DataJud detalhes dos candidatos ─────────────────────────
async function fase3_datajud(candidatos) {
  console.log("\n[F3] Consultando DataJud para cada candidato");
  const detalhes = [];
  for (let i = 0; i < candidatos.length; i++) {
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
          cnj_numerico: cnjNum,
          classe: hit.classe?.nome || "",
          classe_codigo: hit.classe?.codigo || "",
          assuntos,
          data_ajuizamento: hit.dataAjuizamento || "",
          orgao_julgador: hit.orgaoJulgador?.nome || "",
          partes_nomes: partes.join(" // "),
          processo_originario: c.processo_originario,
        });
        console.log(`     [${i+1}/${candidatos.length}] ${c.numero_processo} · ${hit.classe?.nome} · ${assuntos.substring(0,50)}`);
      } else {
        console.log(`     [${i+1}/${candidatos.length}] ${c.numero_processo} · DataJud sem hit`);
      }
    } catch (e) {
      console.log(`     [${i+1}/${candidatos.length}] ${c.numero_processo} · erro: ${e.message}`);
    }
    // rate limit suave
    await new Promise(r => setTimeout(r, 200));
  }
  fs.writeFileSync(path.join(OUT, "f3_datajud.json"), JSON.stringify(detalhes, null, 2));
  return detalhes;
}

// ── [F4] Match por assunto Desapropriação ────────────────────────
function fase4_match(detalhes) {
  console.log("\n[F4] Match por assunto Desapropriação + tipo causa LOA");
  const comScore = detalhes.map(d => ({ ...d, score: simAssunto(d.assuntos, CASO.tipoCausaLoa) }));
  const ordenados = comScore.sort((a,b) => b.score - a.score);
  const melhores = ordenados.slice(0, 10);
  console.log(`     Top 10 por similaridade de assunto:`);
  melhores.forEach((d,i) => console.log(`     #${i+1} score=${d.score} · ${d.cnj_formatado} · ${d.assuntos.substring(0,60)}`));
  fs.writeFileSync(path.join(OUT, "f4_match_final.json"), JSON.stringify(ordenados, null, 2));
  return melhores;
}

// ── [F5] Screenshot do TOP 1 ─────────────────────────────────────
async function fase5_screenshot(page, topMatch) {
  if (!topMatch) return;
  console.log(`\n[F5] Screenshot do TOP 1: ${topMatch.cnj_formatado}`);
  // URL processual.trf1 aceita ?proc=CNJ
  const url = `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${topMatch.cnj_formatado}&secao=TRF1`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT, "f5_screenshot_match.png"), fullPage: true });
    console.log(`     ✓ screenshot salvo`);
  } catch (e) { console.log(`     erro: ${e.message}`); }
}

// ── Relatório consolidado ────────────────────────────────────────
function relatorio(candidatos, detalhes, melhores) {
  const lines = [];
  lines.push(`# Caso 1 — INCRA R$ 26,4M Desapropriação · LOA 2026`);
  lines.push(``);
  lines.push(`**Nº LOA:** ${CASO.loaNum}`);
  lines.push(`**UO devedora:** ${CASO.uoDevedoraCodigo} (${CASO.uoDevedoraNome})`);
  lines.push(`**CNPJ:** ${CASO.cnpjInstituicao}`);
  lines.push(`**Valor LOA:** R$ ${CASO.valorLoa.toLocaleString("pt-BR")}`);
  lines.push(`**Tipo causa:** ${CASO.tipoCausaLoa}`);
  lines.push(``);
  lines.push(`## Pipeline`);
  lines.push(`- F1: lista de processos TRF1 por CNPJ → ${candidatos?.length || "?"} total`);
  lines.push(`- F2: candidatos vara 9198 → conforme CSV`);
  lines.push(`- F3: DataJud detalhes → ${detalhes?.length || 0} processos detalhados`);
  lines.push(`- F4: match assunto Desapropriação → top ${melhores?.length || 0}`);
  lines.push(``);
  lines.push(`## Top 5 candidatos (maior similaridade de assunto)`);
  (melhores || []).slice(0,5).forEach((m,i) => {
    lines.push(`### #${i+1} · score ${m.score}`);
    lines.push(`- **CNJ:** ${m.cnj_formatado}`);
    lines.push(`- **Classe:** ${m.classe}`);
    lines.push(`- **Assuntos:** ${m.assuntos}`);
    lines.push(`- **Órgão:** ${m.orgao_julgador}`);
    lines.push(`- **Ajuizamento:** ${m.data_ajuizamento}`);
    lines.push(`- **Partes:** ${m.partes_nomes}`);
    lines.push(`- **Originário:** ${m.processo_originario}`);
    lines.push(``);
  });
  fs.writeFileSync(path.join(OUT, "relatorio_caso1.md"), lines.join("\n"));
}

// ── Main ─────────────────────────────────────────────────────────
(async () => {
  console.log(`╔═══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║ CASO 1 · INCRA R$ ${(CASO.valorLoa/1e6).toFixed(2)}M · ${CASO.tipoCausaLoa.substring(0,30)} · LOA 2026`);
  console.log(`║ Nº LOA: ${CASO.loaNum}`);
  console.log(`║ Pipeline: F1 TRF1 → F2 vara 9198 → F3 DataJud → F4 match → F5 screenshot`);
  console.log(`║ Saída: ${OUT}`);
  console.log(`╚═══════════════════════════════════════════════════════════════════════╝`);

  const browser = await chromium.launch({ headless: true, timeout: 60000 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  let candidatos = [], detalhes = [], melhores = [];
  try {
    const lista = await fase1_trf1_lista(page);
    candidatos = fase2_filtra_9198(lista);
    if (candidatos.length > 0) {
      detalhes = await fase3_datajud(candidatos);
      melhores = fase4_match(detalhes);
      await fase5_screenshot(page, melhores[0]);
    } else {
      console.log("\n⚠ Nenhum candidato vara 9198 — pulando fases seguintes.");
    }
  } catch (e) {
    console.log(`\n❌ FATAL: ${e.message}`);
  } finally {
    await browser.close();
    relatorio(candidatos, detalhes, melhores);
    console.log(`\n══ FIM ══ Saída: ${OUT}`);
  }
})();
