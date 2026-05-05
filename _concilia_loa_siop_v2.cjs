/**
 * _concilia_loa_siop_v2.cjs — Versão otimizada
 *
 * Diferença do v1: SIOP indexado por UO → ordenado por valor. Para cada LOA,
 * busca BINÁRIA encontra janela ±5% de valor dentro da UO. Reduz O(N×M) para
 * O(N × logM + k) onde k = itens na janela.
 *
 * Regra de match (dentro da mesma UO, mesma UO_Devedora_Codigo):
 *   1) Valor SIOP dentro de ±5% do Valor LOA
 *   2) Dentro da janela, maior similaridade de Tipo_Causa (palavras ≥4 chars)
 *   3) Se ninguém casa na janela e só há 1 candidato na UO → aceitar mesmo fora da janela
 *
 * Todos os SIOP só são consumidos 1 vez. Nenhuma coluna descartada.
 */

const fs = require("fs");
const path = require("path");

const LOA_PATH  = path.resolve("data/precatorios_extraidos.csv");
const SIOP_PATH = path.resolve("data/siop_2026/expedidos_2026_20260422.csv");
const OUT_DIR   = path.resolve("data/conciliado_loa_siop");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const HOJE = new Date().toISOString().slice(0,10).replace(/-/g,"");
const OUT_PATH = path.join(OUT_DIR, `LOA_SIOP_2026_conciliado_${HOJE}.csv`);

// CSV helpers
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
function num(s) {
  if (!s) return NaN;
  const n = parseFloat(String(s).replace(/\./g,"").replace(",","."));
  return isNaN(n) ? NaN : n;
}

// Carrega LOA
console.log("▶ Lendo LOA...");
const t0 = Date.now();
const loaLines = fs.readFileSync(LOA_PATH, "utf-8").split(/\r?\n/).filter(l => l.trim());
const loaHeader = parseCsvLine(loaLines[0]);
const iLoa = {
  uo: loaHeader.indexOf("UO_Devedora_Codigo"),
  valor: loaHeader.indexOf("Valor_RS"),
  tipo: loaHeader.indexOf("Tipo_Causa"),
};
const loaRecs = loaLines.slice(1).map(parseCsvLine);
console.log(`  LOA: ${loaRecs.length.toLocaleString("pt-BR")} · ${loaHeader.length} colunas`);

// Carrega SIOP
console.log("▶ Lendo SIOP...");
const siopLines = fs.readFileSync(SIOP_PATH, "utf-8").split(/\r?\n/).filter(l => l.trim());
const siopHeader = parseCsvLine(siopLines[0]);
const iSiop = {
  uo: siopHeader.indexOf("Código da UO Executada"),
  valorOrig: siopHeader.indexOf("Valor Original do Precatório"),
  valorAtu: siopHeader.indexOf("Valor Atualizado"),
  tipo: siopHeader.indexOf("Tipo de Causa"),
};
const siopRecs = siopLines.slice(1).map(parseCsvLine);
console.log(`  SIOP: ${siopRecs.length.toLocaleString("pt-BR")} · ${siopHeader.length} colunas`);

// Indexar SIOP por UO → ordenado por valor (Original; fallback Atualizado)
console.log("▶ Indexando SIOP por UO + ordenando por valor...");
const siopByUo = new Map(); // uo → [{idx, valor}, ...] ordenado por valor ASC
siopRecs.forEach((r, idx) => {
  const uo = r[iSiop.uo];
  if (!uo) return;
  const v = num(r[iSiop.valorOrig]) || num(r[iSiop.valorAtu]) || 0;
  if (!siopByUo.has(uo)) siopByUo.set(uo, []);
  siopByUo.get(uo).push({ idx, valor: v });
});
for (const arr of siopByUo.values()) arr.sort((a, b) => a.valor - b.valor);
console.log(`  ${siopByUo.size} UOs indexadas`);

// Busca binária pelo primeiro valor ≥ X
function lowerBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (arr[mid].valor < x) lo = mid + 1; else hi = mid; }
  return lo;
}

