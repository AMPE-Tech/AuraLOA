// Busca listas RECENTES em outros tipoDestino TJSP.
// Objetivo: achar comunicados com precatorios individuais publicados em 2022+.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda';

// TipoDestinos candidatos a listas recentes
const CATS = [
  { td: 159,  nome: 'Mapas Orcamentarios Credores (MOCs)' },
  { td: 1289, nome: 'Planos de Pagamento de Entidades Devedoras' },
  { td: 3345, nome: 'Editais de Acordo' },
  { td: 3377, nome: 'Mapa Anual de Precatorios' },
  { td: 246,  nome: 'Depositos efetuados pelas devedoras' },
  { td: 247,  nome: 'Divida efetiva de entidades' },
  { td: 212,  nome: 'Dividas de entidades devedoras' },
  { td: 211,  nome: 'Percentual do orcamento anual' },
  { td: 132,  nome: 'Esclarecimentos e Modelos de Oficios Requisitorios' },
  { td: 213,  nome: 'Cronograma de pagamento INSS (Acidentarias)' },
  { td: 3309, nome: 'Tabelas de atualizacao monetaria' },
];

async function inspecionar(ctx, c) {
  const url = `https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=${c.td}`;
  const page = await ctx.newPage();
  const r = { td: c.td, nome: c.nome, url, total: 0, recentes: [] };
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);

    const coms = await page.evaluate(() => {
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
    for (const x of coms) if (!uniq.has(x.codigo)) uniq.set(x.codigo, x);
    const arr = Array.from(uniq.values());
    r.total = arr.length;
    r.recentes = arr.filter(x => x.data && x.data.slice(-4) >= '2022').sort((a, b) => {
      const pd = s => { const m = s.data?.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(+m[3], +m[2]-1, +m[1]).getTime() : 0; };
      return pd(b) - pd(a);
    });
    r.todos = arr;
  } catch (e) {
    r.erro = e.message.slice(0, 150);
  } finally {
    await page.close();
  }
  return r;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });
  const home = await ctx.newPage();
  await home.goto('https://www.tjsp.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await home.waitForTimeout(1500);
  await home.close();

  const rel = { gerado_em: new Date().toISOString(), categorias: [] };
  for (const c of CATS) {
    process.stdout.write(`[${c.td}] ${c.nome}... `);
    const r = await inspecionar(ctx, c);
    rel.categorias.push(r);
    console.log(`total=${r.total}  recentes>=2022=${r.recentes.length}`);
  }

  console.log('\n========== DETALHES DOS RECENTES (>=2022) ==========');
  for (const c of rel.categorias) {
    if (!c.recentes?.length) continue;
    console.log(`\n### ${c.nome} (tipoDestino=${c.td}) - ${c.recentes.length} recentes:`);
    for (const x of c.recentes.slice(0, 20)) {
      console.log(`  [${x.codigo.padEnd(7)}] ${x.data} - ${x.titulo.slice(0, 90)}`);
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(SAIDA, `_outras_categorias_${ts}.json`), JSON.stringify(rel, null, 2), 'utf-8');
  console.log('\n[OK] salvo');
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
