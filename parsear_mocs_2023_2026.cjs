// Parser unificado dos MOCs 2023, 2024, 2025, 2026 do TJSP.
// Gera CSV consolidado com entidade x ano + validacao vs Total Geral de cada PDF.

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const BASE = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/mocs_anuais';
const OUT_DIR = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp';

const MOCS = [
  { ano: 2023, arquivo: 'MOC_2023.pdf', codigo_filefetch: 138020, codigo_comunicado: 32616, data_publicacao: '2022-04-28' },
  { ano: 2024, arquivo: 'MOC_2024.pdf', codigo_filefetch: 146918, codigo_comunicado: 37264, data_publicacao: '2023-05-29' },
  { ano: 2025, arquivo: 'MOC_2025.pdf', codigo_filefetch: 156766, codigo_comunicado: 44624, data_publicacao: '2024-07-04' },
  { ano: 2026, arquivo: 'MOC_2026.pdf', codigo_filefetch: 168780, codigo_comunicado: 53210, data_publicacao: '2025-06-06' },
];

function numBR(s) { if (!s) return 0; const v = parseFloat(s.replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? v : 0; }

function classificar(nome) {
  const n = nome.toUpperCase();
  if (/^INSS\b|INSTITUTO NACIONAL DO SEGURO/.test(n)) return 'federal';
  if (/^MUNIC[IÍ]PIO\b|^MUNICIPIO\b|GUARDA CIVIL MUNICIPAL|HOSPITAL MUNICIPAL|HOSPITAL DO SERVIDOR P/.test(n)) return 'municipal';
  if (/^FAZENDA DO ESTADO|UNESP|UNICAMP|UNITAU|^USP\b|USP -|UNIVERSIDADE ESTADUAL|UNIVERSIDADE DE S[AÃ]O PAULO|UNIVERSIDADE DE TAUBAT|AG[EÊ]NCIA ESTADUAL/.test(n)) return 'estadual';
  return 'autarquia_municipal';
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function escreverCSV(arq, regs, header) {
  const linhas = [header.join(',')];
  for (const r of regs) linhas.push(header.map(h => csvEscape(r[h])).join(','));
  fs.writeFileSync(arq, linhas.join('\n') + '\n', 'utf-8');
}

async function parsearMOC(meta) {
  const pdfPath = path.join(BASE, meta.arquivo);
  const buf = fs.readFileSync(pdfPath);
  const d = await pdf(buf);
  const linhas = d.text.split('\n').map(l => l.trim()).filter(Boolean);

  const regEntidade = /^(.+?)\s+Finalizado\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/;
  const regTotal = /^Total\s+geral\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/i;
  const LIXO = [/^DEPRE -/i, /^Mapa Or/i, /^P\u00e1gina:/i, /^Par\u00e2metros/i, /^Ano:/i, /^Situa\u00e7\u00e3o/i, /^Local:/i, /^Per\u00edodo/i, /^Valor atualizado/i, /^Entidade\s+Situa\u00e7\u00e3o/i, /^SAJ/, /^SOFTPLAN/, /^Emitido em/i];

  const registros = [];
  let totalGeral = null;

  for (const linha of linhas) {
    if (LIXO.some(r => r.test(linha))) continue;
    const mt = linha.match(regTotal);
    if (mt) {
      totalGeral = { qtd: +mt[1], alimentar: numBR(mt[2]), desapropriacao: numBR(mt[3]), outras: numBR(mt[4]), total: numBR(mt[5]) };
      continue;
    }
    const m = linha.match(regEntidade);
    if (!m) continue;
    const entidade = m[1].trim();
    registros.push({
      ano_orcamento: meta.ano,
      tipo_entidade: classificar(entidade),
      entidade,
      qtd_processos: +m[2],
      valor_alimentar: numBR(m[3]).toFixed(2),
      valor_desapropriacao: numBR(m[4]).toFixed(2),
      valor_outras: numBR(m[5]).toFixed(2),
      valor_total: numBR(m[6]).toFixed(2),
      status_pagamento: 'PENDENTE',
      data_publicacao_moc: meta.data_publicacao,
      codigo_comunicado: meta.codigo_comunicado,
      codigo_filefetch: meta.codigo_filefetch,
      fonte: 'TJSP DEPRE MOC',
      fonte_url: `https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=${meta.codigo_filefetch}`,
    });
  }

  // Validacao
  const somaQtd = registros.reduce((s, r) => s + r.qtd_processos, 0);
  const somaTot = registros.reduce((s, r) => s + parseFloat(r.valor_total), 0);
  const bate = totalGeral && somaQtd === totalGeral.qtd && Math.abs(somaTot - totalGeral.total) < 1;

  return { meta, registros, totalGeral, bateValidacao: bate, somaQtd, somaTot };
}

(async () => {
  const todos = [];
  console.log('========== PARSER MOCs 2023-2026 ==========\n');

  for (const m of MOCS) {
    const r = await parsearMOC(m);
    const bateStr = r.bateValidacao ? 'OK' : 'DIVERG';
    const totPdf = r.totalGeral ? `${r.totalGeral.qtd} proc  R$ ${r.totalGeral.total.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '?';
    const totCalc = `${r.somaQtd} proc  R$ ${r.somaTot.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    console.log(`  MOC ${m.ano}: ${r.registros.length.toString().padStart(3)} entidades  |  calc: ${totCalc.padEnd(45)} | pdf: ${totPdf.padEnd(45)} | ${bateStr}`);
    todos.push(...r.registros);
  }

  console.log(`\nTotal registros: ${todos.length}`);

  // Distribuicao por tipo
  const porTipo = {};
  for (const r of todos) {
    if (!porTipo[r.tipo_entidade]) porTipo[r.tipo_entidade] = { qtd: 0, processos: 0, total: 0 };
    porTipo[r.tipo_entidade].qtd++;
    porTipo[r.tipo_entidade].processos += r.qtd_processos;
    porTipo[r.tipo_entidade].total += parseFloat(r.valor_total);
  }
  console.log('\nDistribuicao por tipo (todos os anos):');
  for (const [t, d] of Object.entries(porTipo).sort()) {
    console.log(`  ${t.padEnd(22)} entidades=${d.qtd.toString().padStart(4)}  processos=${d.processos.toString().padStart(7)}  total=R$ ${d.total.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`);
  }

  const header = ['ano_orcamento', 'tipo_entidade', 'entidade', 'qtd_processos', 'valor_alimentar', 'valor_desapropriacao', 'valor_outras', 'valor_total', 'status_pagamento', 'data_publicacao_moc', 'codigo_comunicado', 'codigo_filefetch', 'fonte', 'fonte_url'];
  const out = path.join(OUT_DIR, 'tjsp_consolidado_pendentes.csv');
  escreverCSV(out, todos, header);
  console.log(`\n[CSV] ${out}  (${todos.length} linhas)`);

  // Tambem copia para client/public/data
  const publico = path.join('C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/AuraLOA/client/public/data', 'tjsp_consolidado_pendentes.csv');
  escreverCSV(publico, todos, header);
  console.log(`[CSV] ${publico}`);

  // Top 15 entidades por valor TOTAL (soma todos anos)
  const porEnt = {};
  for (const r of todos) {
    if (!porEnt[r.entidade]) porEnt[r.entidade] = { total: 0, anos: 0 };
    porEnt[r.entidade].total += parseFloat(r.valor_total);
    porEnt[r.entidade].anos++;
  }
  const top = Object.entries(porEnt).sort((a, b) => b[1].total - a[1].total).slice(0, 15);
  console.log('\nTop 15 entidades (soma 2023+2024+2025+2026):');
  for (const [ent, d] of top) {
    console.log(`  R$ ${d.total.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}).padStart(22)}  anos=${d.anos}  ${ent.slice(0, 60)}`);
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
