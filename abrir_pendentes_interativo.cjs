// Abre webrelpubliclstpagprecatpendentes.aspx em modo visual.
// Marcos passa o CAPTCHA e envia o formulario.
// O script aguarda navegacao e salva HTML + downloads.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/pendentes_interativo';
const URL_FORM = 'https://www.tjsp.jus.br/Handlers/FileFetch.ashx';
// URL CORRETA descoberta via descobrir_url_pendentes.cjs (18/04/2026):
// path real = /cac/scp/ (HTTP, nao HTTPS). A pagina /Precatorios/... da 404.
const CANDIDATOS_URL = [
  'http://www.tjsp.jus.br/cac/scp/webRelPublicLstPagPrecatPendentes.aspx',
];

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });
  const ctx = await browser.newContext({
    viewport: null,
    acceptDownloads: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const page = await ctx.newPage();

  // Tenta URLs candidatas (primeira que abrir sem 404 vence)
  let urlAtiva = null;
  for (const u of CANDIDATOS_URL) {
    try {
      console.log(`[*] Testando: ${u}`);
      const resp = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (resp && resp.status() < 400) {
        urlAtiva = u;
        console.log(`[OK] URL viva: ${u} (status=${resp.status()})`);
        break;
      } else {
        console.log(`  status=${resp?.status()}`);
      }
    } catch (e) {
      console.log(`  erro: ${e.message?.slice(0, 80)}`);
    }
  }

  if (!urlAtiva) {
    console.error('[FATAL] Nenhuma URL candidata respondeu.');
    console.error('Marcos, digite a URL correta no browser manualmente.');
  }

  console.log('\n===========================================================');
  console.log('  BROWSER ABERTO — MARCOS:');
  console.log('  1. Preencher filtros (entidade, ano, etc.)');
  console.log('  2. Passar o CAPTCHA');
  console.log('  3. Clicar em GERAR / PESQUISAR');
  console.log('  4. Quando a lista aparecer, VOLTAR AQUI e pressionar ENTER');
  console.log('===========================================================\n');

  // Captura TODOS os downloads
  const downloads = [];
  ctx.on('page', p => {
    p.on('download', async (dl) => {
      const nome = dl.suggestedFilename();
      const dest = path.join(SAIDA, `download_${Date.now()}_${nome}`);
      await dl.saveAs(dest);
      console.log(`[DOWNLOAD] ${nome} -> ${dest}`);
      downloads.push({ nome, dest });
    });
  });
  page.on('download', async (dl) => {
    const nome = dl.suggestedFilename();
    const dest = path.join(SAIDA, `download_${Date.now()}_${nome}`);
    await dl.saveAs(dest);
    console.log(`[DOWNLOAD] ${nome} -> ${dest}`);
    downloads.push({ nome, dest });
  });

  // Aguarda ENTER no terminal
  process.stdin.setEncoding('utf-8');
  process.stdout.write('>>> Pressione ENTER quando a lista estiver na tela... ');
  await new Promise(resolve => process.stdin.once('data', resolve));

  // Captura estado atual de TODAS as paginas/frames
  console.log('\n[*] Capturando paginas abertas...');
  for (const p of ctx.pages()) {
    try {
      const url = p.url();
      const html = await p.content();
      const texto = await p.evaluate(() => document.body?.innerText || '').catch(() => '');
      const slug = url.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
      fs.writeFileSync(path.join(SAIDA, `pagina_${slug}.html`), html, 'utf-8');
      fs.writeFileSync(path.join(SAIDA, `pagina_${slug}.txt`), texto, 'utf-8');
      console.log(`  salvo: ${slug} (${html.length} bytes HTML, ${texto.length} chars texto)`);

      // Captura frames (GeneXus pode usar)
      for (const frame of p.frames()) {
        if (frame === p.mainFrame()) continue;
        try {
          const frameUrl = frame.url();
          if (!frameUrl || frameUrl === 'about:blank') continue;
          const fhtml = await frame.content();
          const ftexto = await frame.evaluate(() => document.body?.innerText || '').catch(() => '');
          const fslug = frameUrl.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
          fs.writeFileSync(path.join(SAIDA, `frame_${fslug}.html`), fhtml, 'utf-8');
          fs.writeFileSync(path.join(SAIDA, `frame_${fslug}.txt`), ftexto, 'utf-8');
          console.log(`  frame: ${fslug} (${fhtml.length} bytes)`);
        } catch (e) { /* ignora */ }
      }
    } catch (e) {
      console.log(`  erro em pagina: ${e.message?.slice(0, 80)}`);
    }
  }

  // Screenshot final da aba principal
  try {
    const shot = path.join(SAIDA, `screenshot_${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`[SHOT] ${shot}`);
  } catch (e) {}

  const relatorio = {
    gerado_em: new Date().toISOString(),
    url_ativa: urlAtiva,
    downloads,
    paginas_abertas: ctx.pages().map(p => p.url()),
  };
  fs.writeFileSync(path.join(SAIDA, '_relatorio.json'), JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\n[OK] Tudo salvo em: ${SAIDA}`);

  process.stdout.write('>>> Pressione ENTER para fechar o browser... ');
  await new Promise(resolve => process.stdin.once('data', resolve));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
