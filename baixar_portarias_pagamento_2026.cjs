// Baixa as Portarias de Listas de Pagamento TJSP (tipoDestino=87) recentes 2024-2026

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/listas_pagamento';

// Top 10 recentes do td=87
const CODIGOS = [
  { cod: 59851, data: '06/02/2026', portaria: '10.778/2026' },
  { cod: 59850, data: '06/02/2026', portaria: '10.779/2026' },
  { cod: 59849, data: '06/02/2026', portaria: '10.725/2026' },
  { cod: 59848, data: '06/02/2026', portaria: '10.724/2026' },
  { cod: 59847, data: '06/02/2026', portaria: '10.728/2026' },
  { cod: 57174, data: '29/10/2025', portaria: '10.667/2025' },
  { cod: 50862, data: '10/03/2025', portaria: '10.566/2025' },
  { cod: 50863, data: '16/12/2024', portaria: '10.521/2024' },
  { cod: 43681, data: '29/04/2024', portaria: '10.437/2024' },
  { cod: 43591, data: '25/04/2024', portaria: '10.435/2024' },
];

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const relatorio = { gerado_em: new Date().toISOString(), portarias: [] };

  for (const p of CODIGOS) {
    const url = `https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=${p.cod}&pagina=1`;
    console.log(`\n=== Portaria ${p.portaria} (${p.data}) - cod ${p.cod} ===`);
    const pg = await ctx.newPage();
    const out = { ...p };
    try {
      await pg.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await pg.waitForTimeout(2500);

      // Captura texto do comunicado
      const bloco = await pg.evaluate(() => {
        const container = document.querySelector('h3, h2, h1')?.closest('div') || document.body;
        return {
          texto: (container.innerText || '').slice(0, 3000),
        };
      });
      out.texto_inicio = bloco.texto.slice(0, 600);

      // Lista FileFetch reais
      const anexos = await pg.$$eval('a[href*="FileFetch.ashx"]', as =>
        as.map(a => ({ href: a.href, titulo: (a.title || a.textContent || '').trim() }))
      );
      console.log(`  anexos FileFetch na pagina: ${anexos.length}`);
      out.anexos = [];

      for (const [i, a] of anexos.entries()) {
        try {
          const r = await ctx.request.get(a.href, { maxRedirects: 5, timeout: 120000 });
          const buf = await r.body();
          const magic = buf.slice(0, 4).toString('hex');
          const isPdf = magic.startsWith('25504446');
          const isZip = magic.startsWith('504b0304');
          if (!isPdf && !isZip) { console.log(`    [${i}] nao-util (${magic})`); continue; }

          const ext = isPdf ? 'pdf' : 'xlsx';
          const slug = (a.titulo || 'anexo').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
          const dest = path.join(SAIDA, `portaria_${p.cod}_${i}_${slug}.${ext}`);
          fs.writeFileSync(dest, buf);
          const size = buf.length;
          console.log(`    [${i}] ${size} bytes ${ext.toUpperCase()} -> ${path.basename(dest)}`);
          out.anexos.push({ idx: i, titulo: a.titulo, href: a.href, bytes: size, arquivo: dest, tipo: ext });
        } catch (e) {
          console.log(`    [${i}] ERRO: ${e.message?.slice(0, 100)}`);
        }
      }
      console.log(`  texto inicio: ${out.texto_inicio.slice(0, 150).replace(/\s+/g, ' ')}`);
    } catch (e) {
      out.erro = e.message?.slice(0, 200);
      console.log(`  ERRO: ${out.erro}`);
    } finally {
      await pg.close();
    }
    relatorio.portarias.push(out);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(SAIDA, `_relatorio_${ts}.json`), JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\n[OK] ${relatorio.portarias.length} portarias processadas.`);
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
