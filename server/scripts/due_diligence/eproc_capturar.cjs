/**
 * eproc_capturar.cjs
 * Captura programática de um documento público no eproc (qualquer Seção JF).
 * Lida com Cloudflare Turnstile via Playwright stealth (Chromium visível).
 *
 * Uso:
 *   URL="https://eproc.jfrj.jus.br/eproc/externo_controlador.php?acao=consulta_publica_documento&numProcesso=...&idDocumento=...&hash=..." \
 *   OUT_DIR="C:/.../processo_01_eproc" \
 *   PREFIX="evento_01_acordao" \
 *   node eproc_capturar.cjs
 *
 * Saída:
 *   <OUT_DIR>/<PREFIX>_pagina.html       — HTML do documento renderizado
 *   <OUT_DIR>/<PREFIX>_texto.txt          — texto extraído (innerText do body)
 *   <OUT_DIR>/<PREFIX>_screenshot.png     — screenshot full-page
 *   <OUT_DIR>/<PREFIX>_metadata.json      — URL final, status, sha256, cookies
 *
 * Não baixa o PDF binário do documento (o eproc serve via PDF.js dentro do iframe).
 */
const { chromium } = require('playwright');
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
  console.log(`[eproc] URL: ${URL}`);
  console.log(`[eproc] OUT_DIR: ${OUT_DIR}`);
  console.log(`[eproc] PREFIX: ${PREFIX}`);
  console.log(`[eproc] PROFILE_DIR: ${PROFILE_DIR}`);

  // Persistent context: usa perfil do Chrome real do sistema com cookies persistentes
  // Cookie cf_clearance do Cloudflare dura ~30min — depois disso precisa novo click
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome', // usa Chrome real do sistema, não Chromium baixado
    headless: HEADLESS,
    slowMo: 60,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--start-maximized',
      '--disable-extensions-except',
      '--disable-gpu',
    ],
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US'] });
  });

  const browser = context.browser();
  const page = context.pages()[0] || await context.newPage();

  try {
    console.log('[eproc] Navegando para a URL...');
    const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    console.log(`[eproc] Status inicial: ${resp ? resp.status() : 'null'}`);
    console.log(`[eproc] URL após DOMContentLoaded: ${page.url()}`);

    // Espera o Cloudflare Turnstile carregar e habilitar o checkbox (~10s)
    console.log('[eproc] Aguardando 10s para Cloudflare Turnstile habilitar...');
    await page.waitForTimeout(10500);

    // Cloudflare Turnstile com perfil persistente:
    // - Primeira vez: Marcos clica e Cloudflare emite cookie cf_clearance (~30min válido)
    // - Próximas vezes: cookie ainda vivo → Turnstile NEM aparece, script roda full auto
    let turnstileOk = false;

    // Detecta se Turnstile sumiu sozinho (cookie já valida) ou se já foi validado
    await page.waitForTimeout(2000);
    const turnstileExiste = await page.$('.cf-turnstile');
    const jaValidado = await page.evaluate(() => window.bolCloudflareSucess === true);

    if (jaValidado || !turnstileExiste) {
      console.log('[eproc] ✓ Turnstile já validado (cookie cf_clearance ativo) — pulando click');
      turnstileOk = true;
    } else {
      console.log('');
      console.log('================================================================================');
      console.log('  COOKIE Cloudflare expirou ou primeira execução · AÇÃO HUMANA UMA VEZ:');
      console.log('  → No browser aberto, clica no checkbox "Confirme que é humano"');
      console.log('  → Próximas execuções nos próximos ~30min NÃO vão precisar de click');
      console.log('  → Tempo limite: 3 minutos');
      console.log('================================================================================');
      console.log('');

      try {
        await page.waitForFunction(() => window.bolCloudflareSucess === true, { timeout: 180000 });
        turnstileOk = true;
        console.log('[eproc] ✓ Turnstile validado · cookie cf_clearance salvo no perfil persistente');
      } catch (e) {
        console.log(`[eproc] ⚠️ Turnstile não validado em 3 minutos: ${e.message}`);
      }
    }

    // Click no botão Consultar (botão normal — Playwright click funciona)
    if (turnstileOk) {
      const submitBtn = await page.$('input#iptBtnConsultar');
      if (submitBtn) {
        console.log('[eproc] Clicando em Consultar...');
        await submitBtn.click();
        try {
          await page.waitForLoadState('networkidle', { timeout: TIMEOUT_MS });
        } catch (e) {
          console.log('[eproc] networkidle timeout — prosseguindo.');
        }
        await page.waitForTimeout(4000);
        console.log(`[eproc] URL após Consultar: ${page.url()}`);
      }
    }

    // Capturar
    const finalUrl = page.url();
    const html = await page.content();
    const txt = await page.evaluate(() => document.body ? document.body.innerText : '');
    const png = path.join(OUT_DIR, `${PREFIX}_screenshot.png`);
    await page.screenshot({ path: png, fullPage: true });

    const htmlPath = path.join(OUT_DIR, `${PREFIX}_pagina.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    const txtPath = path.join(OUT_DIR, `${PREFIX}_texto.txt`);
    fs.writeFileSync(txtPath, txt, 'utf-8');

    const cookies = await context.cookies();
    const metadata = {
      urlSolicitada: URL,
      urlFinal: finalUrl,
      tituloPagina: await page.title(),
      timestampUtc: new Date().toISOString(),
      duracaoMs: Date.now() - t0,
      sha256Html: crypto.createHash('sha256').update(html).digest('hex'),
      sha256Texto: crypto.createHash('sha256').update(txt).digest('hex'),
      bytesHtml: Buffer.byteLength(html, 'utf-8'),
      bytesTexto: Buffer.byteLength(txt, 'utf-8'),
      cookies: cookies.map(c => ({ name: c.name, domain: c.domain })),
    };
    const metaPath = path.join(OUT_DIR, `${PREFIX}_metadata.json`);
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

    console.log(`[eproc] ✓ HTML: ${htmlPath} (${metadata.bytesHtml} bytes)`);
    console.log(`[eproc] ✓ TXT:  ${txtPath} (${metadata.bytesTexto} bytes)`);
    console.log(`[eproc] ✓ PNG:  ${png}`);
    console.log(`[eproc] ✓ META: ${metaPath}`);
    console.log(`[eproc] URL final: ${finalUrl}`);
    console.log(`[eproc] Título: ${metadata.tituloPagina}`);
    console.log(`[eproc] Duração: ${metadata.duracaoMs}ms`);
  } catch (err) {
    console.error('[eproc] ERRO:', err.message);
    const errPng = path.join(OUT_DIR, `${PREFIX}_ERRO.png`);
    await page.screenshot({ path: errPng, fullPage: true }).catch(() => {});
    console.error(`[eproc] Screenshot do erro: ${errPng}`);
    process.exit(2);
  } finally {
    await context.close();
  }
})();
