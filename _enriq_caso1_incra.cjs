/**
 * Enriquecimento de precatório via CNPJ da entidade devedora
 * Caminho validado em 12/04/2026:
 *   LOA (UO Devedora) → Mapa CNJ (CNPJ) → TRF1 "CPF/CNPJ da parte" → CNJ + Processo Originário
 *
 * Uso: node enriquecer_precatorio_cnpj.cjs --cnpj=00375972000160 --nome=INCRA
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : null; };

const CNPJ = getArg('cnpj') || '00375972000160';
const NOME = getArg('nome') || 'INCRA';
const OUT_DIR = 'C:/Temp/auraloa-saida/enriquecimento/';
const URL_BUSCA = 'https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1';

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n========================================`);
  console.log(`ENRIQUECIMENTO VIA CNPJ — ${NOME}`);
  console.log(`CNPJ: ${CNPJ}`);
  console.log(`========================================\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ETAPA 1: Buscar por CNPJ
  console.log('[1] Buscando por CNPJ no TRF1...');
  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  const campo = page.locator('input#cpf_cnpj');
  await campo.fill(CNPJ);
  await page.locator('input#enviar').click();
  await page.waitForTimeout(4000);

  // ETAPA 2: Clicar no nome da entidade
  console.log('[2] Clicando no nome da entidade...');
  const linkEntidade = page.locator('a').filter({ hasText: new RegExp(NOME.slice(0, 15), 'i') }).first();
  try {
    await linkEntidade.waitFor({ timeout: 10000 });
    const textoLink = await linkEntidade.innerText();
    console.log(`  Encontrado: "${textoLink.trim().slice(0, 80)}"`);
    await linkEntidade.click();
    await page.waitForTimeout(5000);
  } catch (e) {
    console.log(`  ERRO: Link da entidade não encontrado. Tentando clicar no primeiro link de parte...`);
    const primeiroLink = page.locator('table a').first();
    await primeiroLink.click();
    await page.waitForTimeout(5000);
  }

  await page.screenshot({ path: `${OUT_DIR}${NOME}_lista.png`, fullPage: true });

  // ETAPA 3: Extrair tabela de processos
  console.log('[3] Extraindo tabela de processos...');
  const processos = [];

  // Paginação — pode ter várias páginas
  let paginaAtual = 1;
  let temProxima = true;

  while (temProxima) {
    console.log(`  Página ${paginaAtual}...`);
    const linhas = await page.locator('table tr').all();

    for (const linha of linhas) {
      const celulas = await linha.locator('td').all();
      if (celulas.length >= 2) {
        try {
          const numProcesso = (await celulas[0].innerText({ timeout: 1000 })).trim();
          const procOriginario = (await celulas[1].innerText({ timeout: 1000 })).trim();

          if (numProcesso && /\d{5,}/.test(numProcesso.replace(/[.\-\/]/g, ''))) {
            processos.push({
              numero_processo: numProcesso,
              processo_originario: procOriginario,
              pagina: paginaAtual,
            });
          }
        } catch (e) {}
      }
    }

    // Verificar se tem próxima página
    const btnProx = page.locator('a:has-text("Próxima"), a:has-text("próxima"), a:has-text(">>"), a:has-text(">")').last();
    try {
      const isVisible = await btnProx.isVisible({ timeout: 2000 });
      if (isVisible) {
        const href = await btnProx.getAttribute('href');
        if (href && !href.includes('javascript:void') && paginaAtual < 50) {
          await btnProx.click();
          await page.waitForTimeout(3000);
          paginaAtual++;
        } else {
          temProxima = false;
        }
      } else {
        temProxima = false;
      }
    } catch (e) {
      temProxima = false;
    }
  }

  console.log(`\n  Total extraído: ${processos.length} processos em ${paginaAtual} página(s)`);

  // ETAPA 4: Salvar CSV
  const csvPath = `${OUT_DIR}${NOME}_processos_trf1.csv`;
  const header = 'numero_processo;processo_originario;pagina\n';
  const csvBody = processos.map(p => `${p.numero_processo};${p.processo_originario};${p.pagina}`).join('\n');
  fs.writeFileSync(csvPath, header + csvBody, 'utf-8');
  console.log(`\n[4] CSV salvo: ${csvPath}`);

  // ETAPA 5: Mostrar amostra
  console.log(`\n[5] Amostra (primeiros 20):`);
  console.log(`${'Número do Processo'.padEnd(30)} | ${'Processo Originário'.padEnd(30)}`);
  console.log('-'.repeat(65));
  processos.slice(0, 20).forEach(p => {
    console.log(`${p.numero_processo.padEnd(30)} | ${p.processo_originario.padEnd(30)}`);
  });

  if (processos.length > 20) {
    console.log(`  ... e mais ${processos.length - 20} processos`);
  }

  await browser.close();

  console.log('\nConcluído.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
