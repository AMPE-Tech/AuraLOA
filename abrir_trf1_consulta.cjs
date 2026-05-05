// Abre 3 abas TRF1 para consulta interativa
// Marcos acompanha no browser real (headless:false)

const { chromium } = require('playwright');

const PRECATORIO = '3650677-92.2024.4.01.0000';
const EXECUCAO = '0000517-32.2016.4.01.9198';

(async () => {
  console.log('Abrindo Chromium com 3 abas TRF1...');
  console.log('  Precatorio: ' + PRECATORIO);
  console.log('  Execucao:   ' + EXECUCAO);
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });
  const ctx = await browser.newContext({
    viewport: null,
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  });

  // Aba 1 — Portal precatorios TRF1 (pesquisa por Numero do Precatorio)
  const p1 = await ctx.newPage();
  await p1.goto('https://precatorios.trf1.jus.br/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('  Aba 1 erro: ' + e.message.slice(0,80)));
  console.log('[1] Portal Precatorios TRF1: ' + p1.url());

  // Aba 2 — PJe-TRF1 consulta publica 1o grau (para CNJ de execucao)
  const p2 = await ctx.newPage();
  const pjeUrl = 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam';
  await p2.goto(pjeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('  Aba 2 erro: ' + e.message.slice(0,80)));
  console.log('[2] PJe-TRF1 1g: ' + p2.url());

  // Aba 3 — Sistema antigo TRF1 (processual) — aceita num de processo ou CPF/CNPJ
  const p3 = await ctx.newPage();
  await p3.goto('https://processual.trf1.jus.br/consultaProcessual/index.php', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('  Aba 3 erro: ' + e.message.slice(0,80)));
  console.log('[3] Processual TRF1: ' + p3.url());

  console.log('');
  console.log('===========================================================');
  console.log('  3 ABAS ABERTAS — MARCOS ACOMPANHA NO CHROMIUM:');
  console.log('');
  console.log('  Aba 1: Portal Precatorios TRF1');
  console.log('    -> Pesquisa pelo N do precatorio: ' + PRECATORIO);
  console.log('');
  console.log('  Aba 2: PJe-TRF1 Consulta Publica');
  console.log('    -> CNJ de execucao: ' + EXECUCAO);
  console.log('    -> PJe tem AJAX + reCAPTCHA — preencher e clicar "Pesquisar"');
  console.log('');
  console.log('  Aba 3: Sistema antigo processual.trf1');
  console.log('    -> Tambem aceita o numero de execucao');
  console.log('    -> Menos restricoes de CAPTCHA que o PJe');
  console.log('');
  console.log('  Pressione ENTER aqui quando terminar de consultar');
  console.log('  (o script fica vivo ate voce pressionar)');
  console.log('===========================================================');

  process.stdin.setEncoding('utf-8');
  await new Promise(resolve => process.stdin.once('data', resolve));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
