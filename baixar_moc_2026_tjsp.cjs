// Baixa o MOC (Mapa Orcamentario de Credores) 2026 do TJSP e valida.
// Source: Comunicado 53210 -> link UrlExternaTJSP -> FileFetch.ashx?codigo=168780
// MANTRA: HEAD antes, magic bytes, NAO parsear ate Marcos validar.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/comunicados/comunicado_53210';
const URL_MOC = 'https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=168780';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  console.log('[*] Aquecendo home TJSP...');
  const home = await ctx.newPage();
  await home
    .goto('https://www.tjsp.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    .catch(() => {});
  await home.waitForTimeout(2000);
  await home.close();

  console.log('\n[*] HEAD check:');
  try {
    const head = await ctx.request.fetch(URL_MOC, { method: 'HEAD', maxRedirects: 5 });
    console.log(`  status: ${head.status()}`);
    console.log(`  content-type: ${head.headers()['content-type']}`);
    console.log(`  content-length: ${head.headers()['content-length']}`);
    console.log(`  content-disposition: ${head.headers()['content-disposition'] || 'n/a'}`);
  } catch (e) {
    console.log(`  HEAD erro: ${e.message.slice(0, 200)}`);
  }

  console.log('\n[*] GET:');
  const resp = await ctx.request.get(URL_MOC, { maxRedirects: 5 });
  const buf = await resp.body();
  const magic = buf.slice(0, 8).toString('hex');
  const isPdf = magic.startsWith('25504446');
  const isZip = magic.startsWith('504b0304');
  const isXls = magic.startsWith('d0cf11e0'); // .xls antigo
  const textSample = buf.slice(0, 200).toString('latin1');
  const isHtml = /<!doc|<html/i.test(textSample);

  console.log(`  status: ${resp.status()}`);
  console.log(`  bytes: ${buf.length}`);
  console.log(`  magic: ${magic}`);
  console.log(
    `  tipo: ${isPdf ? 'PDF' : isZip ? 'ZIP (xlsx/docx/ods/zip)' : isXls ? 'XLS legado' : isHtml ? 'HTML' : 'desconhecido'}`
  );
  console.log(
    `  content-disposition: ${resp.headers()['content-disposition'] || 'n/a'}`
  );
  console.log(`  amostra: ${textSample.slice(0, 80).replace(/[\r\n]/g, ' ')}`);

  const cd = resp.headers()['content-disposition'] || '';
  const nomeMatch = cd.match(/filename\*?=["']?(?:UTF-8''|)([^"'\r\n;]+)/i);
  let filename = nomeMatch ? decodeURIComponent(nomeMatch[1]) : null;
  if (!filename) {
    filename = isPdf ? 'MOC_2026.pdf' : isZip ? 'MOC_2026.zip' : isHtml ? 'MOC_2026.html' : 'MOC_2026.bin';
  }
  const destino = path.join(BASE, `OFICIAL_${filename}`);
  fs.writeFileSync(destino, buf);
  console.log(`\n[OK] Salvo: ${destino}`);

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
