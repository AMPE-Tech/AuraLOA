// Parser das listas individuais TJSP (comunicados FileFetch por entidade).
// Gera CSV consolidado + splits por entidade.
// Campos: ES/EP + CNJ + Credor + Advogado + metadados.
// Fontes: UNICAMP 53296 | IPREVEN 61711 | INSS 31059

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const BASE_PDF = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda/listas_filefetch';
const OUT_DIR = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/individuais';

const FONTES = [
  {
    arquivo: 'lista_UNICAMP_53296.pdf',
    entidade: 'UNICAMP - Universidade Estadual de Campinas',
    tipo_entidade: 'estadual',
    codigo_comunicado: 4679,
    codigo_filefetch: 53296,
  },
  {
    arquivo: 'lista_IPREVEN_61711.pdf',
    entidade: 'IPREVEN - Instituto de Previdencia Municipal de Presidente Venceslau',
    tipo_entidade: 'municipal_autarquia',
    codigo_comunicado: 6148,
    codigo_filefetch: 61711,
  },
  {
    arquivo: 'lista_INSS_31059.pdf',
    entidade: 'INSS - Instituto Nacional do Seguro Social',
    tipo_entidade: 'federal',
    codigo_comunicado: 1342,
    codigo_filefetch: 31059,
  },
];

// Regex do formato CNJ moderno (20 digitos): NNNNNNN-DD.AAAA.J.TR.OOOO
const REG_CNJ_MODERNO = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

function extrairCampo(texto, re, grupo = 1) {
  const m = texto.match(re);
  return m ? (m[grupo] || '').trim() : '';
}

function limparMulti(s) {
  if (!s) return '';
  return s
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .slice(0, 300);
}

