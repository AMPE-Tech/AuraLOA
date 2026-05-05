const { chromium } = require('playwright');

const NUMERO = '1363102520254010000'; // #1 LOA — R$ 1.044.686.858
const URL = `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${NUMERO}&secao=TRF1&pg=1&enviar=Pesquisar`;

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log(`[trf1] Abrindo: ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  console.log(`[trf1] Título: ${await page.title()}`);
  console.log(`[trf1] URL final: ${page.url()}`);

  const texto = await page.locator('body').innerText();
  console.log('\n=== CONTEÚDO ===');
  console.log(texto.slice(0, 3000));

  await page.screenshot({ path: 'C:/Temp/trf1_processo.png', fullPage: true });
  console.log('\n[trf1] Screenshot: C:/Temp/trf1_processo.png');

  console.log('\n[trf1] Aguardando 40s...');
  await page.waitForTimeout(40000);
  await browser.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
