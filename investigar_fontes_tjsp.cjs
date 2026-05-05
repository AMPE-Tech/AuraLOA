// Camada 2 — Investigacao empirica TJSP DEPRE + Mapas Orcamentarios.
// MANTRA: descobrir URLs reais antes de baixar. Nunca supor.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA_BASE = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2';

const PAGINAS = [
  'https://www.tjsp.jus.br/Precatorios',
  'https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes',
  'https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=159',
  'https://www.tjsp.jus.br/Precatorios/Comunicados',
  'https://www.tjsp.jus.br/Precatorios/ConsultaPrecatorio',
];

const EXT_INTERESSE = /\.(csv|xlsx?|ods|pdf|zip|txt)(\?|$)/i;

async function investigarPagina(ctx, url) {
  const resultado = {
    url,
    status: null,
    final_url: null,
    title: null,
    total_links: 0,
    amostra_links_internos: [],
    links_download: [],
    formularios: [],
    tabelas_count: 0,
    erro: null,
  };

  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    resultado.status = resp ? resp.status() : null;
    resultado.final_url = page.url();
    resultado.title = await page.title().catch(() => null);
    await page.waitForTimeout(3000);

    const links = await page.$$eval('a[href]', (as) =>
      as.map((a) => ({
        href: a.href,
        texto: (a.textContent || '').trim().slice(0, 120),
      }))
    );
    resultado.total_links = links.length;

    const vistos = new Set();
    for (const l of links) {
      if (!l.href || vistos.has(l.href)) continue;
      vistos.add(l.href);
      if (EXT_INTERESSE.test(l.href)) {
        resultado.links_download.push(l);
      }
    }

    // Amostra dos primeiros 20 links internos do dominio que mencionem precatorio/pagamento/depre
    const interesse = /precat|pagamento|depre|expedi|pendente|mapa|comunicado/i;
    for (const l of links) {
      if (!l.href || vistos.size > 400) continue;
      if (!l.href.includes('tjsp.jus.br')) continue;
      if (interesse.test(l.href) || interesse.test(l.texto)) {
        resultado.amostra_links_internos.push(l);
      }
      if (resultado.amostra_links_internos.length >= 40) break;
    }

    resultado.formularios = await page.$$eval('form', (fs) =>
      fs.map((f) => ({
        action: f.action,
        method: f.method,
        inputs: Array.from(f.querySelectorAll('input,select')).map((i) => ({
          name: i.name,
          type: i.type || i.tagName.toLowerCase(),
          id: i.id,
        })),
      }))
    );

    resultado.tabelas_count = await page.$$eval('table', (ts) => ts.length);
  } catch (e) {
    resultado.erro = e.message.slice(0, 250);
  } finally {
    await page.close();
  }
  return resultado;
}

(async () => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(SAIDA_BASE, `_investigacao_tjsp_${ts}.json`);
  if (!fs.existsSync(SAIDA_BASE)) fs.mkdirSync(SAIDA_BASE, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  console.log('[*] Aquecendo sessao na home TJSP...');
  const pageHome = await ctx.newPage();
  await pageHome
    .goto('https://www.tjsp.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    .catch(() => {});
  await pageHome.waitForTimeout(2000);
  await pageHome.close();

  const relatorio = { gerado_em: new Date().toISOString(), tribunal: 'TJSP', paginas: [] };

  for (const url of PAGINAS) {
    console.log(`\n[*] ${url}`);
    const info = await investigarPagina(ctx, url);
    console.log(
      `    status=${info.status} final=${info.final_url} links=${info.total_links} downloads=${info.links_download.length} tabelas=${info.tabelas_count}${info.erro ? ' ERRO: ' + info.erro : ''}`
    );
    if (info.amostra_links_internos.length > 0) {
      console.log(`    links internos de interesse (${info.amostra_links_internos.length}):`);
      for (const l of info.amostra_links_internos.slice(0, 15)) {
        console.log(`      - ${l.texto.slice(0, 60)} -> ${l.href.slice(0, 95)}`);
      }
    }
    if (info.links_download.length > 0) {
      console.log(`    DOWNLOADS:`);
      for (const l of info.links_download.slice(0, 20)) {
        console.log(`      - ${l.texto.slice(0, 60)} -> ${l.href.slice(0, 95)}`);
      }
    }
    if (info.formularios.length > 0) {
      console.log(`    formularios: ${info.formularios.length}`);
      for (const f of info.formularios.slice(0, 3)) {
        console.log(
          `      - ${f.method} ${f.action} [${f.inputs.map((i) => i.name || i.type).filter(Boolean).join(',')}]`
        );
      }
    }
    relatorio.paginas.push(info);
  }

  fs.writeFileSync(out, JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\n[OK] ${out}`);

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
