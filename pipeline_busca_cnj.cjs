/**
 * Pipeline: busca CNJ candidato direto no TRF1
 * Testa amostra de N registros, depois escala se funcionar
 * Uso: node pipeline_busca_cnj.cjs [--limite=30] [--tipo=EFU]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (n) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null; };
const LIMITE = parseInt(getArg('limite') || '30');
const TIPO = getArg('tipo') || 'EFU';

const SRC = 'C:/Temp/auraloa-saida/conciliacao/LOA_FULL_CONCILIADO.csv';
const OUT = `C:/Temp/auraloa-saida/conciliacao/BUSCA_CNJ_${TIPO}_resultado.csv`;
const URL_BASE = 'https://processual.trf1.jus.br/consultaProcessual/processo.php';

function lerCSV(p) {
  const content = fs.readFileSync(p, 'utf-8').replace(/^\uFEFF/, '');
  const lines = content.split('\n').filter(l => l.trim());
  const header = lines[0].split(',');
  return { header, rows: lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    header.forEach((h, i) => obj[h] = (vals[i] || '').trim());
    return obj;
  })};
}

(async () => {
  const { header, rows } = lerCSV(SRC);

  // Filtrar pendentes com cnj_candidato do tipo solicitado
  let pendentes;
  if (TIPO === 'EFU') {
    pendentes = rows.filter(r =>
      r.conciliacao_status === 'NAO_IDENTIFICADO' &&
      (r.UO_Devedora_Nome || '').includes('EFU') &&
      (r.cnj_candidato || '').length > 10 &&
      (r.cnj_candidato || '').includes('.4.01.')  // só TRF1
    );
  } else {
    pendentes = rows.filter(r =>
      r.conciliacao_status === 'NAO_IDENTIFICADO' &&
      (r.cnj_candidato || '').length > 10 &&
      (r.cnj_candidato || '').includes('.4.01.')
    );
  }

  const amostra = pendentes.slice(0, LIMITE);
  console.log(`Pendentes ${TIPO} TRF1: ${pendentes.length} | Amostra: ${amostra.length}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  let encontrados = 0;
  let naoEncontrados = 0;

  for (let i = 0; i < amostra.length; i++) {
    const r = amostra[i];
    const cnj = r.cnj_candidato.replace(/\s/g, '');
    const cnjDigits = cnj.replace(/[^0-9]/g, '');

    // Tentar 3 variantes de sufixo
    const variantes = [
      cnjDigits,                                          // original (9198)
      cnjDigits.slice(0, -4) + '0000',                   // sede (0000)
      cnjDigits.slice(0, -4) + '0001',                   // subsecao 0001
    ];

    let achou = false;
    for (const v of variantes) {
      try {
        const url = `${URL_BASE}?proc=${v}&secao=TRF1&pg=1&enviar=Pesquisar`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1200);
        const texto = await page.locator('body').innerText();

        if (!texto.includes('Processo n') && !texto.includes('não foi encontrado') &&
            (texto.includes('Partes') || texto.includes('Movimenta') || texto.includes('Classe'))) {

          // Extrair processo originario
          const matchOrig = texto.match(/Processo\s+Origin[áa]rio[:\s]*([^\n]+)/i);
          const matchClasse = texto.match(/Classe[:\s]*([^\n]+)/i);
          r.cnj_processo_execucao = cnj;
          r.cnj_processo_originario = matchOrig ? matchOrig[1].trim().split(/\s/)[0] : '[ver detalhes]';
          r.conciliacao_status = 'IDENTIFICADO_PRC';
          r.conciliacao_tipo = 'PRC';
          r.match_metodo = `cnj_direto_v${variantes.indexOf(v)+1}`;
          r.causa_provavel = '';
          encontrados++;
          achou = true;

          console.log(`  [${i+1}/${amostra.length}] ENCONTRADO: ${cnj} | Variante ${variantes.indexOf(v)+1} | Orig: ${r.cnj_processo_originario} | R$ ${parseInt(r.Valor_RS || 0).toLocaleString()}`);
          break;
        }
      } catch (e) {}
    }

    if (!achou) {
      naoEncontrados++;
      if (i < 5 || i % 10 === 0) {
        console.log(`  [${i+1}/${amostra.length}] nao encontrado: ${cnj}`);
      }
    }

    await page.waitForTimeout(600);
  }

  await browser.close();

  console.log(`\n=== RESULTADO ===`);
  console.log(`Testados: ${amostra.length}`);
  console.log(`Encontrados: ${encontrados} (${(encontrados/amostra.length*100).toFixed(1)}%)`);
  console.log(`Nao encontrados: ${naoEncontrados}`);

  if (encontrados > 0) {
    console.log(`\n--- Encontrados ---`);
    amostra.filter(r => r.match_metodo && r.match_metodo.startsWith('cnj_direto')).forEach(r => {
      console.log(`  R$ ${parseInt(r.Valor_RS||0).toLocaleString().padStart(15)} | ${r.cnj_candidato} | Orig: ${r.cnj_processo_originario}`);
    });
  }

  // Salvar resultado
  const csvLines = [header.join(',')];
  amostra.forEach(r => csvLines.push(header.map(h => r[h] || '').join(',')));
  fs.writeFileSync(OUT, '\uFEFF' + csvLines.join('\n'), 'utf-8');
  console.log(`\nCSV: ${OUT}`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
