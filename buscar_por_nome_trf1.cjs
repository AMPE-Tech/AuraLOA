/**
 * Busca por NOME DA PARTE no TRF1 (opção 2 das 8 literais)
 * Retorna TODOS os processos da entidade, independente de CNPJ filial
 */
const { chromium } = require('playwright');
const fs = require('fs');

const args = process.argv.slice(2);
const getArg = (name) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : null; };

const NOME_BUSCA = getArg('nome') || 'DEPARTAMENTO NACIONAL DE INFRAESTRUTURA';
const LABEL = getArg('label') || 'DNIT';
const URL_BUSCA = 'https://processual.trf1.jus.br/consultaProcessual/nomeParte.php?secao=TRF1';
const OUT_DIR = 'C:/Temp/auraloa-saida/enriquecimento/';

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n========================================`);
  console.log(`BUSCA POR NOME — ${LABEL}`);
  console.log(`Nome: "${NOME_BUSCA}"`);
  console.log(`========================================\n`);

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log('[1] Abrindo busca por Nome da Parte...');
  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Preencher nome
  const campo = page.locator('input[type="text"]:visible').first();
  await campo.fill(NOME_BUSCA);
  await page.waitForTimeout(500);

  // Submit
  await page.locator('input[type="submit"]:visible').first().click();
  console.log('[2] Submetido, aguardando resultado...');
  await page.waitForTimeout(5000);

  await page.screenshot({ path: `${OUT_DIR}${LABEL}_nome_resultado.png`, fullPage: true });

  // Extrair resultado bruto
  const texto = await page.locator('body').innerText();
  console.log('\n[3] RESULTADO (primeiros 3000 chars):');
  console.log(texto.slice(0, 3000));

  // Tentar encontrar links de entidades
  const links = await page.locator('table a, .listagem a').all();
  console.log(`\n[4] Links encontrados: ${links.length}`);
  for (let i = 0; i < Math.min(links.length, 15); i++) {
    try {
      const t = (await links[i].innerText({ timeout: 500 })).trim();
      if (t.length > 5) console.log(`  ${i+1}. "${t.slice(0, 80)}"`);
    } catch(e) {}
  }

  // Se tem links, clicar no primeiro que contenha o nome
  const linkAlvo = page.locator('a').filter({ hasText: new RegExp(LABEL.slice(0, 10), 'i') }).first();
  try {
    await linkAlvo.waitFor({ timeout: 5000 });
    console.log('\n[5] Clicando no link da entidade...');
    await linkAlvo.click();
    await page.waitForTimeout(5000);

    await page.screenshot({ path: `${OUT_DIR}${LABEL}_nome_processos.png`, fullPage: true });

    // Extrair tabela
    const processos = [];
    const linhas = await page.locator('table tr').all();
    for (const linha of linhas) {
      const celulas = await linha.locator('td').all();
      if (celulas.length >= 2) {
        try {
          const numProc = (await celulas[0].innerText({ timeout: 500 })).trim();
          const procOrig = (await celulas[1].innerText({ timeout: 500 })).trim();
          if (numProc && /\d{5,}/.test(numProc.replace(/[.\-\/]/g, ''))) {
            processos.push({ numero_processo: numProc, processo_originario: procOrig });
          }
        } catch(e) {}
      }
    }

    console.log(`\n[6] Processos extraídos: ${processos.length}`);
    const prc = processos.filter(p => p.numero_processo.includes('(PRC)'));
    const rpv = processos.filter(p => p.numero_processo.includes('(RPV)'));
    console.log(`  PRC: ${prc.length} | RPV: ${rpv.length}`);

    // Salvar CSV
    const csvPath = `${OUT_DIR}${LABEL}_NOME_processos_trf1.csv`;
    const header = 'numero_processo;processo_originario\n';
    const body = processos.map(p => `${p.numero_processo};${p.processo_originario}`).join('\n');
    fs.writeFileSync(csvPath, header + body, 'utf-8');
    console.log(`\n[7] CSV: ${csvPath}`);

    // Amostra PRC
    if (prc.length > 0) {
      console.log(`\nPRC (primeiros 20):`);
      prc.slice(0, 20).forEach(p => console.log(`  ${p.numero_processo} | ${p.processo_originario}`));
    }
  } catch(e) {
    console.log(`\n  Não encontrou link clicável: ${e.message.slice(0, 100)}`);
    console.log('  Pode ser necessário refinar o nome de busca.');
  }

  console.log('\n[*] Aguardando 20s...');
  await page.waitForTimeout(20000);
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
