// Sonda v2 — clica no botao "Abrir Relatorio" (BUTTON3) apos selecionar entidade.
// Captura HTML antes/depois e eventual popup.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'http://www.tjsp.jus.br/cac/scp/webRelPublicLstPagPrecatPendentes.aspx';
const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda';

// Para nao usar INSS (pode ter 8020 processos = demora) tentamos 1 autarquia pequena primeiro.
// "BURIPREV - INSTITUTO DE PREV. DOS SERV. PUBL. DO MUN. DE BURI" = 1 processo no MOC 2026.
const ALVO = 'BURIPREV';

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    acceptDownloads: true,
  });

  const page = await ctx.newPage();
  console.log(`[*] Abrindo: ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Localiza value do dropdown
  const opcoes = await page.$$eval('#vENT_ID option', (os) =>
    os.map((o) => ({ value: o.value, text: (o.textContent || '').trim() }))
  );
  const esc = opcoes.find((o) => o.text.toUpperCase().includes(ALVO));
  if (!esc) {
    console.log(`[ERRO] "${ALVO}" nao achada. Listando 5 primeiras:`);
    for (const o of opcoes.slice(0, 5)) console.log(`  ${o.value}  ${o.text}`);
    await browser.close();
    return;
  }
  console.log(`[*] Alvo: ${esc.text} (value=${esc.value})`);

  // Prepara listeners para popup/download/nova pagina ANTES de clicar
  const popupPromise = ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);

  await page.selectOption('#vENT_ID', esc.value);
  await page.waitForTimeout(1500);

  console.log('[*] Clicando BUTTON3 (Abrir Relatorio)...');
  // Clica no botao - tentar varias formas
  const clicou = await page
    .click('input[value="Abrir Relatório"]', { timeout: 5000 })
    .then(() => 'input[value]')
    .catch(() =>
      page
        .click('input[name="BUTTON3"]', { timeout: 5000 })
        .then(() => 'input[name=BUTTON3]')
        .catch(() => null)
    );
  console.log(`  clicou: ${clicou}`);

  await page.waitForTimeout(4000);
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  // Verifica se abriu popup
  const popup = await popupPromise;
  const download = await downloadPromise;

  if (download) {
    const nome = download.suggestedFilename() || 'relatorio_tjsp.bin';
    const destino = path.join(SAIDA, `download_${ALVO}_${nome}`);
    await download.saveAs(destino);
    const buf = fs.readFileSync(destino);
    const magic = buf.slice(0, 4).toString('hex');
    console.log(`\n[DOWNLOAD] ${destino}`);
    console.log(`  bytes=${buf.length}  magic=${magic}  nome_sugerido=${nome}`);
  }

  if (popup) {
    console.log(`\n[POPUP] Nova janela aberta: ${popup.url()}`);
    await popup.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await popup.waitForTimeout(3000);
    const html = await popup.content();
    const htmlPath = path.join(SAIDA, `popup_${ALVO}.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`  title: ${await popup.title()}`);
    console.log(`  url final: ${popup.url()}`);
    console.log(`  HTML salvo: ${htmlPath}  (${html.length} chars)`);

    const tabelas = await popup.$$eval('table', (ts) =>
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
    console.log(`  tabelas: ${tabelas.length}. Top 3:`);
    for (const t of tabelas.slice(0, 3)) {
      console.log(`    id=${t.id} class=${t.classe.slice(0, 30)} linhas=${t.linhas}`);
      for (const r of t.primeiras) {
        console.log(`      | ${r.map((c) => c.slice(0, 22)).join(' | ')}`);
      }
    }

    const texto = await popup.evaluate(() => (document.body.innerText || '').trim());
    fs.writeFileSync(path.join(SAIDA, `popup_${ALVO}_texto.txt`), texto, 'utf-8');
    console.log(`\n  texto inicio (primeiros 600 chars):`);
    console.log(`  ${texto.slice(0, 600).replace(/\s+/g, ' ')}`);
  } else {
    console.log('\n[INFO] Nenhum popup. Verificando pagina atual apos clique.');
    const html = await page.content();
    fs.writeFileSync(path.join(SAIDA, `apos_click_${ALVO}.html`), html, 'utf-8');
    const url = page.url();
    console.log(`  url atual: ${url}`);
    console.log(`  HTML salvo.`);

    const tabelas = await page.$$eval('table', (ts) =>
      ts.map((t, i) => ({
        idx: i,
        id: t.id || '',
        linhas: t.querySelectorAll('tr').length,
      }))
    );
    tabelas.sort((a, b) => b.linhas - a.linhas);
    console.log(`  tabelas na pagina: ${tabelas.length}. Top 3: ${tabelas.slice(0, 3).map((t) => `${t.id}(${t.linhas})`).join(', ')}`);

    const texto = await page.evaluate(() => (document.body.innerText || '').trim());
    console.log(`\n  texto inicio:`);
    console.log(`  ${texto.slice(0, 800).replace(/\s+/g, ' ')}`);
  }

  await browser.close();
  console.log(`\n[OK] Artefatos em ${SAIDA}`);
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
