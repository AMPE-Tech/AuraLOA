// Sonda as listas encontradas no portal Credores.
// - ListaPendentes: Lista de Precatorios Disponibilizados e Pendentes de Pagamento
// - ListaGeral:    Lista Geral de Precatorios
// - Comunicados tipoDestino=3377: Mapa anual de precatorios

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URLS = [
  { nome: 'ListaPendentes', url: 'https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes' },
  { nome: 'ListaGeral', url: 'https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral' },
  { nome: 'MapaAnual', url: 'https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=3377' },
];

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda';

async function sondar(ctx, nome, url) {
  console.log(`\n========== ${nome} ==========`);
  console.log(`URL: ${url}`);
  const page = await ctx.newPage();
  const out = { nome, url };

  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    out.status = resp ? resp.status() : null;
    out.final_url = page.url();
    out.title = await page.title().catch(() => null);
    await page.waitForTimeout(3000);

    console.log(`  status=${out.status} final=${out.final_url}`);
    console.log(`  title=${out.title}`);

    // Procura links UrlExternaTJSP (FileFetch.ashx - PDFs oficiais)
    const fileFetch = await page.$$eval('a[href*="FileFetch.ashx"], a.UrlExternaTJSP', (as) =>
      as.map((a) => ({ href: a.href, texto: (a.textContent || '').trim(), title: a.title || '' }))
    );
    out.arquivos_oficiais = fileFetch;
    console.log(`  arquivos oficiais (FileFetch): ${fileFetch.length}`);
    for (const a of fileFetch.slice(0, 30)) {
      console.log(`    - ${(a.texto || a.title).slice(0, 60).padEnd(62)} -> ${a.href.slice(0, 120)}`);
    }

    // Tabelas grandes
    const tabelas = await page.$$eval('table', (ts) =>
      ts.map((t, i) => ({
        idx: i,
        id: t.id || '',
        classe: t.className || '',
        linhas: t.querySelectorAll('tr').length,
        primeiras: Array.from(t.querySelectorAll('tr'))
          .slice(0, 6)
          .map((r) =>
            Array.from(r.querySelectorAll('th,td')).map((c) => (c.textContent || '').trim().slice(0, 60))
          ),
      }))
    );
    tabelas.sort((a, b) => b.linhas - a.linhas);
    console.log(`  tabelas=${tabelas.length} Top 3: ${tabelas.slice(0, 3).map((t) => `${t.id || 'sem'}(${t.linhas})`).join(', ')}`);

    // Imprime conteudo das tabelas grandes (>5 linhas)
    for (const t of tabelas.filter((x) => x.linhas > 5).slice(0, 2)) {
      console.log(`\n  === tabela ${t.id} (${t.linhas} linhas) ===`);
      for (const r of t.primeiras) {
        console.log(`    | ${r.slice(0, 8).map((c) => c.slice(0, 25)).join(' | ')}`);
      }
    }

    const slug = nome.toLowerCase();
    fs.writeFileSync(path.join(SAIDA, `lista_${slug}.html`), await page.content(), 'utf-8');
    const texto = await page.evaluate(() => (document.body.innerText || '').trim());
    fs.writeFileSync(path.join(SAIDA, `lista_${slug}.txt`), texto, 'utf-8');

    console.log(`\n  texto inicio (600 chars): ${texto.slice(0, 600).replace(/\s+/g, ' ')}`);

    // Tambem lista comunicados especificos se a pagina for Comunicados
    if (url.includes('tipoDestino')) {
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
      console.log(`\n  comunicados unicos: ${unicos.length}`);
      for (const c of unicos.slice(0, 15)) console.log(`    - ${c.texto.slice(0, 80)}`);
    }
  } catch (e) {
    out.erro = e.message.slice(0, 200);
    console.log(`  ERRO: ${out.erro}`);
  } finally {
    await page.close();
  }
  return out;
}

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

  const relatorio = { gerado_em: new Date().toISOString(), paginas: [] };
  for (const p of URLS) {
    relatorio.paginas.push(await sondar(ctx, p.nome, p.url));
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(SAIDA, `_sonda_listas_${ts}.json`), JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\n[OK] sonda salva`);

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