// Extrai bloco de 1 precatorio
function parsearBloco(bloco) {
  const reg = {
    ordem_pagto: /Ordem de Pagto\.?:\s*([0-9]+\s*\/\s*[0-9]+)/,
    natureza: /Natureza:\s*([A-Z\u00c0-\u00dc \u00e7\u00e3\u00f5]+?)\s*(?:ES\/EP|-)/i,
    es_ep: /ES\/EP:\s*([0-9]+\s*\/\s*[0-9]+)/,
    num_autos_raw: /N[\u00ba\u00b0o]\s*de\s*autos:\s*([^\n]+)/,
    ordem_orc: /Ordem\s+Or\u00e7ament[\u00e1a]ria:\s*([0-9]+\s*\/\s*[0-9]+)/,
    protocolo_geral: /N[\u00ba\u00b0o]\s*(?:do\s*)?Protocolo\s*Geral:\s*([0-9]+)/,
    data_protocolo: /Data\s*do\s*Protocolo:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/,
    autos_antigos: /N[\u00ba\u00b0o]\s*de\s*autos\s*antigos:\s*([^\n]+)/,
    autor: /Autor\(es\)\s*:?\s*([^\n]+)/,
    advogado: /Advogado\(s\)\s*:?\s*([^\n]+)/,
  };

  const r = {};
  for (const [k, re] of Object.entries(reg)) {
    r[k] = extrairCampo(bloco, re);
  }

  // Remove lixo de quebra de linha do num_autos (truncar antes da proxima label tipo "Ordem" ou "N\u00b0")
  let numAutosRaw = r.num_autos_raw
    .replace(/\s*Ordem\s+Or\u00e7ament.*$/i, '')
    .replace(/\s*N[\u00ba\u00b0o]\s*de.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Identifica se eh CNJ moderno
  const cnjMatch = numAutosRaw.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  const cnjModerno = cnjMatch ? cnjMatch[0] : '';
  const cnjAntigoFormato = !cnjModerno ? numAutosRaw : '';

  // Limpa natureza para remover sufixos estranhos
  const natureza = r.natureza
    ? r.natureza.replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim()
    : '';

  return {
    ordem_pagto: r.ordem_pagto.replace(/\s+/g, ''),
    natureza,
    es_ep: r.es_ep.replace(/\s+/g, ''),
    cnj_moderno: cnjModerno,
    cnj_antigo_formato_curto: cnjAntigoFormato,
    ordem_orcamentaria: r.ordem_orc.replace(/\s+/g, ''),
    protocolo_geral: r.protocolo_geral,
    data_protocolo: r.data_protocolo,
    autos_antigos: limparMulti(r.autos_antigos),
    credor: limparMulti(r.autor),
    advogado: limparMulti(r.advogado),
  };
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function escreverCSV(arquivo, registros, header) {
  const linhas = [header.join(',')];
  for (const r of registros) {
    linhas.push(header.map((h) => csvEscape(r[h])).join(','));
  }
  fs.writeFileSync(arquivo, linhas.join('\n') + '\n', 'utf-8');
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const todos = [];
  const resumo = [];

  for (const f of FONTES) {
    const pdfPath = path.join(BASE_PDF, f.arquivo);
    if (!fs.existsSync(pdfPath)) {
      console.log(`[!] PDF nao encontrado: ${pdfPath}`);
      continue;
    }
    const buf = fs.readFileSync(pdfPath);
    const d = await pdf(buf);

    const blocos = d.text.split(/(?=Ordem de Pagto\.)/).filter((b) => /Ordem de Pagto/.test(b));
    console.log(`\n[${f.entidade}] PDF ${buf.length} bytes, ${d.numpages} paginas, ${blocos.length} blocos`);

    const registros = [];
    let comCNJModerno = 0;
    let semCNJAlgum = 0;

    for (const b of blocos) {
      const dados = parsearBloco(b);
      const reg = {
        entidade: f.entidade,
        tipo_entidade: f.tipo_entidade,
        codigo_comunicado: f.codigo_comunicado,
        codigo_filefetch: f.codigo_filefetch,
        es_ep: dados.es_ep,
        cnj_moderno: dados.cnj_moderno,
        cnj_antigo_formato_curto: dados.cnj_antigo_formato_curto,
        ano_orcamento: dados.ordem_pagto.split('/')[1] || '',
        ordem_pagto: dados.ordem_pagto,
        ordem_orcamentaria: dados.ordem_orcamentaria,
        natureza: dados.natureza,
        credor: dados.credor,
        advogado: dados.advogado,
        autos_antigos: dados.autos_antigos,
        protocolo_geral: dados.protocolo_geral,
        data_protocolo: dados.data_protocolo,
        fonte_url: `https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=${f.codigo_filefetch}`,
      };
      registros.push(reg);
      if (reg.cnj_moderno) comCNJModerno++;
      if (!reg.cnj_moderno && !reg.cnj_antigo_formato_curto) semCNJAlgum++;
    }

    // Salva split por entidade
    const header = [
      'entidade',
      'tipo_entidade',
      'codigo_comunicado',
      'codigo_filefetch',
      'es_ep',
      'cnj_moderno',
      'cnj_antigo_formato_curto',
      'ano_orcamento',
      'ordem_pagto',
      'ordem_orcamentaria',
      'natureza',
      'credor',
      'advogado',
      'autos_antigos',
      'protocolo_geral',
      'data_protocolo',
      'fonte_url',
    ];
    const slug = f.entidade.split(' ')[0].toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const outFile = path.join(OUT_DIR, `tjsp_${slug}_individuais.csv`);
    escreverCSV(outFile, registros, header);

    const comES = registros.filter((r) => r.es_ep).length;
    const comCredor = registros.filter((r) => r.credor).length;
    const comAdv = registros.filter((r) => r.advogado).length;
    const pct = (n) => ((n / registros.length) * 100).toFixed(1) + '%';

    console.log(`  ES/EP:     ${comES}/${registros.length} (${pct(comES)})`);
    console.log(`  Credor:    ${comCredor}/${registros.length} (${pct(comCredor)})`);
    console.log(`  Advogado:  ${comAdv}/${registros.length} (${pct(comAdv)})`);
    console.log(`  CNJ moderno:        ${comCNJModerno}/${registros.length} (${pct(comCNJModerno)})`);
    console.log(`  CNJ formato curto:  ${registros.length - comCNJModerno - semCNJAlgum}/${registros.length}`);
    console.log(`  SEM CNJ algum:      ${semCNJAlgum}/${registros.length}`);
    console.log(`  CSV: ${outFile}`);

    resumo.push({
      entidade: f.entidade,
      tipo: f.tipo_entidade,
      precatorios: registros.length,
      com_es_ep: comES,
      com_credor: comCredor,
      com_advogado: comAdv,
      cnj_moderno: comCNJModerno,
      cnj_antigo: registros.length - comCNJModerno - semCNJAlgum,
      sem_cnj: semCNJAlgum,
      arquivo: outFile,
    });

    todos.push(...registros);
  }

  // CSV consolidado
  const header = Object.keys(todos[0] || {});
  const csvCons = path.join(OUT_DIR, 'tjsp_precatorios_individuais_CONSOLIDADO.csv');
  escreverCSV(csvCons, todos, header);

  console.log('\n========== RESUMO GERAL ==========');
  console.log(`Total de precatorios individuais extraidos: ${todos.length}`);
  console.log(`CSV consolidado: ${csvCons}`);
  console.table(resumo.map((r) => ({
    entidade: r.entidade.slice(0, 40),
    precatorios: r.precatorios,
    com_4_campos: Math.min(r.com_es_ep, r.com_credor, r.com_advogado, r.precatorios - r.sem_cnj),
    cnj_moderno: r.cnj_moderno,
    cnj_antigo: r.cnj_antigo,
    sem_cnj: r.sem_cnj,
  })));

  console.log('\nAmostra (5 primeiros registros do consolidado):');
  for (const r of todos.slice(0, 5)) {
    console.log(`  [${r.tipo_entidade.padEnd(18)}] ES/EP=${r.es_ep.padEnd(12)} CNJ=${(r.cnj_moderno || r.cnj_antigo_formato_curto).padEnd(30)} ${r.credor.slice(0, 40)}`);
  }
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
