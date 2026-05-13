/**
 * eproc_capturar_stealth.cjs
 * Versão com playwright-extra + puppeteer-extra-plugin-stealth.
 * O plugin aplica ~30 patches contra detecção de automação.
 * Combinado com Chrome real do sistema + perfil persistente.
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')();
chromium.use(StealthPlugin);

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const URL = process.env.URL;
const OUT_DIR = process.env.OUT_DIR;
const PREFIX = process.env.PREFIX || 'eproc_capture';
const HEADLESS = process.env.HEADLESS === 'true';
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '60000');
const PROFILE_DIR = process.env.PROFILE_DIR || path.join(require('os').homedir(), '.auraloa-eproc-profile');

if (!URL || !OUT_DIR) {
  console.error('Faltam variáveis URL e/ou OUT_DIR');
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

(async () => {
  const t0 = Date.now();
  console.log(`[stealth] URL: ${URL}`);
  console.log(`[stealth] PROFILE_DIR: ${PROFILE_DIR}`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: HEADLESS,
    slowMo: 50,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--start-maximized',
    ],
    viewport: { width: 1366, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    console.log('[stealth] Navegando...');
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.waitForTimeout(12000);

    // Tenta click programático - com stealth pode passar
    let turnstileOk = false;
    try {
      console.log('[stealth] Click programático no checkbox Turnstile...');
      const cfDiv = await page.$('.cf-turnstile');
      if (cfDiv) {
        const box = await cfDiv.boundingBox();
        if (box) {
          const tx = Math.round(box.x + 30);
          const ty = Math.round(box.y + box.height / 2);
          await page.mouse.move(50, 50);
          await page.waitForTimeout(150);
          await page.mouse.move(300, 200, { steps: 12 });
          await page.waitForTimeout(150);
          await page.mouse.move(tx, ty, { steps: 12 });
          await page.waitForTimeout(220);
          await page.mouse.click(tx, ty);
        }
      }
      await page.waitForFunction(() => window.bolCloudflareSucess === true, { timeout: 25000 });
      turnstileOk = true;
      console.log('[stealth] ✓ Turnstile validado pelo click programático!');
    } catch (e) {
      console.log(`[stealth] click programático não passou: ${e.message}`);
      console.log('');
      console.log('================================================================================');
      console.log('  Marcos: clica MANUALMENTE no checkbox no browser (3 min)');
      console.log('================================================================================');
      try {
        await page.waitForFunction(() => window.bolCloudflareSucess === true, { timeout: 180000 });
        turnstileOk = true;
        console.log('[stealth] ✓ Turnstile validado!');
      } catch (e2) {
        console.log(`[stealth] ⚠️ timeout: ${e2.message}`);
      }
    }

    if (turnstileOk) {
      console.log('[stealth] Clicando em Consultar...');
      await page.click('input#iptBtnConsultar');
      try { await page.waitForLoadState('networkidle', { timeout: TIMEOUT_MS }); } catch {}
      await page.waitForTimeout(3500);
    }

    const finalUrl = page.url();
    const html = await page.content();
    const txt = await page.evaluate(() => document.body ? document.body.innerText : '');
    const png = path.join(OUT_DIR, `${PREFIX}_screenshot.png`);
    await page.screenshot({ path: png, fullPage: true });

    fs.writeFileSync(path.join(OUT_DIR, `${PREFIX}_pagina.html`), html, 'utf-8');
    fs.writeFileSync(path.join(OUT_DIR, `${PREFIX}_texto.txt`), txt, 'utf-8');
    fs.writeFileSync(path.join(OUT_DIR, `${PREFIX}_metadata.json`), JSON.stringify({
      urlSolicitada: URL,
      urlFinal: finalUrl,
      titulo: await page.title(),
      timestampUtc: new Date().toISOString(),
      duracaoMs: Date.now() - t0,
      sha256Html: crypto.createHash('sha256').update(html).digest('hex'),
      bytesHtml: Buffer.byteLength(html, 'utf-8'),
      bytesTexto: Buffer.byteLength(txt, 'utf-8'),
      turnstileOk,
    }, null, 2));

    console.log(`[stealth] ✓ URL final: ${finalUrl}`);
    console.log(`[stealth] ✓ Título: ${await page.title()}`);
    console.log(`[stealth] ✓ HTML bytes: ${Buffer.byteLength(html, 'utf-8')} · TXT bytes: ${Buffer.byteLength(txt, 'utf-8')}`);
    console.log(`[stealth] ✓ Duração: ${Date.now() - t0}ms`);
  } catch (err) {
    console.error('[stealth] ERRO:', err.message);
    await page.screenshot({ path: path.join(OUT_DIR, `${PREFIX}_ERRO.png`), fullPage: true }).catch(() => {});
  } finally {
    await context.close();
  }
})();
