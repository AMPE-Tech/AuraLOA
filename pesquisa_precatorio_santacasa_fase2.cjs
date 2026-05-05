/**
 * Fase 2 — Aprofundamento da pesquisa Santa Casa
 * ─────────────────────────────────────────────────
 * Fase 1 encontrou:
 *   - "IRMANDADE DA SANTA CASA" → 1 processo: (PRC)0181820-42.2017.4.01.9198
 *   - "SANTA CASA DE MISERICORDIA" → 2 processos (NÃO expandido)
 *   - CNJ 1061297-10.2020.4.01.3400 → NÃO encontrado na seção JFDF
 *
 * Esta fase:
 *   1. Expande a 2ª parte para ver os 2 processos
 *   2. Acessa detalhes do PRC encontrado (0181820-42.2017.4.01.9198)
 *   3. Tenta CNJ em seções alternativas (TRF1, DF)
 *   4. Busca pelo processo originário do ofício (2002.34.00.036764-1)
 *   5. Busca pelo advogado (Edvaldo Nilo de Almeida)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Temp/auraloa-saida/pesquisa_santacasa';
fs.mkdirSync(SAIDA, { recursive: true });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(SAIDA, 'pesquisa_fase2.log'), line + '\n');
}

async function screenshot(page, nome) {
  await page.screenshot({ path: path.join(SAIDA, `${nome}.png`), fullPage: true });
}

async function salvarTexto(page, nome) {
  const t = await page.locator('body').innerText();
  fs.writeFileSync(path.join(SAIDA, `${nome}.txt`), t, 'utf-8');
  return t;
}

(async () => {
  log('═══════════════════════════════════════════════════════════');
  log('  FASE 2 — Aprofundamento Santa Casa PP');
  log('═══════════════════════════════════════════════════════════');

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  const resultado = { fase2: [], precatorio_detalhes: null, processos_santa_casa: [] };

  // ── ETAPA 1: Expandir "SANTA CASA DE MISERICORDIA" (2 processos) ─────────
  log('\n════ ETAPA 1: Expandir 2ª parte (2 processos) ════');
  try {
    const url = 'https://processual.trf1.jus.br/consultaProcessual/parte/listarPorCpfCnpj.php?cpf_cnpj=55344337000108&secao=TRF1&enviar=Pesquisar';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Clicar na SEGUNDA parte (SANTA CASA DE MISERICORDIA — sem "IRMANDADE")
    const links = await page.locator('a').all();
    for (const link of links) {
      const texto = await link.innerText().catch(() => '');
      if (texto.includes('SANTA CASA DE MISERICORDIA DE PRESIDENTE PRUDENTE') && !texto.includes('IRMANDADE')) {
        log('Encontrou link da 2ª parte — clicando...');
        await link.click();
        await page.waitForTimeout(3000);
        break;
      }
    }

    await screenshot(page, 'f2_01_segunda_parte_expandida');
    const texto = await salvarTexto(page, 'f2_01_segunda_parte_expandida');
    log(`Texto extraído (${texto.length} chars)`);

    // Extrair processos
    const regexProc = /\((\w+)\)\s*([\d.-]+)/g;
    let m;
    while ((m = regexProc.exec(texto)) !== null) {
      resultado.processos_santa_casa.push({ tipo: m[1], numero: m[2] });
      log(`  Processo: (${m[1]}) ${m[2]}${m[1] === 'PRC' ? ' ← PRECATÓRIO' : ''}`);
    }

    // Buscar também links de processos na página
    const linksProc = await page.locator('a[href*="processo.php"]').all();
    for (const lp of linksProc) {
      const href = await lp.getAttribute('href').catch(() => '');
      const txt = await lp.innerText().catch(() => '');
      if (txt.trim()) log(`  Link processo: ${txt.trim()} → ${href}`);
    }
  } catch (err) {
    log(`ERRO Etapa 1: ${err.message}`);
  }

  // ── ETAPA 2: Detalhes do PRC encontrado ──────────────────────────────────
  log('\n════ ETAPA 2: Detalhes do precatório (PRC)0181820-42.2017.4.01.9198 ════');
  try {
    const urlPrc = 'https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=01818204220174019198&secao=TRF1&pg=1&enviar=Pesquisar';
    log(`Acessando: ${urlPrc}`);
    await page.goto(urlPrc, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await screenshot(page, 'f2_02_precatorio_detalhes');
    const textoPrc = await salvarTexto(page, 'f2_02_precatorio_detalhes');
    log(`Dados do precatório (${textoPrc.length} chars)`);

    // Extrair dados relevantes
    const campos = ['Classe', 'Assunto', 'Distribuição', 'Autuação', 'Juiz', 'Vara', 'Processo Originário', 'Valor'];
    for (const campo of campos) {
      const regex = new RegExp(`${campo}[:\\s]*([^\\n]+)`, 'i');
      const match = textoPrc.match(regex);
      if (match) log(`  ${campo}: ${match[1].trim()}`);
    }

    // Clicar aba Partes
    try {
      const abaPartes = page.locator('a', { hasText: /Partes/i }).first();
      if (await abaPartes.isVisible({ timeout: 3000 })) {
        await abaPartes.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'f2_02b_precatorio_partes');
        const textoPartes = await salvarTexto(page, 'f2_02b_precatorio_partes');
        log(`  Partes: ${textoPartes.substring(0, 300)}`);
      }
    } catch (e) {}

    // Clicar aba Movimentação
    try {
      const abaMovim = page.locator('a', { hasText: /Movimenta/i }).first();
      if (await abaMovim.isVisible({ timeout: 3000 })) {
        await abaMovim.click();
        await page.waitForTimeout(3000);
        await screenshot(page, 'f2_02c_precatorio_movimentacoes');
        const textoMovim = await salvarTexto(page, 'f2_02c_precatorio_movimentacoes');

        // Buscar códigos de pagamento
        const codigos = {
          '10100': 'Distribuição Automática',
          '50100': 'Autuado Como',
          '40100': 'Proposta Orçamentária',
          '180500': 'Documento Juntado',
          '40900': '💰 VALOR DEPOSITADO',
          '40910': '✅ SAQUE REALIZADO',
        };

        for (const [cod, desc] of Object.entries(codigos)) {
          if (textoMovim.includes(cod)) {
            log(`  Movimentação ${cod}: ${desc}`);
          }
        }

        // Extrair todas as movimentações com datas
        const regexMovim = /(\d{2}\/\d{2}\/\d{4})\s+([\d]+)\s*[-–]\s*([^\n]+)/g;
        let mm;
        let count = 0;
        while ((mm = regexMovim.exec(textoMovim)) !== null && count < 20) {
          log(`  ${mm[1]} | Cod ${mm[2]} | ${mm[3].trim()}`);
          count++;
        }
      }
    } catch (e) {
      log(`  Movimentação erro: ${e.message}`);
    }
  } catch (err) {
    log(`ERRO Etapa 2: ${err.message}`);
  }

  // ── ETAPA 3: CNJ em seções alternativas ──────────────────────────────────
  log('\n════ ETAPA 3: CNJ em seções alternativas ════');
  const secoes = ['TRF1', 'DF', 'JFDF'];
  const cnjFormats = [
    '10612971020204013400',
    '1061297-10.2020.4.01.3400',
  ];

  for (const secao of secoes) {
    for (const cnj of cnjFormats) {
      try {
        const cnjClean = cnj.replace(/[^0-9]/g, '');
        const url = `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${cnjClean}&secao=${secao}&pg=1&enviar=Pesquisar`;
        log(`Testando CNJ ${cnjClean} seção ${secao}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        const texto = await page.locator('body').innerText();

        if (!texto.includes('não foi encontrado') && !texto.includes('Nenhum processo') &&
            (texto.includes('Partes') || texto.includes('Classe') || texto.includes('Movimenta'))) {
          log(`  ✅ ENCONTRADO na seção ${secao}`);
          await screenshot(page, `f2_03_cnj_${secao}`);
          await salvarTexto(page, `f2_03_cnj_${secao}`);
          resultado.fase2.push({ etapa: 3, secao, status: 'ENCONTRADO' });
          break;
        } else {
          log(`  ✗ Não encontrado na seção ${secao}`);
        }
      } catch (e) {
        log(`  ✗ Erro seção ${secao}: ${e.message}`);
      }
    }
  }

  // ── ETAPA 4: Busca pelo advogado Edvaldo Nilo de Almeida ─────────────────
  log('\n════ ETAPA 4: Busca pelo advogado OAB DF29502 ════');
  try {
    const urlAdv = 'https://processual.trf1.jus.br/consultaProcessual/advogado/listarPorOabAdvogado.php?oab=29502&uf=DF&secao=TRF1&enviar=Pesquisar';
    log(`Acessando: ${urlAdv}`);
    await page.goto(urlAdv, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await screenshot(page, 'f2_04_advogado');
    const textoAdv = await salvarTexto(page, 'f2_04_advogado');

    // Contar processos
    const matchNum = textoAdv.match(/Número de processos[:\s]*(\d+)/i);
    if (matchNum) {
      log(`  Processos do advogado: ${matchNum[1]}`);
    }

    // Expandir para ver processos
    try {
      const linkAdv = page.locator('a', { hasText: /EDVALDO/i }).first();
      if (await linkAdv.isVisible({ timeout: 3000 })) {
        await linkAdv.click();
        await page.waitForTimeout(3000);
        await screenshot(page, 'f2_04b_advogado_processos');
        const textoAdvExp = await salvarTexto(page, 'f2_04b_advogado_processos');

        // Buscar processos com Santa Casa ou PRC
        const regexP = /\((\w+)\)\s*([\d.-]+)/g;
        let mp;
        while ((mp = regexP.exec(textoAdvExp)) !== null) {
          const isPrc = mp[1] === 'PRC';
          if (isPrc || textoAdvExp.includes('SANTA CASA')) {
            log(`  Processo advogado: (${mp[1]}) ${mp[2]}${isPrc ? ' ← PRECATÓRIO' : ''}`);
          }
        }
      }
    } catch (e) {}
  } catch (err) {
    log(`ERRO Etapa 4: ${err.message}`);
  }

  // ── ETAPA 5: Busca pelo processo originário do ofício ────────────────────
  log('\n════ ETAPA 5: Busca pelo processo originário antigo (2002.34.00.036764-1) ════');
  try {
    // O PRC encontrado aponta para 2002.34.00.036764-1 como originário
    // Verificar se é o MESMO caso da Santa Casa
    const procOrig = '200234000367641';
    const url = `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${procOrig}&secao=JFDF&pg=1&enviar=Pesquisar`;
    log(`Acessando processo originário: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    await screenshot(page, 'f2_05_proc_originario');
    const textoOrig = await salvarTexto(page, 'f2_05_proc_originario');

    if (!textoOrig.includes('não foi encontrado')) {
      log('  Processo originário ENCONTRADO');
      const campos = ['Classe', 'Assunto', 'Distribuição', 'Valor'];
      for (const campo of campos) {
        const regex = new RegExp(`${campo}[:\\s]*([^\\n]+)`, 'i');
        const match = textoOrig.match(regex);
        if (match) log(`  ${campo}: ${match[1].trim()}`);
      }
    } else {
      log('  Processo originário não encontrado no sistema antigo');
    }
  } catch (err) {
    log(`ERRO Etapa 5: ${err.message}`);
  }

  // ── RESULTADO FINAL ──────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════════════════════');
  log('  RESULTADO FASE 2');
  log('═══════════════════════════════════════════════════════════');
  log(`  Processos Santa Casa (2ª parte): ${resultado.processos_santa_casa.length}`);
  log(`  Precatórios encontrados: ${resultado.processos_santa_casa.filter(p => p.tipo === 'PRC').length}`);
  log(`  Arquivos salvos em: ${SAIDA}`);
  log('═══════════════════════════════════════════════════════════');

  fs.writeFileSync(path.join(SAIDA, 'resultado_fase2.json'), JSON.stringify(resultado, null, 2), 'utf-8');
  log('JSON salvo: resultado_fase2.json');

  log('\nFechando browser em 5 segundos...');
  await page.waitForTimeout(5000);
  await browser.close();
  log('Fase 2 concluída.');
})().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
