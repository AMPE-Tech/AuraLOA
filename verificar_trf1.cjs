const { chromium } = require('playwright');

const CNJ = '1363102-52.2025.4.01.0000';
const URL = 'https://pje2g.trf1.jus.br/pje/ConsultaPublica/listView.seam';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log(`[trf1] Abrindo ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  console.log(`[trf1] CNJ alvo: ${CNJ}`);

  const campo = page.locator('input[id*="NumeroProcesso"]').first();
  await campo.waitFor({ timeout: 15000 });
  await campo.fill(CNJ);
  await page.waitForTimeout(500);

  await page.locator('input[value="Pesquisar"], button:has-text("Pesquisar")').first().click();
  await page.waitForTimeout(6000);

  await page.screenshot({ path: 'C:/Temp/trf1_resultado.png', fullPage: true });
  console.log('[trf1] Screenshot: C:/Temp/trf1_resultado.png');

  const texto = await page.locator('body').innerText();
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log('\n=== Todas as linhas ===');
  linhas.slice(0, 80).forEach(l => console.log('  ', l));

  console.log('\n[trf1] Aguardando 25s para visualizar...');
  await page.waitForTimeout(25000);

  await browser.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
