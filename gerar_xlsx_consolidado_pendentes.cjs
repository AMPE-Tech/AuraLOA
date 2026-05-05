// Converte o CSV consolidado pendentes TJSP (MOCs 2023-2026) para XLSX.
// Formata valores como numeros BR, ajusta larguras de colunas, adiciona cabecalho congelado.

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CSV = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/AuraLOA/client/public/data/tjsp_consolidado_pendentes.csv';
const OUT_PUBLIC = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/AuraLOA/client/public/data/tjsp_consolidado_pendentes.xlsx';
const OUT_PREVIEW = 'C:/Temp/auraloa-camada2-preview/data/tjsp_consolidado_pendentes.xlsx';
const OUT_ARQUIVOS = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/tjsp_consolidado_pendentes.xlsx';

// Parser CSV suporta aspas
function parseCSV(t) {
  const out = [];
  let i = 0, linha = [], campo = '', emAspas = false;
  const s = t.replace(/\r\n/g, '\n');
  while (i < s.length) {
    const c = s[i];
    if (emAspas) {
      if (c === '"') { if (s[i+1] === '"') { campo += '"'; i += 2; continue; } emAspas = false; i++; continue; }
      campo += c; i++; continue;
    }
    if (c === '"') { emAspas = true; i++; continue; }
    if (c === ',') { linha.push(campo); campo = ''; i++; continue; }
    if (c === '\n') { linha.push(campo); out.push(linha); linha = []; campo = ''; i++; continue; }
    campo += c; i++;
  }
  if (campo.length > 0 || linha.length > 0) { linha.push(campo); out.push(linha); }
  return out;
}

const txt = fs.readFileSync(CSV, 'utf-8');
const rows = parseCSV(txt).filter(r => r.length > 1);
const header = rows[0];

// Converte valores numericos e monta AOA (array of arrays)
const iAno = header.indexOf('ano_orcamento');
const iQtd = header.indexOf('qtd_processos');
const iAli = header.indexOf('valor_alimentar');
const iDes = header.indexOf('valor_desapropriacao');
const iOut = header.indexOf('valor_outras');
const iTot = header.indexOf('valor_total');
const iCod = header.indexOf('codigo_comunicado');
const iFF = header.indexOf('codigo_filefetch');

const aoa = [header.slice()];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r].slice();
  if (iAno >= 0) row[iAno] = parseInt(row[iAno]) || 0;
  if (iQtd >= 0) row[iQtd] = parseInt(row[iQtd]) || 0;
  if (iAli >= 0) row[iAli] = parseFloat(row[iAli]) || 0;
  if (iDes >= 0) row[iDes] = parseFloat(row[iDes]) || 0;
  if (iOut >= 0) row[iOut] = parseFloat(row[iOut]) || 0;
  if (iTot >= 0) row[iTot] = parseFloat(row[iTot]) || 0;
  if (iCod >= 0) row[iCod] = parseInt(row[iCod]) || row[iCod];
  if (iFF >= 0) row[iFF] = parseInt(row[iFF]) || row[iFF];
  aoa.push(row);
}

const ws = XLSX.utils.aoa_to_sheet(aoa);

// Formatacao numerica BR (R$ com separadores de milhar e 2 decimais)
const fmtBRL = 'R$ #,##0.00';
const fmtInt = '#,##0';
for (let r = 1; r < aoa.length; r++) {
  for (const col of [iAli, iDes, iOut, iTot]) {
    if (col < 0) continue;
    const cell = XLSX.utils.encode_cell({ r, c: col });
    if (ws[cell]) { ws[cell].t = 'n'; ws[cell].z = fmtBRL; }
  }
  for (const col of [iQtd]) {
    if (col < 0) continue;
    const cell = XLSX.utils.encode_cell({ r, c: col });
    if (ws[cell]) { ws[cell].t = 'n'; ws[cell].z = fmtInt; }
  }
}

// Larguras de colunas (aprox 8 chars por unidade)
const widths = header.map(h => {
  if (h === 'entidade') return { wch: 55 };
  if (h === 'fonte_url') return { wch: 65 };
  if (h === 'tipo_entidade') return { wch: 22 };
  if (h.startsWith('valor_')) return { wch: 18 };
  if (h === 'qtd_processos') return { wch: 12 };
  if (h === 'ano_orcamento') return { wch: 14 };
  if (h === 'data_publicacao_moc') return { wch: 18 };
  if (h === 'status_pagamento') return { wch: 16 };
  return { wch: Math.max(12, Math.min(h.length + 4, 30)) };
});
ws['!cols'] = widths;

// Congelar cabecalho
ws['!freeze'] = { xSplit: 0, ySplit: 1 };

// Auto filter em todas as colunas
ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: header.length - 1 } }) };

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Consolidado Pendentes');

// Aba de metadados
const meta = [
  ['Arquivo', 'tjsp_consolidado_pendentes.xlsx'],
  ['Gerado em', new Date().toISOString()],
  ['Origem', 'PDFs oficiais TJSP DEPRE — MOCs 2023/2024/2025/2026'],
  ['Total de registros', aoa.length - 1],
  ['Anos inclusos', '2023, 2024, 2025, 2026'],
  ['Status dos registros', 'PENDENTE (precatorios inseridos para o orcamento de cada ano)'],
  ['Validacao', '100% aritmetica vs Total Geral de cada PDF oficial'],
  ['Unidade', 'R$ (reais brasileiros)'],
  ['Responsavel', 'AuraLOA — pipeline de Camada 2 TJSP'],
  [],
  ['Fontes originais (PDFs)'],
  ['MOC 2023', 'https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=138020'],
  ['MOC 2024', 'https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=146918'],
  ['MOC 2025', 'https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=156766'],
  ['MOC 2026', 'https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=168780'],
];
const wsMeta = XLSX.utils.aoa_to_sheet(meta);
wsMeta['!cols'] = [{ wch: 25 }, { wch: 80 }];
XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadados');

// Salva nos 3 destinos
for (const dest of [OUT_PUBLIC, OUT_PREVIEW, OUT_ARQUIVOS]) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  XLSX.writeFile(wb, dest);
  const stat = fs.statSync(dest);
  console.log(`[OK] ${dest}  (${stat.size} bytes)`);
}

console.log(`\nTotal de linhas (sem cabecalho): ${aoa.length - 1}`);
console.log(`Colunas: ${header.length}`);
