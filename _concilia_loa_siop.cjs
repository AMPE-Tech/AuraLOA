/**
 * _concilia_loa_siop.cjs — Concilia LOA + SIOP em arquivo único (33 colunas)
 * Regra de match (cascata, todos dentro da mesma UO):
 *   1) UO_Devedora_Codigo (LOA) == Código da UO Executada (SIOP)       [obrigatório]
 *   2) Valor LOA ≈ Valor SIOP (Original OU Atualizado) com ±5%          [preferencial]
 *   3) Tipo_Causa similar (≥1 palavra ≥4 letras em comum)               [desempate]
 *
 * Cada linha SIOP só é consumida 1 vez. Todas as linhas LOA permanecem.
 * SIOP que sobrar vira SO_SIOP. Nenhuma coluna descartada.
 */

const fs = require("fs");
const path = require("path");

const LOA_PATH  = path.resolve("data/precatorios_extraidos.csv");
const SIOP_PATH = path.resolve("data/siop_2026/expedidos_2026_20260422.csv");
const OUT_DIR   = path.resolve("data/conciliado_loa_siop");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const HOJE = new Date().toISOString().slice(0,10).replace(/-/g,"");
const OUT_PATH = path.join(OUT_DIR, `LOA_SIOP_2026_conciliado_${HOJE}.csv`);

