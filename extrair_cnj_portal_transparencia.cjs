/**
 * Extrai numProcessoUnico (CNJ) do Portal da Transparência
 * URL: https://portaltransparencia.gov.br/precatorios
 * Caminho descoberto por Marcos em 12/04/2026
 *
 * Uso: node extrair_cnj_portal_transparencia.cjs --numero=4574394720244010000
 */
const { chromium } = require('playwright');
const fs = require('fs');

const args = process.argv.slice(2);
const getArg = (n) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null; };

const NUMERO = getArg('numero') || '4574394720244010000';
const URL = 'https://portaltransparencia.gov.br/precatorios';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log(`[1] Abrindo ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  console.log(`[2] Titulo: ${await page.title()}`);
  console.log(`    URL: ${page.url()}`);

  // Screenshot da tela inicial
  await page.screenshot({ path: 'C:/Temp/auraloa-saida/portal_transparencia/portal_precatorios_home.png', fullPage: true });

  // Listar campos de busca
  const inputs = await page.locator('input:visible, select:visible').all();
  console.log(`\n[3] Campos de busca visiveis: ${inputs.length}`);
  for (let i = 0; i < inputs.length; i++) {
    try {
      const info = await inputs[i].evaluate(el => ({
        tag: el.tagName, type: el.type, name: el.name, id: el.id,
        placeholder: el.placeholder, maxLength: el.maxLength
      }));
      console.log(`    ${i+1}. <${info.tag}> type=${info.type} name=${info.name} id=${info.id} placeholder="${info.placeholder}"`);
    } catch(e) {}
  }

  // Texto visivel
  const texto = await page.locator('body').innerText();
  console.log(`\n[4] Texto (primeiros 2000 chars):`);
  console.log(texto.slice(0, 2000));

  // Tentar buscar pelo numero
  console.log(`\n[5] Buscando numero: ${NUMERO}`);
  const campoBusca = page.locator('input[type="text"]:visible, input[type="search"]:visible').first();
  try {
    await campoBusca.waitFor({ timeout: 5000 });
    await campoBusca.fill(NUMERO);
    await page.waitForTimeout(500);

    // Botao de pesquisa
    const btn = page.locator('button:has-text("Pesquisar"), button:has-text("Buscar"), input[type="submit"]').first();
    await btn.click();
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'C:/Temp/auraloa-saida/portal_transparencia/portal_precatorios_resultado.png', fullPage: true });

    const resultado = await page.locator('body').innerText();
    console.log(`\n[6] Resultado (primeiros 3000 chars):`);
    console.log(resultado.slice(0, 3000));

    // Buscar numProcessoUnico no texto
    const matchCNJ = resultado.match(/numProcessoUnico[:\s]*([^\n,]+)/i) ||
                     resultado.match(/processo[^:]*[:\s]*(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i) ||
                     resultado.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    if (matchCNJ) {
      console.log(`\n>>> CNJ ENCONTRADO: ${matchCNJ[1]}`);
    }
  } catch(e) {
    console.log(`    Erro busca: ${e.message.slice(0, 100)}`);
  }

  console.log('\n[*] Aguardando 60s para inspecao...');
  await page.waitForTimeout(60000);
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
