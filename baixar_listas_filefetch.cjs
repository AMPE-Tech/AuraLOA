// Baixa as 3 listas FileFetch descobertas (UNICAMP, IPREVEN, INSS)
// Valida magic bytes e tamanho.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda/listas_filefetch';

const ALVOS = [
  { nome: 'UNICAMP', codigo: 53296 },
  { nome: 'IPREVEN', codigo: 61711 },
  { nome: 'INSS', codigo: 31059 },
];

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });
  const home = await ctx.newPage();
  await home.goto('https://www.tjsp.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await home.waitForTimeout(1500);
  await home.close();

  for (const a of ALVOS) {
    const url = `https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=${a.codigo}`;
    console.log(`\n[*] ${a.nome} codigo=${a.codigo}`);
    try {
      const head = await ctx.request.fetch(url, { method: 'HEAD', maxRedirects: 5 });
      console.log(`  HEAD status=${head.status()} content-type=${head.headers()['content-type']} content-length=${head.headers()['content-length']}`);
    } catch (e) {
      console.log(`  HEAD erro: ${e.message.slice(0, 100)}`);
    }
    try {
      const r = await ctx.request.get(url, { maxRedirects: 5, timeout: 120000 });
      const buf = await r.body();
      const magic = buf.slice(0, 4).toString('hex');
      const ct = r.headers()['content-type'] || '';
      const cd = r.headers()['content-disposition'] || '';
      const nomeMatch = cd.match(/filename\*?=["']?(?:UTF-8''|)([^"'\r\n;]+)/i);
      const nomeOrig = nomeMatch ? decodeURIComponent(nomeMatch[1]) : null;

      const isPdf = magic.startsWith('25504446');
      const isZip = magic.startsWith('504b0304');
      const isOffice97 = magic.startsWith('d0cf11e0');
      const textSample = buf.slice(0, 500).toString('latin1');
      const isHtml = /<!doc|<html/i.test(textSample);
      const tipo = isPdf ? 'PDF' : isZip ? 'ZIP/XLSX' : isOffice97 ? 'XLS legado' : isHtml ? 'HTML' : `OUTRO(${magic})`;

      const ext = isPdf ? 'pdf' : isZip ? 'xlsx' : isOffice97 ? 'xls' : isHtml ? 'html' : 'bin';
      const destino = path.join(SAIDA, `lista_${a.nome}_${a.codigo}.${ext}`);
      fs.writeFileSync(destino, buf);

      console.log(`  GET status=${r.status()}  bytes=${buf.length}  tipo=${tipo}`);
      console.log(`  content-type=${ct.slice(0, 60)}`);
      console.log(`  filename_sugerido=${nomeOrig || 'n/a'}`);
      console.log(`  salvo: ${destino}`);
      console.log(`  amostra texto: ${textSample.slice(0, 120).replace(/[\r\n]/g, ' ')}`);
    } catch (e) {
      console.log(`  GET erro: ${e.message.slice(0, 200)}`);
    }
  }

  await browser.close();
  console.log(`\n[OK] em ${SAIDA}`);
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
