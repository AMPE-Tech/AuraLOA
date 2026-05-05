// Investiga fontes de CRONOGRAMA DE PAGAMENTOS do TJSP.
// Objetivo: achar listas de precatorios que JA FORAM PAGOS (= credor aceitou acordo).
//
// Candidatos baseados na sessao anterior:
//   tipoDestino=213 - Cronograma INSS (acidentarias) - 10 comunicados
//   tipoDestino=209 - Evolucao Anual dos Pagamentos
//   tipoDestino=246 - Depositos efetuados pelas devedoras
//   endpoint ASP.NET: webrelpubliclstpagprecatefetuados.aspx (CAPTCHA)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_cronograma';

const CANDIDATOS = [
  { td: 213, nome: 'Cronograma_INSS_Acidentarias' },
  { td: 209, nome: 'Evolucao_Anual_Pagamentos' },
  { td: 246, nome: 'Depositos_Devedoras' },
  { td: 87,  nome: 'Listas_de_Pagamento' }, // visto em um grep anterior
  { td: 212, nome: 'Dividas_Entidades_Devedoras' },
  { td: 247, nome: 'Divida_Efetiva_Entidades' },
  { td: 3377, nome: 'Mapa_Anual_Precatorios' },
  { td: 3309, nome: 'Tabelas_Atualizacao' },
];

async function investigarCategoria(ctx, c) {
  const url = `https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=${c.td}`;
  const page = await ctx.newPage();
  const r = { td: c.td, nome: c.nome, url, total: 0, comunicados: [] };
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);

    // Pega TITULO da categoria
    const titulo = await page.evaluate(() => {
      const h = document.querySelector('h1, h2, h3, .tituloPagina, .titulo');
      return h ? (h.textContent || '').trim() : null;
    });
    r.titulo_pagina = titulo;

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
    const arr = Array.from(uniq.values()).sort((a, b) => {
      const pd = s => { const m = s.data?.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(+m[3], +m[2]-1, +m[1]).getTime() : 0; };
      return pd(b) - pd(a);
    });
    r.total = arr.length;
    r.comunicados = arr;
  } catch (e) {
    r.erro = e.message?.slice(0, 150);
  } finally {
    await page.close();
  }
  return r;
}

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const resultado = { gerado_em: new Date().toISOString(), categorias: [] };
  for (const c of CANDIDATOS) {
    process.stdout.write(`[td=${c.td}] ${c.nome}... `);
    const r = await investigarCategoria(ctx, c);
    resultado.categorias.push(r);
    console.log(`total=${r.total}` + (r.titulo_pagina ? `  "${r.titulo_pagina}"` : ''));
  }

  console.log('\n=== DETALHES (recentes primeiro) ===');
  for (const cat of resultado.categorias) {
    if (!cat.comunicados?.length) continue;
    console.log(`\n### [td=${cat.td}] ${cat.nome} (${cat.comunicados.length} comunicados) ${cat.titulo_pagina || ''}`);
    for (const c of cat.comunicados.slice(0, 10)) {
      console.log(`  [${c.codigo.padEnd(7)}] ${c.data || 'sem-data'}  ${c.titulo.slice(0, 100)}`);
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(SAIDA, `_cronograma_${ts}.json`), JSON.stringify(resultado, null, 2), 'utf-8');
  console.log(`\n[OK] salvo em ${SAIDA}`);
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
