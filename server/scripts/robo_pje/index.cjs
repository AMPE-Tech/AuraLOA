/**
 * Robô PJe — Orquestrador de consultas processuais
 * Suporta: TRF1-6, STF, STJ (drivers modulares)
 * Lastro temporal: 2007 até data da pesquisa
 * Posição no pipeline: após enriquecimento CNJ, antes do relatório DD
 *
 * Uso:
 *   node index.cjs --cnj 0134437-87.2025.4.01.9198
 *   node index.cjs --cnj 0134437-87.2025.4.01.9198 --tribunal TRF1
 *   node index.cjs --cnpj 00375972000160 --tribunal TRF1
 */

const { analisarMovimentacoes } = require('./parser.cjs');
const fs = require('fs');
const path = require('path');

// Registro de drivers por tribunal
const TRIBUNAIS = {
  TRF1: { driver: './drivers/trf1.cjs', nome: 'Tribunal Regional Federal da 1ª Região', status: 'ATIVO' },
  TRF2: { driver: './drivers/trf2.cjs', nome: 'Tribunal Regional Federal da 2ª Região', status: 'PENDENTE' },
  TRF3: { driver: './drivers/trf3.cjs', nome: 'Tribunal Regional Federal da 3ª Região', status: 'PENDENTE' },
  TRF4: { driver: './drivers/trf4.cjs', nome: 'Tribunal Regional Federal da 4ª Região', status: 'PENDENTE' },
  TRF5: { driver: './drivers/trf5.cjs', nome: 'Tribunal Regional Federal da 5ª Região', status: 'PENDENTE' },
  TRF6: { driver: './drivers/trf6.cjs', nome: 'Tribunal Regional Federal da 6ª Região', status: 'PENDENTE' },
  STF:  { driver: './drivers/stf.cjs',  nome: 'Supremo Tribunal Federal', status: 'PENDENTE' },
  STJ:  { driver: './drivers/stj.cjs',  nome: 'Superior Tribunal de Justiça', status: 'PENDENTE' },
};

function detectarTribunal(cnj) {
  // CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
  // J=4 (Justiça Federal), TR=01 (TRF1), 02 (TRF2), etc.
  // J=1 (STF), J=2 (STJ para recursos)
  const match = cnj.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (!match) return null;
  const segmento = match[1];
  const regiao = match[2];

  if (segmento === '4') {
    const map = { '01': 'TRF1', '02': 'TRF2', '03': 'TRF3', '04': 'TRF4', '05': 'TRF5', '06': 'TRF6' };
    return map[regiao] || null;
  }
  if (segmento === '1') return 'STF';
  if (segmento === '2') return 'STJ';
  return null;
}

function formatarCNJ(numeros) {
  // Converte 01344378720254019198 para 0134437-87.2025.4.01.9198
  const n = numeros.replace(/\D/g, '').padStart(20, '0');
  return `${n.slice(0,7)}-${n.slice(7,9)}.${n.slice(9,13)}.${n.slice(13,14)}.${n.slice(14,16)}.${n.slice(16,20)}`;
}

async function consultarProcesso(cnj, options = {}) {
  const tribunal = options.tribunal || detectarTribunal(cnj);
  if (!tribunal) {
    return { erro: 'Tribunal não identificado no CNJ: ' + cnj, tribunal: null };
  }

  const config = TRIBUNAIS[tribunal];
  if (!config) {
    return { erro: 'Tribunal não suportado: ' + tribunal, tribunal };
  }

  if (config.status !== 'ATIVO') {
    return {
      erro: `Driver ${tribunal} ainda não implementado (status: ${config.status})`,
      tribunal,
      nome_tribunal: config.nome,
      sugestao: 'Implementar driver em ' + config.driver,
    };
  }

  console.log(`[robo_pje] Consultando ${tribunal} — CNJ: ${cnj}`);
  console.log(`[robo_pje] Tribunal: ${config.nome}`);

  const driver = require(config.driver);
  const resultado = await driver.consultarPorCNJ(cnj, {
    headless: options.headless !== false,
    timeout: options.timeout || 30000,
    screenshot: options.screenshot,
  });

  // Analisar movimentações
  if (resultado.movimentacoes && resultado.movimentacoes.length > 0) {
    const analise = analisarMovimentacoes(resultado.movimentacoes);
    resultado.analise = analise;
    console.log(`[robo_pje] Movimentações: ${analise.total_movimentacoes}`);
    console.log(`[robo_pje] Status pagamento: ${analise.status_pagamento}`);
    if (analise.oficio_requisitorio) {
      console.log(`[robo_pje] Ofício requisitório: ${analise.oficio_requisitorio.dataHora}`);
    }
    if (analise.gravames.length > 0) {
      console.log(`[robo_pje] Gravames: ${analise.gravames.length}`);
    }
  }

  return resultado;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  let cnj = null;
  let cnpj = null;
  let tribunal = null;
  let headless = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cnj' && args[i + 1]) cnj = args[++i];
    if (args[i] === '--cnpj' && args[i + 1]) cnpj = args[++i];
    if (args[i] === '--tribunal' && args[i + 1]) tribunal = args[++i];
    if (args[i] === '--visual') headless = false;
  }

  if (!cnj && !cnpj) {
    console.log('Uso:');
    console.log('  node index.cjs --cnj 0134437-87.2025.4.01.9198');
    console.log('  node index.cjs --cnj 0134437-87.2025.4.01.9198 --visual');
    console.log('  node index.cjs --cnpj 00375972000160 --tribunal TRF1');
    console.log();
    console.log('Tribunais suportados:');
    Object.entries(TRIBUNAIS).forEach(([k, v]) => {
      console.log(`  ${k}: ${v.nome} [${v.status}]`);
    });
    process.exit(0);
  }

  (async () => {
    let resultado;
    if (cnj) {
      // Se for número puro, formatar como CNJ
      if (!cnj.includes('-')) cnj = formatarCNJ(cnj);
      resultado = await consultarProcesso(cnj, { tribunal, headless, screenshot: 'C:/Temp/robo_pje_resultado.png' });
    } else if (cnpj) {
      if (!tribunal) { console.error('--tribunal obrigatório para busca por CNPJ'); process.exit(1); }
      const driver = require(TRIBUNAIS[tribunal].driver);
      resultado = await driver.consultarPorCNPJ(cnpj, { headless });
    }

    console.log('\n' + JSON.stringify(resultado, null, 2));

    // Salvar resultado
    const outPath = 'C:/Temp/auraloa-saida/robo_pje_resultado.json';
    fs.writeFileSync(outPath, JSON.stringify(resultado, null, 2), 'utf-8');
    console.log(`\nSalvo: ${outPath}`);
  })().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
}

module.exports = { consultarProcesso, detectarTribunal, formatarCNJ, TRIBUNAIS };
