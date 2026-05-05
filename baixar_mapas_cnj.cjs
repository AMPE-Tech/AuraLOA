// MANTRA: baixar mapas CNJ 2024+2025 do TRF1, verificar tamanho e linhas ANTES de analisar
const { chromium } = require('playwright');
const fs = require('fs');

const MAPAS = [
  { nome: 'Mapa CNJ 2025 Federais',       url: 'https://www.trf1.jus.br/trf1/conteudo/Mapa%20anual%20CNJ%202025%20-%20situa%C3%A7%C3%A3o%20d%C3%ADvida%202025%20-%20Federais.htm' },
  { nome: 'Mapa CNJ 2024 Federal',         url: 'https://www.trf1.jus.br/trf1/conteudo/Mapa%20CNJ%202024%20-%20Federal%20-%20publica%C3%A7%C3%A3o.htm' },
  { nome: 'Mapa CNJ 2025 Subnacionais',    url: 'https://www.trf1.jus.br/trf1/conteudo/Mapa%20anual%20CNJ%202025%20-%20situa%C3%A7%C3%A3o%20d%C3%ADvida%202025%20-%20Subnacionais.htm' },
  { nome: 'Mapa CNJ 2024 Estadual',        url: 'https://www.trf1.jus.br/trf1/conteudo/Mapa%20CNJ%202024%20-%20Estadual%20-%20publica%C3%A7%C3%A3o.htm' },
];

const OUT_DIR = 'C:/Temp/auraloa-saida/manuais/mapas_cnj/';

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  // Visit home first for cookies
  await page.goto('https://www.trf1.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  for (const m of MAPAS) {
    console.log(`\n========== ${m.nome} ==========`);
    console.log(`URL: ${m.url}`);
    try {
      const resp = await page.goto(m.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
      const status = resp?.status() || '?';
      console.log(`  status: ${status}`);
      console.log(`  URL final: ${page.url()}`);

      const html = await page.content();
      const filename = m.nome.replace(/[^a-zA-Z0-9]/g, '_') + '.htm';
      const filepath = OUT_DIR + filename;
      fs.writeFileSync(filepath, html, 'utf-8');

      const linhas = html.split('\n').length;
      const bytes = Buffer.byteLength(html, 'utf-8');
      const isWAF = html.includes('Human Verification') || html.includes('challenge.js') || html.includes('awswaf');

      console.log(`  bytes: ${bytes.toLocaleString()}`);
      console.log(`  linhas: ${linhas.toLocaleString()}`);
      console.log(`  WAF block: ${isWAF ? 'SIM ❌' : 'NÃO ✅'}`);
      console.log(`  salvo: ${filepath}`);

      if (!isWAF) {
        // Contar tabelas e TRs
        const trs = (html.match(/<tr/gi) || []).length;
        const tds = (html.match(/<td/gi) || []).length;
        console.log(`  <tr>: ${trs} | <td>: ${tds}`);

        // Primeiras 10 linhas de texto para inspeção
        const texto = await page.locator('body').innerText();
        const preview = texto.split('\n').filter(l => l.trim()).slice(0, 15);
        console.log(`  Preview (15 primeiras linhas de texto):`);
        preview.forEach((l, i) => console.log(`    ${i+1}. ${l.slice(0, 120)}`));
      }
    } catch (e) {
      console.log(`  ERRO: ${e.message.slice(0, 150)}`);
    }
  }

  await browser.close();
  console.log('\nConcluído.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
