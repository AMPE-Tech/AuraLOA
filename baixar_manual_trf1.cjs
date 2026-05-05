const { chromium } = require('playwright');
const fs = require('fs');

const URL = 'https://www.trf1.jus.br/trf1/conteudo/files/ManualPRECATRIOeRPV.DOC';
const OUT = 'C:/Temp/auraloa-saida/manuais/ManualPRECATRIOeRPV.DOC';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  // Visit home first to get cookies
  await page.goto('https://www.trf1.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Tentativa via page.goto() — emula download direto pelo browser
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await page.goto(URL, { timeout: 60000 }).catch(e => console.log('goto erro:', e.message));
  const dl = await downloadPromise;
  let buf;
  if (dl) {
    const tmp = await dl.path();
    buf = fs.readFileSync(tmp);
    console.log('via download:', buf.length, 'bytes');
  } else {
    // Não disparou download — talvez renderizou inline
    const content = await page.content();
    buf = Buffer.from(content);
    console.log('via content:', buf.length, 'bytes (HTML?)');
  }
  fs.writeFileSync(OUT, buf);
  console.log('saved:', OUT);

  // Quick magic-byte check
  const magic = buf.slice(0, 8).toString('hex');
  console.log('magic:', magic);
  // .doc binary starts with d0cf11e0 (OLE2 compound). HTML starts with 3c21444f...
  if (magic.startsWith('d0cf11e0')) console.log('=> binary .doc OK');
  else if (magic.startsWith('504b0304')) console.log('=> .docx (zip)');
  else if (buf.slice(0,6).toString().toLowerCase().includes('<!doc') || buf.slice(0,6).toString().toLowerCase().includes('<html')) console.log('=> HTML (block?)');
  else console.log('=> unknown format');

  await browser.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
