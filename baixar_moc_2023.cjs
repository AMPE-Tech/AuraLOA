// Baixa o MOC 2023 (comunicado 32616) - unico faltante.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/comunicados';
const URL = 'https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=32616&pagina=1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });
  const home = await ctx.newPage();
  await home.goto('https://www.tjsp.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await home.waitForTimeout(1500);
  await home.close();

  console.log('[*] Abrindo comunicado 32616 (MOC 2023)...');
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  const anexos = await page.$$eval('a[href*="FileFetch.ashx"]', as =>
    as.map(a => ({ href: a.href, titulo: a.title || a.textContent?.trim() || '' }))
  );
  console.log(`[*] anexos FileFetch: ${anexos.length}`);
  for (const a of anexos) console.log(`    - ${a.titulo} -> ${a.href}`);
  if (anexos.length === 0) { console.log('[!] nenhum anexo'); await browser.close(); return; }

  const pasta = path.join(SAIDA, 'comunicado_32616');
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });

  const resp = await ctx.request.get(anexos[0].href, { maxRedirects: 5, timeout: 120000 });
  const buf = await resp.body();
  const magic = buf.slice(0, 4).toString('hex');
  const isPdf = magic.startsWith('25504446');
  const dest = path.join(pasta, 'OFICIAL_MOC_2023.pdf');
  fs.writeFileSync(dest, buf);
  console.log(`[OK] baixado ${buf.length} bytes (${isPdf ? 'PDF' : 'OUTRO'}) -> ${dest}`);

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