// ── Parser CSV (com aspas + ; separador) ────────────────────────
function parseCsvLine(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { q = !q; continue; }
    if (c === ";" && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map(v => v.trim());
}
function csvEscape(v) {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[;"\n,]/.test(s) ? `"${s}"` : s;
}
function parseNumeroBr(s) {
  if (!s) return NaN;
  const n = parseFloat(String(s).replace(/\./g,"").replace(",","."));
  return isNaN(n) ? NaN : n;
}

// ── Carrega LOA ──────────────────────────────────────────────────
console.log("▶ Lendo LOA...");
const loaLines = fs.readFileSync(LOA_PATH, "utf-8").split(/\r?\n/).filter(l => l.trim());
const loaHeader = parseCsvLine(loaLines[0]);
const iLoa = {
  uo: loaHeader.indexOf("UO_Devedora_Codigo"),
  valor: loaHeader.indexOf("Valor_RS"),
  tipo: loaHeader.indexOf("Tipo_Causa"),
  ano: loaHeader.indexOf("Ano"),
  prec: loaHeader.indexOf("Precatorio"),
};
const loaRecs = loaLines.slice(1).map(l => parseCsvLine(l));
console.log(`  LOA: ${loaRecs.length.toLocaleString("pt-BR")} registros · ${loaHeader.length} colunas`);

// ── Carrega SIOP ─────────────────────────────────────────────────
console.log("▶ Lendo SIOP...");
const siopLines = fs.readFileSync(SIOP_PATH, "utf-8").split(/\r?\n/).filter(l => l.trim());
const siopHeader = parseCsvLine(siopLines[0]);
const iSiop = {
  uo: siopHeader.indexOf("Código da UO Executada"),
  valorOrig: siopHeader.indexOf("Valor Original do Precatório"),
  valorAtu: siopHeader.indexOf("Valor Atualizado"),
  tipo: siopHeader.indexOf("Tipo de Causa"),
  chave: siopHeader.indexOf("Chave"),
};
const siopRecs = siopLines.slice(1).map(l => parseCsvLine(l));
console.log(`  SIOP: ${siopRecs.length.toLocaleString("pt-BR")} registros · ${siopHeader.length} colunas`);

// ── Indexa SIOP por UO ────────────────────────────────────────────
console.log("▶ Indexando SIOP por UO...");
const siopByUo = new Map();
const siopUsed = new Uint8Array(siopRecs.length);
siopRecs.forEach((r, idx) => {
  const uo = r[iSiop.uo];
  if (!uo) return;
  if (!siopByUo.has(uo)) siopByUo.set(uo, []);
  siopByUo.get(uo).push(idx);
});
console.log(`  Indexadas ${siopByUo.size} UOs distintas`);

// ── Similaridade de Tipo Causa (palavras ≥4 letras em comum) ─────
function palavrasChave(s) {
  return new Set((s || "").toLowerCase().replace(/[^a-záàâãéêíóôõúç ]/g, " ").split(/\s+/).filter(w => w.length >= 4));
}
function similaridadeTipo(a, b) {
  const sa = palavrasChave(a); const sb = palavrasChave(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let comum = 0; for (const w of sa) if (sb.has(w)) comum++;
  return comum;
}

// ── Match cascata ────────────────────────────────────────────────
console.log("▶ Conciliando LOA → SIOP...");
const matches = []; // { loaIdx, siopIdx | null, status }
let conciliados = 0, soLoa = 0;
const tStart = Date.now();
for (let li = 0; li < loaRecs.length; li++) {
  const loaRow = loaRecs[li];
  const uo = loaRow[iLoa.uo];
  const valorLoa = parseNumeroBr(loaRow[iLoa.valor]);
  const tipoLoa = loaRow[iLoa.tipo] || "";

  const candidatos = (siopByUo.get(uo) || []).filter(idx => !siopUsed[idx]);
  if (candidatos.length === 0) {
    matches.push({ loaIdx: li, siopIdx: null, status: "SO_LOA" });
    soLoa++;
    continue;
  }

  // Scoring: menor diff valor + maior similaridade tipo
  let melhor = null; let melhorScore = -Infinity;
  for (const sIdx of candidatos) {
    const sRow = siopRecs[sIdx];
    const valorSiopOrig = parseNumeroBr(sRow[iSiop.valorOrig]);
    const valorSiopAtu  = parseNumeroBr(sRow[iSiop.valorAtu]);
    const melhorValorSiop = [valorSiopOrig, valorSiopAtu].filter(v => !isNaN(v));

    // Tolerância de valor ±5% → diferença relativa
    let diffValor = Infinity;
    if (!isNaN(valorLoa) && valorLoa > 0 && melhorValorSiop.length > 0) {
      diffValor = Math.min(...melhorValorSiop.map(v => Math.abs(v - valorLoa) / valorLoa));
    }
    const simTipo = similaridadeTipo(tipoLoa, sRow[iSiop.tipo]);

    // score: -diffValor + 0.1 × simTipo (quanto maior, melhor)
    const score = -diffValor + 0.1 * simTipo;
    if (score > melhorScore) { melhorScore = score; melhor = sIdx; }
  }

  // Aceitar se diff valor ≤ 5% OU se só tem esse candidato na UO
  const aceito = melhor != null && (melhorScore >= -0.05 || candidatos.length === 1);
  if (aceito) {
    siopUsed[melhor] = 1;
    matches.push({ loaIdx: li, siopIdx: melhor, status: "CONCILIADO" });
    conciliados++;
  } else {
    matches.push({ loaIdx: li, siopIdx: null, status: "SO_LOA" });
    soLoa++;
  }

  if ((li + 1) % 5000 === 0) {
    const pct = ((li+1) / loaRecs.length * 100).toFixed(1);
    console.log(`  ${li+1}/${loaRecs.length} (${pct}%) · conciliados=${conciliados} · so_loa=${soLoa}`);
  }
}

// Linhas SIOP não consumidas
const siopSobra = [];
for (let si = 0; si < siopRecs.length; si++) if (!siopUsed[si]) siopSobra.push(si);
console.log(`\n▶ Resultado parcial:`);
console.log(`  CONCILIADO: ${conciliados.toLocaleString("pt-BR")}`);
console.log(`  SO_LOA:     ${soLoa.toLocaleString("pt-BR")}`);
console.log(`  SO_SIOP:    ${siopSobra.length.toLocaleString("pt-BR")}`);

// ── Escreve arquivo final ────────────────────────────────────────
console.log(`\n▶ Escrevendo ${OUT_PATH}...`);
const headerFinal = [...loaHeader, ...siopHeader, "status_conciliacao"];
const fd = fs.openSync(OUT_PATH, "w");
fs.writeSync(fd, "﻿" + headerFinal.map(csvEscape).join(";") + "\n"); // BOM UTF-8

// 1. Linhas LOA (com ou sem match SIOP)
for (const m of matches) {
  const loa = loaRecs[m.loaIdx];
  const siop = m.siopIdx != null ? siopRecs[m.siopIdx] : new Array(siopHeader.length).fill("");
  const linha = [...loa, ...siop, m.status];
  fs.writeSync(fd, linha.map(csvEscape).join(";") + "\n");
}
// 2. Linhas SIOP sobra
for (const si of siopSobra) {
  const loaVazio = new Array(loaHeader.length).fill("");
  const linha = [...loaVazio, ...siopRecs[si], "SO_SIOP"];
  fs.writeSync(fd, linha.map(csvEscape).join(";") + "\n");
}
fs.closeSync(fd);

const stat = fs.statSync(OUT_PATH);
const totalLinhas = matches.length + siopSobra.length;
const dur = ((Date.now() - tStart)/1000).toFixed(1);
console.log(`\n══════ CONCLUÍDO em ${dur}s ══════`);
console.log(`  Arquivo:    ${OUT_PATH}`);
console.log(`  Tamanho:    ${(stat.size/1024/1024).toFixed(2)} MB`);
console.log(`  Linhas:     ${totalLinhas.toLocaleString("pt-BR")} + header`);
console.log(`  Colunas:    ${headerFinal.length}`);
console.log(`  ───────────────────────────────────────────────`);
console.log(`  CONCILIADO: ${conciliados.toLocaleString("pt-BR")} (${(conciliados/loaRecs.length*100).toFixed(1)}% da LOA)`);
console.log(`  SO_LOA:     ${soLoa.toLocaleString("pt-BR")} (LOA sem match no SIOP)`);
console.log(`  SO_SIOP:    ${siopSobra.length.toLocaleString("pt-BR")} (SIOP não consumido)`);
