// Re-investigacao das 3 categorias de comunicados TJSP buscando DATAS de publicacao.
// Objetivo: identificar comunicados recentes (>= 2022) = provavelmente pendentes.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda';

const URLS = [
  { nome: 'Estaduais', td: 112, url: 'https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=112' },
  { nome: 'Municipais', td: 113, url: 'https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=113' },
  { nome: 'INSS', td: 126, url: 'https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=126' },
];

async function inspecionarCategoria(ctx, item) {
  console.log(`\n========== ${item.nome} (tipoDestino=${item.td}) ==========`);
  const page = await ctx.newPage();
  const resultado = { ...item, comunicados: [] };
  try {
    await page.goto(item.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Pega todo o HTML e procura padroes de comunicado com data
    const html = await page.content();
    fs.writeFileSync(path.join(SAIDA, `listagem_td${item.td}.html`), html, 'utf-8');

    // Extrai blocos que contenham link de comunicado + data
    // Padrao comum: "DD/MM/AAAA TITULO" ou elementos com classes noticia/card
    const comunicados = await page.evaluate(() => {
      const out = [];
      const links = Array.from(document.querySelectorAll('a[href*="codigoComunicado="]'));
      for (const a of links) {
        const codMatch = a.href.match(/codigoComunicado=(\d+)/);
        if (!codMatch) continue;
        const codigo = codMatch[1];
        const titulo = (a.textContent || '').trim();

        // Tenta achar data proxima no DOM (procurando ate 4 niveis acima)
        let dataText = null;
        let parent = a;
        for (let i = 0; i < 6 && parent; i++) {
          const textoRaw = (parent.textContent || '');
          const m = textoRaw.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (m) { dataText = m[1]; break; }
          parent = parent.parentElement;
        }

        out.push({ codigo, titulo, data: dataText, href: a.href });
      }
      return out;
    });

    // Dedup por codigo
    const porCodigo = new Map();
    for (const c of comunicados) {
      if (!porCodigo.has(c.codigo)) porCodigo.set(c.codigo, c);
    }
    resultado.comunicados = Array.from(porCodigo.values());
    console.log(`  comunicados unicos encontrados: ${resultado.comunicados.length}`);

    // Ordena por data desc (mais recentes primeiro)
    resultado.comunicados.sort((a, b) => {
      const da = a.data ? toDate(a.data) : 0;
      const db = b.data ? toDate(b.data) : 0;
      return db - da;
    });

    for (const c of resultado.comunicados) {
      const marker = c.data && c.data.slice(-4) >= '2022' ? ' 🟢 RECENTE' : '';
      console.log(`    [${c.codigo.padEnd(6)}] ${c.data || 'sem data'} - ${c.titulo.slice(0, 90)}${marker}`);
    }
  } catch (e) {
    resultado.erro = e.message.slice(0, 250);
    console.log(`  ERRO: ${resultado.erro}`);
  } finally {
    await page.close();
  }
  return resultado;
}

function toDate(str) {
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
}

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const home = await ctx.newPage();
  await home.goto('https://www.tjsp.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await home.waitForTimeout(1500);
  await home.close();

  const relatorio = { gerado_em: new Date().toISOString(), categorias: [] };
  for (const item of URLS) {
    relatorio.categorias.push(await inspecionarCategoria(ctx, item));
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const relPath = path.join(SAIDA, `_reinvestigacao_com_datas_${ts}.json`);
  fs.writeFileSync(relPath, JSON.stringify(relatorio, null, 2), 'utf-8');

  console.log('\n========== RESUMO ==========');
  for (const cat of relatorio.categorias) {
    const recentes = (cat.comunicados || []).filter(c => c.data && c.data.slice(-4) >= '2022');
    console.log(`  ${cat.nome}: total=${cat.comunicados?.length || 0}  recentes (>=2022)=${recentes.length}`);
  }
  console.log(`\n[OK] ${relPath}`);

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
