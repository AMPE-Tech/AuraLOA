/**
 * _analise_colunas_siop.cjs — analisa coluna por coluna do SIOP expedidos_2026.csv
 * Para cada coluna: nome, % preenchido, valores distintos (top 5), min/max (se numérico)
 */
const fs = require("fs");
const path = require("path");

const FILE = path.resolve("data/siop_2026/expedidos_2026_20260422.csv");
const raw = fs.readFileSync(FILE, "utf-8");
const linhas = raw.split("\n").filter(l => l.trim());

// Parser CSV simples (aceita aspas)
function parseCsvLine(line) {
  const out = []; let cur = ""; let emAspas = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { emAspas = !emAspas; continue; }
    if (c === ";" && !emAspas) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const headers = parseCsvLine(linhas[0]);
const total = linhas.length - 1;
console.log(`Total linhas de dados: ${total.toLocaleString("pt-BR")}`);
console.log(`Total colunas: ${headers.length}\n`);

// Analisar cada coluna
const cols = headers.map(() => ({ preenchidos: 0, valores: new Map(), nums: [] }));
for (let i = 1; i < linhas.length; i++) {
  const row = parseCsvLine(linhas[i]);
  for (let c = 0; c < headers.length; c++) {
    const v = (row[c] || "").trim();
    if (v !== "") {
      cols[c].preenchidos++;
      cols[c].valores.set(v, (cols[c].valores.get(v) || 0) + 1);
      // tentar número (br format: 177960,79)
      const numStr = v.replace(/\./g,"").replace(",",".");
      const num = parseFloat(numStr);
      if (!isNaN(num) && /^-?\d/.test(v)) cols[c].nums.push(num);
    }
  }
}

console.log("═══ ANÁLISE COLUNA POR COLUNA ═══\n");
for (let c = 0; c < headers.length; c++) {
  const col = cols[c];
  const pct = ((col.preenchidos / total) * 100).toFixed(1);
  const distintos = col.valores.size;
  const top = [...col.valores.entries()].sort((a,b) => b[1]-a[1]).slice(0, 3);
  console.log(`[${c+1}] ${headers[c]}`);
  console.log(`     preenchidos: ${col.preenchidos.toLocaleString("pt-BR")} (${pct}%) · distintos: ${distintos.toLocaleString("pt-BR")}`);
  if (col.nums.length > 0.8 * col.preenchidos && col.nums.length > 0) {
    const nums = col.nums;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const sum = nums.reduce((a,b)=>a+b, 0);
    console.log(`     [NUM] min=${min.toLocaleString("pt-BR")} · max=${max.toLocaleString("pt-BR")} · soma=${sum.toLocaleString("pt-BR")}`);
  }
  if (distintos <= 15) {
    console.log(`     valores: ${top.map(([v,n]) => `${v}(${n})`).join(" | ")}`);
  } else {
    console.log(`     top 3: ${top.map(([v,n]) => `${v.substring(0,50)}(${n.toLocaleString("pt-BR")})`).join(" | ")}`);
  }
  console.log();
}
