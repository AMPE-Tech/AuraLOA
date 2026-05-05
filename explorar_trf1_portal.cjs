// MANTRA: explorar — não inferir. Apenas mostrar campos literais.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 1. Portal oficial
  console.log('[1] Abrindo www.trf1.jus.br');
  await page.goto('https://www.trf1.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log('  título:', await page.title());
  console.log('  URL final:', page.url());
  await page.screenshot({ path: 'C:/Temp/trf1_01_home.png', fullPage: true });

  // 2. Tentar achar link "Processual" → "RPV e Precatório"
  const links = await page.locator('a').all();
  const candidatos = [];
  for (const l of links.slice(0, 200)) {
    try {
      const t = (await l.innerText({ timeout: 500 })).trim();
      const h = await l.getAttribute('href');
      if (t && (t.toLowerCase().includes('precat') || t.toLowerCase().includes('rpv') || t.toLowerCase().includes('processual'))) {
        candidatos.push({ texto: t.slice(0, 60), href: h });
      }
    } catch (e) {}
  }
  console.log('\n[2] Links candidatos (Processual / RPV / Precatório):');
  candidatos.slice(0, 30).forEach((c, i) => console.log(`  ${i+1}. "${c.texto}" → ${c.href}`));

  console.log('\n[*] Aguardando 60s — observe e me diga qual link clicar.');
  await page.waitForTimeout(60000);
  await browser.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
