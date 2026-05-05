// Inspeciona estrutura HTML de uma Portaria (cod 59851) para achar como acessar o conteudo
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });
  const page = await ctx.newPage();

  const url = 'https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=59851&pagina=1';
  console.log(`[*] Abrindo: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Salva HTML completo
  const html = await page.content();
  fs.writeFileSync('C:/Temp/portaria_59851.html', html, 'utf-8');
  console.log(`[*] HTML salvo: C:/Temp/portaria_59851.html (${html.length} bytes)`);

  // Texto completo
  const texto = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync('C:/Temp/portaria_59851_texto.txt', texto, 'utf-8');
  console.log(`[*] Texto: ${texto.length} chars`);
  console.log('\n=== PRIMEIRAS 2000 CHARS ===');
  console.log(texto.slice(0, 2000));

  // Todos os links
  const links = await page.$$eval('a', as =>
    as.map(a => ({ href: a.href, texto: (a.textContent || '').trim().slice(0, 80) }))
      .filter(l => l.href && !l.href.startsWith('javascript:') && !l.href.startsWith('mailto:'))
  );
  console.log(`\n=== LINKS NA PAGINA (${links.length}) ===`);
  const uniq = new Map();
  for (const l of links) if (!uniq.has(l.href)) uniq.set(l.href, l);
  for (const l of uniq.values()) console.log(`  ${l.href.slice(0, 120)} | ${l.texto}`);

  // Iframes (GeneXus frequentemente usa iframes)
  const iframes = await page.$$eval('iframe', ifs => ifs.map(i => ({ src: i.src, id: i.id, name: i.name })));
  console.log(`\n=== IFRAMES (${iframes.length}) ===`);
  for (const i of iframes) console.log(`  src=${i.src} id=${i.id}`);

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
