// MANTRA: buscar por CNPJ no TRF1 (opção 3 das 8 literais)
// Teste: INCRA — CNPJ 00375972000160 — precatório #41 LOA (R$ 130.604.993)
const { chromium } = require('playwright');

const CNPJ = '00375972000160'; // INCRA
const URL = 'https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log('[1] Abrindo consulta por CPF/CNPJ');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  console.log('  título:', await page.title());

  // Listar campos literais
  const inputs = await page.locator('input:visible, select:visible').all();
  console.log('\n  Campos:');
  for (let i = 0; i < inputs.length; i++) {
    const info = await inputs[i].evaluate(el => ({
      tag: el.tagName, type: el.type, name: el.name, id: el.id, maxLength: el.maxLength
    }));
    console.log(`    ${i+1}. <${info.tag}> type=${info.type} name=${info.name} id=${info.id} maxlen=${info.maxLength}`);
  }

  // Preencher CNPJ
  console.log(`\n[2] Preenchendo CNPJ: ${CNPJ}`);
  const campo = page.locator('input[type="text"]:visible').first();
  await campo.fill(CNPJ);
  await page.waitForTimeout(500);

  // Submeter
  const btn = page.locator('input[type="submit"]:visible').first();
  await btn.click();
  console.log('  submetido');
  await page.waitForTimeout(5000);

  await page.screenshot({ path: 'C:/Temp/trf1_cnpj_incra.png', fullPage: true });

  // Resultado bruto
  const texto = await page.locator('body').innerText();
  console.log('\n[3] RESULTADO BRUTO (primeiros 3000 chars):');
  console.log(texto.slice(0, 3000));

  // Contar processos encontrados
  const matchProc = texto.match(/(\d+)\s+processo/i);
  if (matchProc) console.log(`\n  => Processos encontrados: ${matchProc[1]}`);

  console.log('\n[*] Aguardando 60s para inspeção...');
  await page.waitForTimeout(60000);
  await browser.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