// Similaridade de Tipo_Causa (palavras ≥4 chars em comum)
const palavrasCache = new Map();
function pal(s) {
  if (palavrasCache.has(s)) return palavrasCache.get(s);
  const set = new Set((s || "").toLowerCase().replace(/[^a-záàâãéêíóôõúç ]/g, " ").split(/\s+/).filter(w => w.length >= 4));
  palavrasCache.set(s, set);
  return set;
}
function simTipo(a, b) {
  const sa = pal(a); const sb = pal(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let c = 0; for (const w of sa) if (sb.has(w)) c++;
  return c;
}

// Conciliar
console.log("▶ Conciliando LOA → SIOP (match por UO + janela ±5% valor + similaridade tipo)...");
const siopUsed = new Uint8Array(siopRecs.length);
const matches = [];
let conc = 0, soLoa = 0;
const TOL = 0.05;

for (let li = 0; li < loaRecs.length; li++) {
  const loaRow = loaRecs[li];
  const uo = loaRow[iLoa.uo];
  const vLoa = num(loaRow[iLoa.valor]);
  const tipoLoa = loaRow[iLoa.tipo] || "";

  const lista = siopByUo.get(uo);
  if (!lista || lista.length === 0) {
    matches.push({ loaIdx: li, siopIdx: null, status: "SO_LOA" });
    soLoa++;
    continue;
  }

  // Janela ±5% de valor (busca binária)
  let melhorIdx = -1;
  if (!isNaN(vLoa) && vLoa > 0) {
    const lo = vLoa * (1 - TOL);
    const hi = vLoa * (1 + TOL);
    const start = lowerBound(lista, lo);
    let melhorScore = -Infinity;
    for (let k = start; k < lista.length && lista[k].valor <= hi; k++) {
      const s = lista[k];
      if (siopUsed[s.idx]) continue;
      const simT = simTipo(tipoLoa, siopRecs[s.idx][iSiop.tipo]);
      // score = +simT (mais palavras) -|diff%|  (menos diferença)
      const diffPct = Math.abs(s.valor - vLoa) / vLoa;
      const score = simT * 10 - diffPct * 100;
      if (score > melhorScore) { melhorScore = score; melhorIdx = s.idx; }
    }
  }

  // Fallback: se UO tem só 1 candidato SIOP livre, aceitar mesmo fora da janela
  if (melhorIdx < 0) {
    const livres = lista.filter(s => !siopUsed[s.idx]);
    if (livres.length === 1) melhorIdx = livres[0].idx;
  }

  if (melhorIdx >= 0) {
    siopUsed[melhorIdx] = 1;
    matches.push({ loaIdx: li, siopIdx: melhorIdx, status: "CONCILIADO" });
    conc++;
  } else {
    matches.push({ loaIdx: li, siopIdx: null, status: "SO_LOA" });
    soLoa++;
  }

  if ((li + 1) % 10000 === 0) {
    const pct = ((li+1) / loaRecs.length * 100).toFixed(1);
    const taxa = Math.round((li + 1) / ((Date.now() - t0) / 1000));
    console.log(`  ${li+1}/${loaRecs.length} (${pct}%) · conc=${conc} · so_loa=${soLoa} · ${taxa}/s`);
  }
}

// SIOP sobra
const siopSobra = [];
for (let i = 0; i < siopRecs.length; i++) if (!siopUsed[i]) siopSobra.push(i);

console.log(`\n▶ Parciais:`);
console.log(`  CONCILIADO: ${conc.toLocaleString("pt-BR")}`);
console.log(`  SO_LOA:     ${soLoa.toLocaleString("pt-BR")}`);
console.log(`  SO_SIOP:    ${siopSobra.length.toLocaleString("pt-BR")}`);

// Escreve arquivo
console.log(`\n▶ Escrevendo ${OUT_PATH}...`);
const headerFinal = [...loaHeader, ...siopHeader, "status_conciliacao"];
const fd = fs.openSync(OUT_PATH, "w");
fs.writeSync(fd, "﻿" + headerFinal.map(csvEscape).join(";") + "\n");
const vazioSiop = new Array(siopHeader.length).fill("");
const vazioLoa = new Array(loaHeader.length).fill("");

for (const m of matches) {
  const loa = loaRecs[m.loaIdx];
  const siop = m.siopIdx != null ? siopRecs[m.siopIdx] : vazioSiop;
  fs.writeSync(fd, [...loa, ...siop, m.status].map(csvEscape).join(";") + "\n");
}
for (const si of siopSobra) {
  fs.writeSync(fd, [...vazioLoa, ...siopRecs[si], "SO_SIOP"].map(csvEscape).join(";") + "\n");
}
fs.closeSync(fd);

const stat = fs.statSync(OUT_PATH);
const dur = ((Date.now() - t0)/1000).toFixed(1);
console.log(`\n══════ CONCLUÍDO em ${dur}s ══════`);
console.log(`  Arquivo:    ${OUT_PATH}`);
console.log(`  Tamanho:    ${(stat.size/1024/1024).toFixed(2)} MB`);
console.log(`  Linhas:     ${(matches.length + siopSobra.length).toLocaleString("pt-BR")} + header`);
console.log(`  Colunas:    ${headerFinal.length}`);
console.log(`  ─────────────────────────────────`);
console.log(`  CONCILIADO: ${conc.toLocaleString("pt-BR")} (${(conc/loaRecs.length*100).toFixed(1)}% da LOA)`);
console.log(`  SO_LOA:     ${soLoa.toLocaleString("pt-BR")}`);
console.log(`  SO_SIOP:    ${siopSobra.length.toLocaleString("pt-BR")}`);
