// Sonda as 3 categorias de comunicados encontradas:
//   tipoDestino=112 - Estaduais (Fazenda SP + Autarquias + Fundacoes)
//   tipoDestino=113 - Municipais (Prefeituras + Autarquias + Fundacoes)
//   tipoDestino=126 - INSS
// Objetivo: ver se tem PDFs/listas individuais por entidade ou CNJ.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URLS = [
  { nome: 'Estaduais', td: 112, url: 'https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=112' },
  { nome: 'Municipais', td: 113, url: 'https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=113' },
  { nome: 'INSS', td: 126, url: 'https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=126' },
];

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda';

async function sondar(ctx, item) {
  console.log(`\n========== ${item.nome} (tipoDestino=${item.td}) ==========`);
  const page = await ctx.newPage();
  const out = { ...item };
  try {
    const resp = await page.goto(item.url, { waitUntil: 'networkidle', timeout: 60000 });
    out.status = resp ? resp.status() : null;
    await page.waitForTimeout(3000);

    // Lista todos os comunicados da pagina
    const comunicados = await page.$$eval('a[href*="codigoComunicado="]', (as) =>
      as.map((a) => ({ href: a.href, texto: (a.textContent || '').trim() }))
    );
    const seen = new Set();
    const unicos = comunicados.filter((c) => {
      const m = c.href.match(/codigoComunicado=(\d+)/);
      if (!m || seen.has(m[1])) return false;
      seen.add(m[1]);
      return true;
    });
    out.comunicados = unicos;
    console.log(`  status=${out.status}  comunicados_unicos=${unicos.length}`);
    for (const c of unicos.slice(0, 30)) {
      console.log(`    - ${c.texto.slice(0, 100)}`);
    }

    // Pega datas proximas ao titulo (se houver)
    const cards = await page.$$eval('[class*="noticia"], [class*="card"], .Card, .comunicado', (els) =>
      els.slice(0, 20).map((e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200))
    );
    out.textos_cards = cards;

    const slug = item.nome.toLowerCase();
    fs.writeFileSync(path.join(SAIDA, `cat_${slug}.html`), await page.content(), 'utf-8');
  } catch (e) {
    out.erro = e.message.slice(0, 200);
    console.log(`  ERRO: ${out.erro}`);
  } finally {
    await page.close();
  }
  return out;
}

// Abre 1 comunicado de exemplo e tenta baixar o PDF oficial (UrlExternaTJSP / FileFetch)
async function abrirComunicado(ctx, codigo, pastaOut) {
  const url = `https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=${codigo}&pagina=1`;
  console.log(`\n  >> Abrindo comunicado ${codigo}: ${url}`);
  const page = await ctx.newPage();
  const resultado = { codigo };
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    const texto = await page.evaluate(() => (document.body.innerText || '').trim());
    resultado.texto_inicio = texto.slice(0, 500);

    const arquivos = await page.$$eval('a.UrlExternaTJSP, a[href*="FileFetch.ashx"]', (as) =>
      as.map((a) => ({ href: a.href, texto: (a.textContent || '').trim(), title: a.title || '' }))
    );
    resultado.arquivos = arquivos;
    console.log(`     arquivos oficiais: ${arquivos.length}`);
    for (const a of arquivos.slice(0, 10)) {
      console.log(`       - ${(a.texto || a.title).slice(0, 60).padEnd(62)} -> ${a.href.slice(0, 120)}`);
    }

    // Baixa o primeiro arquivo nao-footer (tem codigo diferente dos footers comuns)
    for (const a of arquivos.slice(0, 3)) {
      try {
        const r = await ctx.request.get(a.href, { maxRedirects: 5 });
        const buf = await r.body();
        const magic = buf.slice(0, 4).toString('hex');
        const ct = r.headers()['content-type'] || 'n/a';
        const cd = r.headers()['content-disposition'] || 'n/a';
        const isPdf = magic.startsWith('25504446');
        const isZip = magic.startsWith('504b0304');
        const tipo = isPdf ? 'PDF' : isZip ? 'XLSX/ZIP' : 'OUTRO';
        const destino = path.join(pastaOut, `c${codigo}_${(a.texto || 'arquivo').replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.${isPdf ? 'pdf' : isZip ? 'xlsx' : 'bin'}`);
        fs.writeFileSync(destino, buf);
        console.log(`       -> [${r.status()}] ${buf.length} bytes ${tipo} ct=${ct.slice(0, 30)} salvo=${path.basename(destino)}`);
      } catch (e) {
        console.log(`       ERRO download ${a.href}: ${e.message.slice(0, 100)}`);
      }
    }
  } catch (e) {
    resultado.erro = e.message.slice(0, 200);
    console.log(`     ERRO: ${resultado.erro}`);
  } finally {
    await page.close();
  }
  return resultado;
}

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });
  const amostraDir = path.join(SAIDA, 'amostras_comunicados');
  if (!fs.existsSync(amostraDir)) fs.mkdirSync(amostraDir, { recursive: true });

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

  const relatorio = { gerado_em: new Date().toISOString(), categorias: [] };

  for (const item of URLS) {
    const r = await sondar(ctx, item);
    relatorio.categorias.push(r);

    // Abre 1 comunicado mais recente de cada categoria
    if (r.comunicados && r.comunicados.length > 0) {
      const m = r.comunicados[0].href.match(/codigoComunicado=(\d+)/);
      if (m) await abrirComunicado(ctx, m[1], amostraDir);
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(SAIDA, `_sonda_categorias_${ts}.json`), JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log('\n[OK] sonda categorias salva');
  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
