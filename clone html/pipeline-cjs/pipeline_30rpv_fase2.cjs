// Fase 2: TRF1 busca por CNPJ → lista processos com CNJ + Processo Originário
// MANTRA: mostrar bruto, não inferir
const { chromium } = require('playwright');
const fs = require('fs');

const CNPJS = [
  { cnpj: '29979036000140', nome: 'INSS / F. Regime Geral Prev. Social' },
  { cnpj: '00394411000809', nome: 'EFU - Sentenças Judiciais' },
  { cnpj: '26474056000176', nome: 'IPHAN' },
  { cnpj: '10779511000107', nome: 'Instituto Federal Fluminense' },
  { cnpj: '33787094000140', nome: 'IBGE' },
  { cnpj: '00394544000236', nome: 'Fundo Nacional de Saúde' },
];

const URL_BASE = 'https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php';
const OUT_DIR = 'C:/Temp/auraloa-saida/rpv_trf1';

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const resultados = [];

  for (const { cnpj, nome } of CNPJS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${nome}] CNPJ: ${cnpj}`);
    console.log('='.repeat(70));

    const page = await ctx.newPage();
    try {
      // Acessar consulta por CPF/CNPJ
      const url = `${URL_BASE}?secao=TRF1`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Preencher CNPJ
      const input = page.locator('input[name="cpf_cnpj"], input[id="cpf_cnpj"], input[type="text"]').first();
      await input.waitFor({ timeout: 10000 });
      await input.fill(cnpj);
      await page.waitForTimeout(500);

      // Marcar "mostrar baixados" se existir
      const chkBaixados = page.locator('input[name="mostrarBaixados"], input[id="mostrarBaixados"]');
      try { await chkBaixados.check({ timeout: 2000 }); } catch(e) {}

      // Clicar pesquisar
      await page.locator('input[type="submit"], button[type="submit"]').first().click();
      await page.waitForTimeout(4000);

      // Verificar resultado
      const bodyText = await page.locator('body').innerText();

      if (bodyText.includes('Partes encontradas') || bodyText.includes('parte(s) encontrada(s)')) {
        // Clicar no primeiro link de parte
        const parteLink = page.locator('a').filter({ hasText: /./}).first();
        const links = await page.locator('table a, .resultado a, a[href*="listar"]').all();

        let clicked = false;
        for (const link of links) {
          try {
            const href = await link.getAttribute('href');
            if (href && href.includes('listar')) {
              await link.click();
              clicked = true;
              break;
            }
          } catch(e) {}
        }

        if (!clicked) {
          // Tentar clicar em qualquer link que pareça ser o nome da parte
          try {
            await page.locator('td a').first().click();
          } catch(e) {}
        }

        await page.waitForTimeout(4000);

        // Extrair tabela de processos
        const tableText = await page.locator('body').innerText();
        const lines = tableText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Contar processos (linhas com formato CNJ)
        const cnjPattern = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
        const cnjs = tableText.match(cnjPattern) || [];
        const uniqueCnjs = [...new Set(cnjs)];

        console.log(`  Processos encontrados: ${uniqueCnjs.length}`);

        // Salvar screenshot
        await page.screenshot({ path: `${OUT_DIR}/${nome.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.png`, fullPage: true });

        // Extrair primeiros 20 processos como amostra
        const amostra = uniqueCnjs.slice(0, 20);
        console.log(`  Amostra (primeiros ${amostra.length}):`);
        amostra.forEach((c, i) => console.log(`    ${i+1}. ${c}`));

        // Procurar "Processo Originário" na tabela
        const hasOriginario = tableText.includes('Originário') || tableText.includes('originário') || tableText.includes('Origem');
        console.log(`  Tem coluna "Processo Originário": ${hasOriginario ? 'SIM ✓' : 'NÃO'}`);

        // Salvar texto bruto para análise
        fs.writeFileSync(`${OUT_DIR}/${nome.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_raw.txt`, tableText, 'utf-8');

        resultados.push({
          cnpj, nome,
          total_processos: uniqueCnjs.length,
          tem_originario: hasOriginario,
          amostra_cnjs: amostra.slice(0, 5),
          status: 'OK'
        });
      } else if (bodyText.includes('Nenhum') || bodyText.includes('não encontr')) {
        console.log('  Nenhum processo encontrado');
        resultados.push({ cnpj, nome, total_processos: 0, status: 'NENHUM' });
      } else {
        console.log('  Resultado inesperado. Salvando screenshot...');
        await page.screenshot({ path: `${OUT_DIR}/${cnpj}_inesperado.png`, fullPage: true });
        // Salvar texto bruto
        fs.writeFileSync(`${OUT_DIR}/${cnpj}_raw.txt`, bodyText.slice(0, 5000), 'utf-8');
        resultados.push({ cnpj, nome, total_processos: 0, status: 'INESPERADO' });
      }
    } catch (e) {
      console.log(`  ERRO: ${e.message.slice(0, 150)}`);
      resultados.push({ cnpj, nome, total_processos: 0, status: `ERRO: ${e.message.slice(0, 80)}` });
    }
    await page.close();
  }

  // Resumo final
  console.log(`\n${'='.repeat(70)}`);
  console.log('RESUMO FASE 2 — TRF1 por CNPJ');
  console.log('='.repeat(70));
  let totalProc = 0;
  for (const r of resultados) {
    console.log(`  ${r.nome.slice(0, 35).padEnd(35)} | CNPJ: ${r.cnpj} | Processos: ${r.total_processos} | ${r.status}`);
    totalProc += r.total_processos;
  }
  console.log(`\n  TOTAL processos encontrados: ${totalProc}`);

  // Salvar resultados JSON
  fs.writeFileSync(`${OUT_DIR}/resumo_fase2.json`, JSON.stringify(resultados, null, 2), 'utf-8');
  console.log(`  Salvo: ${OUT_DIR}/resumo_fase2.json`);

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
