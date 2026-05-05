// Sonda 1 entidade no ASP.NET TJSP Pendentes de Pagamento.
// Objetivo: mapear colunas reais antes de escalar para 690 entidades.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'http://www.tjsp.jus.br/cac/scp/webRelPublicLstPagPrecatPendentes.aspx';
const ALVO = 'INSS';
const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda';

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const page = await ctx.newPage();
  console.log(`[*] Abrindo: ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  // Descobre values do dropdown vENT_ID e procura INSS
  const opcoes = await page.$$eval('#vENT_ID option', (os) =>
    os.map((o) => ({ value: o.value, text: (o.textContent || '').trim() }))
  );
  console.log(`[*] Total opcoes dropdown: ${opcoes.length}`);

  const achadas = opcoes.filter((o) => o.text.toUpperCase().includes(ALVO));
  console.log(`[*] Opcoes contendo "${ALVO}":`);
  for (const o of achadas.slice(0, 10)) console.log(`    value=${o.value}  text=${o.text}`);

  if (achadas.length === 0) {
    console.log('[ERRO] Entidade nao achada no dropdown.');
    await browser.close();
    return;
  }

  const escolhida = achadas[0];
  console.log(`\n[*] Selecionando: ${escolhida.text} (value=${escolhida.value})`);
  await page.selectOption('#vENT_ID', escolhida.value);
  await page.waitForTimeout(1500);

  // Captura HTML da pagina apos selecao (alguns ASP.NET recarregam)
  fs.writeFileSync(path.join(SAIDA, 'passo1_apos_select.html'), await page.content(), 'utf-8');

  // Descobre o botao submit - pode ser input button, image, link
  const botoes = await page.$$eval('input,button,a', (els) =>
    els
      .filter((e) => {
        const t = (e.type || '').toLowerCase();
        const v = (e.value || e.textContent || e.alt || '').trim();
        return t === 'submit' || t === 'button' || t === 'image' || /consult|listar|pesquis|ok|enviar/i.test(v);
      })
      .map((e) => ({
        tag: e.tagName,
        type: e.type || null,
        name: e.name || null,
        id: e.id || null,
        value: e.value || null,
        text: (e.textContent || '').trim().slice(0, 80),
        alt: e.alt || null,
      }))
      .slice(0, 25)
  );
  console.log('\n[*] Botoes/submits candidatos:');
  for (const b of botoes) console.log('   ', JSON.stringify(b));

  // Tentativa de submit: botao padrao GeneXus geralmente se chama BUTTON1 ou similar.
  // Tentamos pressionar Enter no campo, que dispara submit.
  console.log('\n[*] Tentando submit via Enter...');
  await page.focus('#vENT_ID');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  fs.writeFileSync(path.join(SAIDA, 'passo2_apos_submit.html'), await page.content(), 'utf-8');

  // Conta tabelas e extrai amostra da maior
  const tabelas = await page.$$eval('table', (ts) =>
    ts.map((t, i) => {
      const trs = Array.from(t.querySelectorAll('tr'));
      return {
        idx: i,
        id: t.id || '',
        classe: t.className || '',
        total_linhas: trs.length,
        primeiras_linhas: trs.slice(0, 8).map((r) =>
          Array.from(r.querySelectorAll('th,td')).map((c) => (c.textContent || '').trim().slice(0, 80))
        ),
      };
    })
  );

  // Ordena por total_linhas desc e mostra top 3
  tabelas.sort((a, b) => b.total_linhas - a.total_linhas);
  console.log(`\n[*] Tabelas na pagina: ${tabelas.length}. Top 3 por tamanho:`);
  for (const t of tabelas.slice(0, 3)) {
    console.log(`\n  tabela id=${t.id} class=${t.classe.slice(0, 40)} linhas=${t.total_linhas}`);
    for (const r of t.primeiras_linhas) {
      console.log(`    [${r.length}] ${r.slice(0, 9).map((c) => c.slice(0, 30)).join(' | ')}`);
    }
  }

  const texto = await page.evaluate(() => (document.body.innerText || '').trim());
  fs.writeFileSync(path.join(SAIDA, 'passo2_texto.txt'), texto, 'utf-8');
  const amostra = texto.slice(0, 2500).replace(/\s+/g, ' ');
  console.log(`\n[*] Texto inicio:\n${amostra}`);

  await browser.close();
  console.log(`\n[OK] Artefatos em ${SAIDA}`);
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
