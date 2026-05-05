// Explora portal TRF1 de precatórios
const { chromium } = require('playwright');

const NUMERO_LOA = '1363102520254010000'; // #1 — R$ 1.044.686.858 FUNDEF

const URLS = [
  'https://precatorios.trf1.jus.br/',
  'https://portal.trf1.jus.br/portaltrf1/pagina-inicial.htm',
  'https://www.trf1.jus.br/sjmg/sjmg-precatorios',
];

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  for (const url of URLS) {
    try {
      console.log(`\n[trf1] Tentando: ${url}`);
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log(`  status: ${resp?.status()}`);
      console.log(`  URL final: ${page.url()}`);
      console.log(`  título: ${await page.title()}`);
      await page.waitForTimeout(1500);
      const txt = (await page.locator('body').innerText()).slice(0, 500);
      console.log(`  preview: ${txt.replace(/\s+/g, ' ').slice(0, 300)}`);
    } catch (e) {
      console.log(`  ERRO: ${e.message.slice(0, 150)}`);
    }
  }

  console.log('\n[trf1] Aguardando 30s para inspeção manual...');
  await page.waitForTimeout(30000);
  await browser.close();
})().catch(e => { console.error('ERRO FATAL:', e.message); process.exit(1); });
