// Descobre URL atual do formulario de precatorios PENDENTES no TJSP
// Estrategia: entra na secao "Entidades devedoras" e "Credores" do portal e lista
// todos os links que apontam para formularios de consulta.
//
// As URLs ASPX legadas (webrelpubliclst...) foram migradas em 2024/2025.

const { chromium } = require('playwright');
const fs = require('fs');

const PONTOS_DE_ENTRADA = [
  // Portal principal precatorios
  'https://www.tjsp.jus.br/Precatorios',
  // Secao Entidades devedoras (onde esta a lista de pendentes)
  'https://www.tjsp.jus.br/Precatorios/EntidadesDevedoras',
  // Secao Credores
  'https://www.tjsp.jus.br/Precatorios/Credores',
  // Secao Gestao
  'https://www.tjsp.jus.br/Precatorios/GestaoPrecatorios',
  // Pagina de Apresentacao
  'https://www.tjsp.jus.br/Precatorios/Apresentacao',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const todosLinks = new Map(); // href -> {texto, origem}

  for (const url of PONTOS_DE_ENTRADA) {
    const page = await ctx.newPage();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const status = resp?.status();
      console.log(`\n=== ${url}  [${status}] ===`);
      if (status >= 400) { await page.close(); continue; }

      await page.waitForTimeout(1500);

      // Lista TODOS os links
      const links = await page.$$eval('a', as =>
        as.map(a => ({
          href: a.href,
          texto: (a.textContent || '').trim().slice(0, 120),
        }))
      );
      for (const l of links) {
        if (!l.href || l.href.startsWith('javascript:') || l.href.startsWith('mailto:')) continue;
        // Filtra apenas links do dominio TJSP
        if (!l.href.includes('tjsp.jus.br')) continue;
        if (!todosLinks.has(l.href)) {
          todosLinks.set(l.href, { texto: l.texto, origem: url });
        }
      }

      // Procura especificamente por textos-chave
      const candidatos = links.filter(l => {
        const t = (l.texto || '').toLowerCase();
        const h = (l.href || '').toLowerCase();
        return (
          t.includes('pendent') || t.includes('pagament') ||
          t.includes('efetuad') || t.includes('ordem cronol') ||
          t.includes('lista') ||
          h.includes('webrel') || h.includes('lstpag') ||
          h.includes('pendent') || h.includes('efetuad') ||
          h.includes('relpub') || h.includes('consulta')
        );
      });

      if (candidatos.length) {
        console.log(`  CANDIDATOS (${candidatos.length}):`);
        for (const c of candidatos) {
          console.log(`    [${c.texto.slice(0, 60)}] -> ${c.href}`);
        }
      }
    } catch (e) {
      console.log(`  ERRO: ${e.message?.slice(0, 100)}`);
    } finally {
      await page.close();
    }
  }

  // Sumario final: todos os links candidatos
  console.log('\n\n========== CANDIDATOS FINAIS ==========');
  const finais = Array.from(todosLinks.entries()).filter(([href, v]) => {
    const t = (v.texto || '').toLowerCase();
    const h = href.toLowerCase();
    return (
      t.includes('pendent') || t.includes('pagament') ||
      t.includes('efetuad') || t.includes('ordem cronol') ||
      h.includes('webrel') || h.includes('lstpag') ||
      h.includes('pendent') || h.includes('efetuad')
    );
  });
  for (const [href, v] of finais) {
    console.log(`  [${v.texto.slice(0, 80)}]\n    -> ${href}\n    origem: ${v.origem}\n`);
  }

  fs.writeFileSync('C:/Temp/tjsp_links_pendentes.json',
    JSON.stringify({ todos: Array.from(todosLinks.entries()), candidatos: finais }, null, 2));
  console.log('\n[OK] C:/Temp/tjsp_links_pendentes.json');

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
