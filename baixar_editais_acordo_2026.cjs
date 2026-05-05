// Baixa TODOS os editais de acordo recentes (tipoDestino=3345) - abril/2026
// Sem captcha. PDFs oficiais TJSP.
// Saida: ArquivosLOA/camada2/tjsp/editais_acordo/

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/editais_acordo';
const URL_INDICE = 'https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=3345';

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });
  const page = await ctx.newPage();

  console.log(`[*] Abrindo indice: ${URL_INDICE}`);
  await page.goto(URL_INDICE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  // Listar todos os codigos de comunicado
  const comunicados = await page.evaluate(() => {
    const out = [];
    const links = Array.from(document.querySelectorAll('a[href*="codigoComunicado="]'));
    for (const a of links) {
      const m = a.href.match(/codigoComunicado=(\d+)/);
      if (!m) continue;
      let dataText = null;
      let parent = a;
      for (let i = 0; i < 6 && parent; i++) {
        const t = (parent.textContent || '');
        const dm = t.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dm) { dataText = dm[1]; break; }
        parent = parent.parentElement;
      }
      out.push({ codigo: m[1], titulo: (a.textContent || '').trim(), data: dataText });
    }
    return out;
  });

  const uniq = new Map();
  for (const c of comunicados) if (!uniq.has(c.codigo)) uniq.set(c.codigo, c);
  const lista = Array.from(uniq.values()).filter(c => c.data && c.data.slice(-4) >= '2022');

  console.log(`[*] Comunicados recentes (>=2022): ${lista.length}`);
  for (const c of lista) console.log(`    [${c.codigo}] ${c.data} - ${c.titulo.slice(0, 80)}`);

  const relatorio = { gerado_em: new Date().toISOString(), editais: [] };

  // Para cada comunicado, abrir e baixar FileFetch.ashx (anexo oficial)
  for (const c of lista) {
    const url = `https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=${c.codigo}&pagina=1`;
    console.log(`\n=== Edital ${c.codigo} - ${c.titulo.slice(0, 60)} ===`);
    const pg = await ctx.newPage();
    const out = { codigo: c.codigo, titulo: c.titulo, data: c.data, anexos: [] };
    try {
      await pg.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await pg.waitForTimeout(2000);

      // Captura texto do comunicado (tem metadados)
      const texto = await pg.evaluate(() => (document.body.innerText || '').trim());
      const txtPath = path.join(SAIDA, `edital_${c.codigo}_texto.txt`);
      fs.writeFileSync(txtPath, texto, 'utf-8');
      out.texto_path = txtPath;
      out.primeiras_linhas = texto.split('\n').filter(l => l.trim()).slice(0, 5);

      // Lista os FileFetch reais (nao footer)
      const anexos = await pg.$$eval('a[href*="FileFetch.ashx"]', as =>
        as.map(a => ({ href: a.href, titulo: (a.title || a.textContent || '').trim() }))
      );
      console.log(`  anexos FileFetch: ${anexos.length}`);

      for (const [i, a] of anexos.entries()) {
        const r = await ctx.request.get(a.href, { maxRedirects: 5, timeout: 120000 });
        const buf = await r.body();
        const magic = buf.slice(0, 4).toString('hex');
        const isPdf = magic.startsWith('25504446');
        if (!isPdf) { console.log(`    [${i}] nao-PDF, skip (${magic})`); continue; }

        const slug = (a.titulo || 'anexo').replace(/[^a-z0-9]+/gi, '_').slice(0, 50);
        const dest = path.join(SAIDA, `edital_${c.codigo}_${i}_${slug}.pdf`);
        fs.writeFileSync(dest, buf);
        console.log(`    [${i}] ${buf.length} bytes -> ${path.basename(dest)}`);
        out.anexos.push({ titulo: a.titulo, href: a.href, bytes: buf.length, arquivo: dest });
      }
    } catch (e) {
      out.erro = e.message?.slice(0, 200);
      console.log(`  ERRO: ${out.erro}`);
    } finally {
      await pg.close();
    }
    relatorio.editais.push(out);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(SAIDA, `_relatorio_${ts}.json`), JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\n[OK] ${relatorio.editais.length} editais processados. Saida: ${SAIDA}`);
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
