// MANTRA: verificar HEAD (tamanho, content-type) antes de baixar
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ALVOS = [
  {
    nome: 'Resolução CJF 822/2023 (fonte TRF1)',
    url: 'https://www.trf1.jus.br/trf1/conteudo/files/Res822-2023.pdf',
    saida: 'Res822-2023_TRF1.pdf',
  },
  {
    nome: 'Resolução CJF 822/2023 (fonte CJF)',
    url: 'https://www.cjf.jus.br/publico/biblioteca/Res%20822-2023.pdf',
    saida: 'Res822-2023_CJF.pdf',
  },
  {
    nome: 'Mapa anual CNJ 2025 - Federais (situação dívida)',
    url: 'https://www.trf1.jus.br/trf1/conteudo/Mapa%20anual%20CNJ%202025%20-%20situa%C3%A7%C3%A3o%20d%C3%ADvida%202025%20-%20Federais.htm',
    saida: 'Mapa_CNJ_2025_Federais.htm',
  },
  {
    nome: 'Mapa CNJ 2024 - Federal',
    url: 'https://www.trf1.jus.br/trf1/conteudo/Mapa%20CNJ%202024%20-%20Federal%20-%20publica%C3%A7%C3%A3o.htm',
    saida: 'Mapa_CNJ_2024_Federal.htm',
  },
  {
    nome: 'Portaria PRESI 8886381 (Certidão Eletrônica Negativa)',
    url: 'https://www.trf1.jus.br/trf1/conteudo/files/PORTARIAPRESI8886381CertidoEletrnicaNegativadePrecatriosJudiciais.pdf',
    saida: 'PortariaPRESI8886381.pdf',
  },
];

const PASTA = 'C:/Temp/auraloa-saida/manuais';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  // Aquece cookies WAF visitando a home
  console.log('[*] Aquecendo sessão na home TRF1...');
  await page.goto('https://www.trf1.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
  await page.waitForTimeout(3000);
  await page.goto('https://www.cjf.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
  await page.waitForTimeout(2000);

  console.log('\n========== HEAD CHECK (antes de baixar) ==========');
  const resultados = [];
  for (const alvo of ALVOS) {
    try {
      // Primeiro HEAD
      const head = await ctx.request.fetch(alvo.url, { method: 'HEAD', maxRedirects: 5 });
      const ct = head.headers()['content-type'] || '?';
      const cl = head.headers()['content-length'] || '?';
      console.log(`\n[${alvo.nome}]`);
      console.log(`  URL: ${alvo.url}`);
      console.log(`  HEAD status: ${head.status()}`);
      console.log(`  content-type: ${ct}`);
      console.log(`  content-length: ${cl} bytes`);
      resultados.push({ alvo, head_status: head.status(), ct, cl });
    } catch (e) {
      console.log(`\n[${alvo.nome}] HEAD erro: ${e.message.slice(0, 120)}`);
      resultados.push({ alvo, head_status: 'erro', erro: e.message });
    }
  }

  console.log('\n========== DOWNLOAD ==========');
  if (!fs.existsSync(PASTA)) fs.mkdirSync(PASTA, { recursive: true });

  for (const alvo of ALVOS) {
    try {
      const resp = await ctx.request.get(alvo.url, { maxRedirects: 5 });
      const buf = await resp.body();
      const out = path.join(PASTA, alvo.saida);
      fs.writeFileSync(out, buf);
      const magic = buf.slice(0, 4).toString('hex');
      const isPdf = magic === '25504446';
      const isHtml = buf.slice(0, 20).toString().toLowerCase().includes('<!doc') || buf.slice(0, 20).toString().toLowerCase().includes('<html');
      const tipo = isPdf ? 'PDF ✓' : isHtml ? 'HTML' : 'outro';
      console.log(`\n[${alvo.nome}]`);
      console.log(`  GET status: ${resp.status()}`);
      console.log(`  bytes: ${buf.length}`);
      console.log(`  magic: ${magic} (${tipo})`);
      console.log(`  salvo: ${out}`);
    } catch (e) {
      console.log(`\n[${alvo.nome}] GET erro: ${e.message.slice(0, 200)}`);
    }
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
