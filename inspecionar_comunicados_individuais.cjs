// Inspecionar 3 comunicados individuais em detalhe (conteudo real do corpo).
// - 4679 UNICAMP (Estadual)
// - 6148 IPREVEN (Municipal)
// - 1342 INSS (Federal)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda/individuais';

const ALVOS = [
  { codigo: 4679, nome: 'UNICAMP_Estadual' },
  { codigo: 6148, nome: 'IPREVEN_Municipal' },
  { codigo: 1342, nome: 'INSS_Federal' },
];

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  for (const a of ALVOS) {
    console.log(`\n========== ${a.nome} (${a.codigo}) ==========`);
    const url = `https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=${a.codigo}&pagina=1`;
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2500);

      // O conteudo do comunicado geralmente fica em um container especifico - vamos extrair o bloco principal
      const bloco = await page.evaluate(() => {
        // Tenta achar o container do comunicado
        const sel = [
          '.ConteudoComunicado',
          '#conteudo-comunicado',
          '.conteudo-comunicado',
          '.tj-content',
          '.news-content',
          'article',
          'main',
          '[role=main]',
        ];
        for (const s of sel) {
          const el = document.querySelector(s);
          if (el) return { selector: s, html: el.outerHTML.slice(0, 20000), texto: (el.innerText || '').slice(0, 5000) };
        }
        // fallback: tudo entre os headings h1 e o rodape
        const h1 = document.querySelector('h1, h2, h3');
        if (h1) {
          const container = h1.closest('div') || h1.parentElement;
          return {
            selector: 'h1-parent',
            html: container.outerHTML.slice(0, 20000),
            texto: (container.innerText || '').slice(0, 5000),
          };
        }
        return { selector: 'fallback-body', html: '', texto: (document.body.innerText || '').slice(0, 5000) };
      });
      console.log(`  container detectado: ${bloco.selector}`);
      console.log(`  chars texto: ${bloco.texto.length}`);

      const slug = a.nome.toLowerCase();
      fs.writeFileSync(path.join(SAIDA, `${slug}_pagina.html`), await page.content(), 'utf-8');
      fs.writeFileSync(path.join(SAIDA, `${slug}_bloco.html`), bloco.html, 'utf-8');
      fs.writeFileSync(path.join(SAIDA, `${slug}_texto.txt`), bloco.texto, 'utf-8');

      // Links FileFetch especificamente - devem ser os anexos reais
      const arquivos = await page.$$eval('a[href*="FileFetch.ashx"]', (as) =>
        as.map((a) => ({ href: a.href, texto: (a.textContent || '').trim(), title: a.title || '' }))
      );
      console.log(`  FileFetch.ashx (anexo real): ${arquivos.length}`);
      for (const ar of arquivos) {
        console.log(`    - ${(ar.texto || ar.title).slice(0, 60)} -> ${ar.href}`);
      }

      // Tabelas no bloco
      const tabelas = await page.$$eval('table', (ts) =>
        ts.map((t) => ({ id: t.id, classe: t.className, linhas: t.querySelectorAll('tr').length }))
      );
      tabelas.sort((a, b) => b.linhas - a.linhas);
      console.log(`  tabelas top 3: ${tabelas.slice(0, 3).map((t) => `${t.id || 'sem'}(${t.linhas})`).join(', ')}`);

      // Mostra primeiros 1500 chars do texto bloco
      console.log(`\n  texto_bloco (inicio):\n---\n${bloco.texto.slice(0, 1500).replace(/\n{3,}/g, '\n')}\n---`);
    } catch (e) {
      console.log(`  ERRO: ${e.message.slice(0, 200)}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('\n[OK] inspecao salva em', SAIDA);
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
