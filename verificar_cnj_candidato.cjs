/**
 * Verifica CNJ candidato direto no TRF1 (opção 1: Número do Processo)
 * Para cada CNJ pendente, busca e extrai Processo Originário
 *
 * Uso: node verificar_cnj_candidato.cjs --csv=CRUZAMENTO_LOA_TRF1_v3.csv
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ENR_DIR = 'C:/Temp/auraloa-saida/enriquecimento/';
const CSV_IN = ENR_DIR + 'CRUZAMENTO_LOA_TRF1_v3.csv';
const CSV_OUT = ENR_DIR + 'CRUZAMENTO_LOA_TRF1_v4_verificado.csv';
const URL_BASE = 'https://processual.trf1.jus.br/consultaProcessual/processo.php';

// Ler CSV e filtrar pendentes
function lerCSV(path) {
  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const header = lines[0].split(';');
  return lines.slice(1).map(line => {
    const vals = line.split(';');
    const obj = {};
    header.forEach((h, i) => obj[h.replace(/^\uFEFF/, '')] = (vals[i] || '').trim());
    return obj;
  });
}

(async () => {
  const rows = lerCSV(CSV_IN);
  const pendentes = rows.filter(r => r.match_status && r.match_status.includes('PENDENTE'));
  const resolvidos = rows.filter(r => r.match_status && !r.match_status.includes('PENDENTE'));

  console.log(`Total: ${rows.length} | Resolvidos: ${resolvidos.length} | Pendentes: ${pendentes.length}`);

  if (pendentes.length === 0) {
    console.log('Nenhum pendente. Nada a fazer.');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  let verificados = 0;
  let encontrados = 0;
  let naoEncontrados = 0;
  let erros = 0;

  for (let i = 0; i < pendentes.length; i++) {
    const r = pendentes[i];
    const cnj = r.cnj_candidato;
    if (!cnj || cnj.length < 10) {
      r.match_status = 'SKIP_SEM_CNJ';
      continue;
    }

    // Limpar CNJ (remover espacos, garantir formato)
    const cnjLimpo = cnj.replace(/\s/g, '');
    const cnjDigits = cnjLimpo.replace(/[^0-9]/g, '');

    // Tentar com sufixo 9198 (secao precatorios TRF1)
    const url9198 = `${URL_BASE}?proc=${cnjDigits.replace(/9198$/, '9198')}&secao=TRF1&pg=1&enviar=Pesquisar`;
    // Tambem tentar com sufixo 0000 (sede)
    const url0000 = `${URL_BASE}?proc=${cnjDigits.replace(/9198$/, '0000').replace(/0000$/, '0000')}&secao=TRF1&pg=1&enviar=Pesquisar`;

    try {
      // Tentativa 1: com 9198
      await page.goto(url9198, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      let texto = await page.locator('body').innerText();

      let found = !texto.includes('Processo n\u00e3o foi encontrado') && !texto.includes('Processo não foi encontrado');

      // Se nao achou com 9198, tentar sem o sufixo (so digits do CNJ)
      if (!found) {
        const cnjSemSufixo = cnjDigits.slice(0, -4) + '0000';
        const urlAlt = `${URL_BASE}?proc=${cnjSemSufixo}&secao=TRF1&pg=1&enviar=Pesquisar`;
        await page.goto(urlAlt, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1500);
        texto = await page.locator('body').innerText();
        found = !texto.includes('Processo n') || texto.includes('Movimenta');
      }

      if (found && (texto.includes('Partes') || texto.includes('Movimenta') || texto.includes('Classe'))) {
        // Extrair dados
        const matchOrig = texto.match(/Processo\s+Origin[aá]rio[:\s]*(\S+)/i);
        const matchClasse = texto.match(/Classe[:\s]*([^\n]+)/i);
        const matchAssunto = texto.match(/Assunto[:\s]*([^\n]+)/i);

        r.cnj_processo_execucao = cnjLimpo;
        r.cnj_processo_originario = matchOrig ? matchOrig[1].trim() : '[ver detalhes]';
        r.match_status = 'VERIFICADO_TRF1';
        r.match_metodo = 'cnj_direto';
        encontrados++;

        if ((encontrados + naoEncontrados) % 10 === 0 || encontrados <= 3) {
          console.log(`  [${i+1}/${pendentes.length}] ENCONTRADO: ${cnjLimpo} | Orig: ${r.cnj_processo_originario} | R$ ${parseInt(r.Valor_RS || 0).toLocaleString()}`);
        }
      } else {
        r.match_status = 'NAO_ENCONTRADO_TRF1';
        r.match_metodo = 'cnj_direto_falhou';
        naoEncontrados++;
      }
    } catch (e) {
      r.match_status = 'ERRO_VERIFICACAO';
      r.match_metodo = e.message.slice(0, 50);
      erros++;
    }

    verificados++;
    if (verificados % 20 === 0) {
      console.log(`  Progresso: ${verificados}/${pendentes.length} | OK: ${encontrados} | N/E: ${naoEncontrados} | Erros: ${erros}`);
    }

    // Rate limit gentil
    await page.waitForTimeout(800);
  }

  await browser.close();

  // Juntar resolvidos + pendentes atualizados
  const todosResultados = [...resolvidos, ...pendentes];

  // Salvar CSV
  const campos = Object.keys(todosResultados[0]);
  const csvContent = [
    campos.join(';'),
    ...todosResultados.map(r => campos.map(c => r[c] || '').join(';'))
  ].join('\n');
  fs.writeFileSync(CSV_OUT, '\uFEFF' + csvContent, 'utf-8');

  console.log(`\n=== RESULTADO VERIFICACAO ===`);
  console.log(`Verificados: ${verificados}`);
  console.log(`Encontrados: ${encontrados}`);
  console.log(`Nao encontrados: ${naoEncontrados}`);
  console.log(`Erros: ${erros}`);
  console.log(`Total resolvidos (anterior + novos): ${resolvidos.length + encontrados}`);
  console.log(`CSV: ${CSV_OUT}`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
