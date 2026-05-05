// Parser do MOC 2026 TJSP -> CSV consolidado + splits por tipo de entidade.
// Fonte: ArquivosLOA/camada2/tjsp/comunicados/comunicado_53210/OFICIAL_MOC_2026.pdf
// Valida contra "Total geral" ao final do PDF.

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const PDF_PATH =
  'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/comunicados/comunicado_53210/OFICIAL_MOC_2026.pdf';
const OUT_DIR =
  'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp';

const ANO_ORCAMENTO = 2026;
const PERIODO_INI = '2024-04-03';
const PERIODO_FIM = '2025-04-02';
const DATA_EMISSAO = '2025-06-04';
const VALOR_ATUALIZADO_ATE = '2025-04-02';
const FONTE_URL =
  'https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=168780';

// Converte "49.025.123,45" -> 49025123.45
function numBR(s) {
  if (!s) return 0;
  const limpo = s.replace(/\./g, '').replace(',', '.');
  const v = parseFloat(limpo);
  return Number.isFinite(v) ? v : 0;
}

// Classifica entidade em 4 tipos
function classificar(nome) {
  const n = nome.toUpperCase();
  if (/^INSS\b|INSTITUTO NACIONAL DO SEGURO/.test(n)) return 'federal';
  if (
    /^MUNIC[IÍ]PIO\b/.test(n) ||
    /^MUNICIPIO\b/.test(n) ||
    /GUARDA CIVIL MUNICIPAL/.test(n) ||
    /HOSPITAL DO SERVIDOR P[UÚ]BLICO MUNICIPAL/.test(n) ||
    /HOSPITAL MUNICIPAL/.test(n)
  )
    return 'municipal';
  if (
    /^FAZENDA DO ESTADO/.test(n) ||
    /UNESP|UNICAMP|UNITAU|USP -|USP\s-|UNIVERSIDADE ESTADUAL|UNIVERSIDADE DE S[AÃ]O PAULO|UNIVERSIDADE DE TAUBAT/.test(
      n
    ) ||
    /AG[EÊ]NCIA ESTADUAL/.test(n)
  )
    return 'estadual';
  return 'autarquia';
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
  if (!fs.existsSync(PDF_PATH)) {
    console.error('[ERRO] PDF nao encontrado:', PDF_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const buf = fs.readFileSync(PDF_PATH);
  console.log(`[*] PDF: ${buf.length} bytes`);

  const data = await pdf(buf);
  console.log(`[*] Paginas: ${data.numpages}  chars: ${data.text.length}`);

  const linhas = data.text.split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`[*] Linhas brutas: ${linhas.length}`);

  // Padroes:
  //   "ENTIDADE NOME Finalizado N x,xx y,yy z,zz total"
  //   "Total geral N x,xx y,yy z,zz total"
  const regEntidade =
    /^(.+?)\s+Finalizado\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/;
  const regTotalGeral =
    /^Total\s+geral\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/i;

  // Lixo a pular
  const LIXO = [
    /^DEPRE -/i,
    /^Mapa Or/i,
    /^P\u00e1gina:/i,
    /^Par\u00e2metros informados/i,
    /^Ano:/i,
    /^Situa\u00e7\u00e3o do mapa:/i,
    /^Local:/i,
    /^Per\u00edodo requisitorial/i,
    /^Valor atualizado at\u00e9/i,
    /^Entidade\s+Situa\u00e7\u00e3o do mapa/i,
    /^SAJ\/PG5/i,
    /^SOFTPLAN/i,
    /^Emitido em/i,
  ];

  const registros = [];
  let totalGeral = null;
  let puladasCabecalho = 0;
  let naoCasadas = [];

  for (const linha of linhas) {
    if (LIXO.some((r) => r.test(linha))) {
      puladasCabecalho++;
      continue;
    }
    const mTot = linha.match(regTotalGeral);
    if (mTot) {
      totalGeral = {
        qtd: parseInt(mTot[1], 10),
        alimentar: numBR(mTot[2]),
        desapropriacao: numBR(mTot[3]),
        outras: numBR(mTot[4]),
        total: numBR(mTot[5]),
      };
      continue;
    }
    const m = linha.match(regEntidade);
    if (!m) {
      naoCasadas.push(linha);
      continue;
    }
    const entidade = m[1].trim();
    const qtd = parseInt(m[2], 10);
    const alimentar = numBR(m[3]);
    const desapropriacao = numBR(m[4]);
    const outras = numBR(m[5]);
    const total = numBR(m[6]);

    // Validacao arit: total = alimentar + desapropriacao + outras (toler 0.10)
    const somaCheck = alimentar + desapropriacao + outras;
    const bateSoma = Math.abs(somaCheck - total) < 0.1;

    registros.push({
      ano_orcamento: ANO_ORCAMENTO,
      tipo_entidade: classificar(entidade),
      entidade,
      situacao: 'Finalizado',
      qtd_processos: qtd,
      valor_alimentar: alimentar.toFixed(2),
      valor_desapropriacao: desapropriacao.toFixed(2),
      valor_outras: outras.toFixed(2),
      valor_total: total.toFixed(2),
      bate_soma_componentes: bateSoma ? 'SIM' : 'NAO',
      fonte: 'TJSP DEPRE MOC',
      data_emissao_moc: DATA_EMISSAO,
      periodo_requisitorial_inicio: PERIODO_INI,
      periodo_requisitorial_fim: PERIODO_FIM,
      valor_atualizado_ate: VALOR_ATUALIZADO_ATE,
      fonte_url: FONTE_URL,
    });
  }

  console.log(`[*] Linhas puladas (cabecalho/footer): ${puladasCabecalho}`);
  console.log(`[*] Registros extraidos: ${registros.length}`);
  console.log(`[*] Linhas nao casadas: ${naoCasadas.length}`);
  if (naoCasadas.length > 0 && naoCasadas.length <= 20) {
    console.log('--- nao casadas ---');
    for (const l of naoCasadas) console.log('  >>', l.slice(0, 180));
  } else if (naoCasadas.length > 20) {
    console.log('--- primeiras 10 nao casadas ---');
    for (const l of naoCasadas.slice(0, 10)) console.log('  >>', l.slice(0, 180));
  }

  // Validacao contra "Total geral"
  if (!totalGeral) {
    console.log('\n[ALERTA] Total geral nao encontrado no PDF.');
  } else {
    const somaQtd = registros.reduce((s, r) => s + r.qtd_processos, 0);
    const somaTot = registros.reduce((s, r) => s + parseFloat(r.valor_total), 0);
    const somaAli = registros.reduce((s, r) => s + parseFloat(r.valor_alimentar), 0);
    const somaDes = registros.reduce((s, r) => s + parseFloat(r.valor_desapropriacao), 0);
    const somaOut = registros.reduce((s, r) => s + parseFloat(r.valor_outras), 0);
    console.log('\n========== VALIDACAO vs Total geral ==========');
    console.log(`Qtd processos    calc=${somaQtd}   pdf=${totalGeral.qtd}   ${somaQtd === totalGeral.qtd ? 'OK' : 'DIVERG'}`);
    const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    console.log(`Alimentar        calc=${fmt(somaAli)}   pdf=${fmt(totalGeral.alimentar)}   ${Math.abs(somaAli - totalGeral.alimentar) < 1 ? 'OK' : 'DIVERG'}`);
    console.log(`Desapropriacao   calc=${fmt(somaDes)}   pdf=${fmt(totalGeral.desapropriacao)}   ${Math.abs(somaDes - totalGeral.desapropriacao) < 1 ? 'OK' : 'DIVERG'}`);
    console.log(`Outras           calc=${fmt(somaOut)}   pdf=${fmt(totalGeral.outras)}   ${Math.abs(somaOut - totalGeral.outras) < 1 ? 'OK' : 'DIVERG'}`);
    console.log(`Total            calc=${fmt(somaTot)}   pdf=${fmt(totalGeral.total)}   ${Math.abs(somaTot - totalGeral.total) < 1 ? 'OK' : 'DIVERG'}`);
  }

  // Distribuicao por tipo
  const porTipo = {};
  for (const r of registros) {
    if (!porTipo[r.tipo_entidade]) porTipo[r.tipo_entidade] = { qtd: 0, proc: 0, total: 0 };
    porTipo[r.tipo_entidade].qtd++;
    porTipo[r.tipo_entidade].proc += r.qtd_processos;
    porTipo[r.tipo_entidade].total += parseFloat(r.valor_total);
  }
  console.log('\n========== DISTRIBUICAO POR TIPO ==========');
  for (const t of Object.keys(porTipo).sort()) {
    const p = porTipo[t];
    console.log(
      `  ${t.padEnd(12)}  entidades=${String(p.qtd).padStart(4)}  processos=${String(p.proc).padStart(6)}  total=R$ ${p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  }

  const header = [
    'ano_orcamento',
    'tipo_entidade',
    'entidade',
    'situacao',
    'qtd_processos',
    'valor_alimentar',
    'valor_desapropriacao',
    'valor_outras',
    'valor_total',
    'bate_soma_componentes',
    'fonte',
    'data_emissao_moc',
    'periodo_requisitorial_inicio',
    'periodo_requisitorial_fim',
    'valor_atualizado_ate',
    'fonte_url',
  ];

  const fullCSV = path.join(OUT_DIR, 'tjsp_expedidos_2026_por_entidade.csv');
  escreverCSV(fullCSV, registros, header);
  console.log(`\n[CSV] ${fullCSV}  (${registros.length} linhas)`);

  for (const tipo of Object.keys(porTipo)) {
    const filtro = registros.filter((r) => r.tipo_entidade === tipo);
    const out = path.join(OUT_DIR, `tjsp_exp_2026_${tipo}.csv`);
    escreverCSV(out, filtro, header);
    console.log(`[CSV] ${out}  (${filtro.length} linhas)`);
  }

  // Topo 20 para revisao rapida
  const top = [...registros].sort((a, b) => parseFloat(b.valor_total) - parseFloat(a.valor_total)).slice(0, 20);
  console.log('\n========== TOP 20 POR VALOR ==========');
  for (const r of top) {
    console.log(
      `  [${r.tipo_entidade.padEnd(10)}] qtd=${String(r.qtd_processos).padStart(6)}  R$ ${parseFloat(r.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(22)}  ${r.entidade.slice(0, 80)}`
    );
  }
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
