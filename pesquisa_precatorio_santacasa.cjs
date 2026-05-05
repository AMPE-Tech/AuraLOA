/**
 * Pesquisa completa de precatório — Santa Casa de Misericórdia de Presidente Prudente
 * ─────────────────────────────────────────────────────────────────────────────
 * Roteiro validado em 08/04/2026 (ref: memory/reference_passo_a_passo_consulta_trf1.md)
 *
 * FLUXO:
 *   1. Consulta processual TRF1 por CNPJ → lista todos os processos
 *   2. Busca direta pelo CNJ 1061297-10.2020.4.01.3400
 *   3. Busca precatórios (PRC) vinculados na seção 9198
 *   4. Extrai movimentações (40900=depósito, 40910=saque)
 *   5. Salva screenshots + JSON com todos os dados
 *
 * USO:
 *   node pesquisa_precatorio_santacasa.cjs
 *
 * DADOS DO OFÍCIO REQUISITÓRIO:
 *   Nº Requisição: 2024.3400.006.001056
 *   CNJ: 1061297-10.2020.4.01.3400
 *   Credor: Santa Casa de Misericórdia de Presidente Prudente
 *   CNPJ: 55.344.337/0001-08
 *   Valor Total: R$ 235.492.820,70
 *   Advogado: Edvaldo Nilo de Almeida — OAB DF29502
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── DADOS DO PRECATÓRIO ──────────────────────────────────────────────────────
const DADOS = {
  cnpj: '55344337000108',
  cnpjFormatado: '55.344.337/0001-08',
  cnj: '1061297-10.2020.4.01.3400',
  cnjDigits: '10612971020204013400',
  nrRequisicao: '2024.3400.006.001056',
  credor: 'SANTA CASA DE MISERICORDIA DE PRESIDENTE PRUDENTE',
  devedor: 'UNIAO FEDERAL',
  valorTotal: 235492820.70,
  advogado: 'EDVALDO NILO DE ALMEIDA',
  oab: 'DF29502',
};

const SAIDA = 'C:/Temp/auraloa-saida/pesquisa_santacasa';
fs.mkdirSync(SAIDA, { recursive: true });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(SAIDA, 'pesquisa.log'), line + '\n');
}

function salvarScreenshot(page, nome) {
  const file = path.join(SAIDA, `${nome}.png`);
  return page.screenshot({ path: file, fullPage: true });
}

async function salvarTexto(page, nome) {
  const texto = await page.locator('body').innerText();
  fs.writeFileSync(path.join(SAIDA, `${nome}.txt`), texto, 'utf-8');
  return texto;
}

(async () => {
  log('═══════════════════════════════════════════════════════════');
  log('  AuraLOA — Pesquisa de Precatório');
  log(`  Credor: ${DADOS.credor}`);
  log(`  CNPJ: ${DADOS.cnpjFormatado}`);
  log(`  CNJ: ${DADOS.cnj}`);
  log(`  Valor: R$ ${DADOS.valorTotal.toLocaleString('pt-BR')}`);
  log('═══════════════════════════════════════════════════════════');

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  const resultado = {
    dados_oficio: DADOS,
    consultas: [],
    processos_encontrados: [],
    precatorios: [],
    movimentacoes: [],
    status_pagamento: 'NAO_VERIFICADO',
    timestamp: new Date().toISOString(),
  };

  // ── FASE 1: Consulta por CNPJ no sistema processual antigo ────────────────
  log('\n════ FASE 1: Consulta por CNPJ — Sistema Processual TRF1 ════');
  try {
    const urlCnpj = `https://processual.trf1.jus.br/consultaProcessual/parte/listarPorCpfCnpj.php?cpf_cnpj=${DADOS.cnpj}&secao=TRF1&enviar=Pesquisar`;
    log(`Acessando: ${urlCnpj}`);
    await page.goto(urlCnpj, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await salvarScreenshot(page, '01_cnpj_resultado');
    const textoCnpj = await salvarTexto(page, '01_cnpj_resultado');

    // Contar processos encontrados
    const matchProcessos = textoCnpj.match(/Número de processos:\s*(\d+)/i);
    if (matchProcessos) {
      log(`Processos encontrados para CNPJ: ${matchProcessos[1]}`);
      resultado.consultas.push({
        fase: 1,
        tipo: 'CNPJ',
        url: urlCnpj,
        processos: parseInt(matchProcessos[1]),
        status: 'OK',
      });
    } else {
      log('Resultado da busca por CNPJ — verificar screenshot');
      resultado.consultas.push({ fase: 1, tipo: 'CNPJ', url: urlCnpj, status: 'VER_SCREENSHOT' });
    }

    // Tentar expandir lista de processos (clicar no nome)
    try {
      const linkParte = page.locator('a', { hasText: /SANTA CASA/i }).first();
      if (await linkParte.isVisible()) {
        log('Clicando para expandir lista de processos...');
        await linkParte.click();
        await page.waitForTimeout(3000);
        await salvarScreenshot(page, '01b_cnpj_expandido');
        const textoExpandido = await salvarTexto(page, '01b_cnpj_expandido');

        // Extrair números de processo
        const regexProcesso = /\((\w+)\)\s*([\d.-]+)/g;
        let match;
        while ((match = regexProcesso.exec(textoExpandido)) !== null) {
          resultado.processos_encontrados.push({
            tipo: match[1],
            numero: match[2],
            is_precatorio: match[1] === 'PRC',
          });
          log(`  Processo: (${match[1]}) ${match[2]}${match[1] === 'PRC' ? ' ← PRECATÓRIO' : ''}`);
        }
      }
    } catch (e) {
      log(`Aviso: não conseguiu expandir lista — ${e.message}`);
    }
  } catch (err) {
    log(`ERRO Fase 1: ${err.message}`);
    resultado.consultas.push({ fase: 1, tipo: 'CNPJ', status: 'ERRO', erro: err.message });
  }

  // ── FASE 2: Consulta direta pelo CNJ do processo ──────────────────────────
  log('\n════ FASE 2: Consulta direta pelo CNJ ════');
  try {
    const urlCnj = `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${DADOS.cnjDigits}&secao=JFDF&pg=1&enviar=Pesquisar`;
    log(`Acessando: ${urlCnj}`);
    await page.goto(urlCnj, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await salvarScreenshot(page, '02_cnj_direto');
    const textoCnj = await salvarTexto(page, '02_cnj_direto');

    if (textoCnj.includes('não foi encontrado') || textoCnj.includes('Nenhum processo')) {
      log('Processo NAO encontrado por CNJ direto');
      resultado.consultas.push({ fase: 2, tipo: 'CNJ_DIRETO', status: 'NAO_ENCONTRADO' });
    } else if (textoCnj.includes('Partes') || textoCnj.includes('Movimenta') || textoCnj.includes('Classe')) {
      log('Processo ENCONTRADO por CNJ direto');
      resultado.consultas.push({ fase: 2, tipo: 'CNJ_DIRETO', status: 'ENCONTRADO' });

      // Extrair informações
      const matchClasse = textoCnj.match(/Classe[:\s]*([^\n]+)/i);
      const matchAssunto = textoCnj.match(/Assunto[:\s]*([^\n]+)/i);
      const matchOrig = textoCnj.match(/Processo\s+Origin[áa]rio[:\s]*([^\n]+)/i);
      const matchDistrib = textoCnj.match(/Distribu[ií][çc][ãa]o[:\s]*([^\n]+)/i);

      if (matchClasse) log(`  Classe: ${matchClasse[1].trim()}`);
      if (matchAssunto) log(`  Assunto: ${matchAssunto[1].trim()}`);
      if (matchOrig) log(`  Processo Originário: ${matchOrig[1].trim()}`);
      if (matchDistrib) log(`  Distribuição: ${matchDistrib[1].trim()}`);

      // Tentar clicar na aba Movimentação
      try {
        const abaMovim = page.locator('a', { hasText: /Movimenta/i }).first();
        if (await abaMovim.isVisible()) {
          log('Abrindo aba Movimentação...');
          await abaMovim.click();
          await page.waitForTimeout(3000);
          await salvarScreenshot(page, '02b_movimentacoes');
          const textoMovim = await salvarTexto(page, '02b_movimentacoes');

          // Buscar códigos de movimentação relevantes
          if (textoMovim.includes('40900') || textoMovim.toLowerCase().includes('valor depositado')) {
            log('  ✅ DEPÓSITO IDENTIFICADO (código 40900)');
            resultado.status_pagamento = 'DEPOSITO_IDENTIFICADO';
          }
          if (textoMovim.includes('40910') || textoMovim.toLowerCase().includes('saque')) {
            log('  ✅ SAQUE REALIZADO (código 40910)');
            resultado.status_pagamento = 'SAQUE_REALIZADO';
          }
          if (textoMovim.includes('50100')) {
            log('  📋 Autuado como precatório (código 50100)');
          }
          if (textoMovim.includes('40100')) {
            log('  📋 Proposta orçamentária enviada (código 40100)');
          }
        }
      } catch (e) {
        log(`Aviso: aba Movimentação — ${e.message}`);
      }

      // Tentar clicar na aba Partes
      try {
        const abaPartes = page.locator('a', { hasText: /Partes/i }).first();
        if (await abaPartes.isVisible()) {
          log('Abrindo aba Partes...');
          await abaPartes.click();
          await page.waitForTimeout(2000);
          await salvarScreenshot(page, '02c_partes');
          await salvarTexto(page, '02c_partes');
        }
      } catch (e) {}
    } else {
      log('Resultado ambíguo — verificar screenshot');
      resultado.consultas.push({ fase: 2, tipo: 'CNJ_DIRETO', status: 'AMBIGUO' });
    }
  } catch (err) {
    log(`ERRO Fase 2: ${err.message}`);
    resultado.consultas.push({ fase: 2, tipo: 'CNJ_DIRETO', status: 'ERRO', erro: err.message });
  }

  // ── FASE 3: Busca do precatório na seção 9198 ────────────────────────────
  log('\n════ FASE 3: Busca de precatório (seção 9198) ════');
  // O nº da requisição 2024.3400.006.001056 pode ser mapeado para CNJ do precatório
  // Formato típico do TRF1: (PRC) NNNNNNN-NN.AAAA.4.01.9198
  const variantesPRC = [
    // Tentar pelo número do processo originário na seção de precatórios
    `${DADOS.cnjDigits.substring(0, 13)}9198`,
    // Tentar variações comuns
    `10612971020204019198`,
  ];

  for (const v of variantesPRC) {
    try {
      const urlPrc = `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${v}&secao=TRF1&pg=1&enviar=Pesquisar`;
      log(`Testando variante PRC: ${v}`);
      await page.goto(urlPrc, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const texto = await page.locator('body').innerText();

      if (!texto.includes('não foi encontrado') && (texto.includes('Partes') || texto.includes('Precatório') || texto.includes('Movimenta'))) {
        log(`  ✅ PRECATÓRIO ENCONTRADO com variante: ${v}`);
        await salvarScreenshot(page, `03_precatorio_${v}`);
        await salvarTexto(page, `03_precatorio_${v}`);
        resultado.precatorios.push({ variante: v, status: 'ENCONTRADO' });

        // Movimentação do precatório
        try {
          const abaMovim = page.locator('a', { hasText: /Movimenta/i }).first();
          if (await abaMovim.isVisible()) {
            await abaMovim.click();
            await page.waitForTimeout(3000);
            await salvarScreenshot(page, `03b_precatorio_movimentacoes`);
            const textoMovim = await salvarTexto(page, `03b_precatorio_movimentacoes`);

            if (textoMovim.includes('40900') || textoMovim.toLowerCase().includes('depositado')) {
              resultado.status_pagamento = 'DEPOSITO_IDENTIFICADO';
              log('  ✅ DEPÓSITO no precatório');
            }
            if (textoMovim.includes('40910') || textoMovim.toLowerCase().includes('saque')) {
              resultado.status_pagamento = 'SAQUE_REALIZADO';
              log('  ✅ SAQUE no precatório');
            }
          }
        } catch (e) {}
        break;
      } else {
        log(`  ✗ Variante ${v} — não encontrado`);
      }
    } catch (e) {
      log(`  ✗ Variante ${v} — erro: ${e.message}`);
    }
  }

  // ── FASE 4: PJe TRF1 Consulta Pública ────────────────────────────────────
  log('\n════ FASE 4: PJe TRF1 — Consulta Pública ════');
  try {
    const urlPje = 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam';
    log(`Acessando PJe: ${urlPje}`);
    await page.goto(urlPje, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Tentar preencher campo de CNPJ
    try {
      // Selecionar radio CNPJ
      const radioCnpj = page.locator('input[type="radio"][value="CNPJ"]');
      if (await radioCnpj.isVisible()) {
        await radioCnpj.click();
        await page.waitForTimeout(500);
      }

      // Campo de documento
      const campoDoc = page.locator('input[id*="documento"], input[id*="Documento"], input[name*="documento"]').first();
      if (await campoDoc.isVisible()) {
        await campoDoc.fill(DADOS.cnpj);
        log('CNPJ preenchido no PJe');

        // Botão pesquisar
        const btnPesq = page.locator('input[value="Pesquisar"], button:has-text("Pesquisar")').first();
        if (await btnPesq.isVisible()) {
          await btnPesq.click();
          await page.waitForTimeout(5000);
          await salvarScreenshot(page, '04_pje_resultado');
          const textoPje = await salvarTexto(page, '04_pje_resultado');
          log(`PJe resultado: ${textoPje.substring(0, 200)}...`);
          resultado.consultas.push({ fase: 4, tipo: 'PJE_CNPJ', status: 'OK' });
        }
      } else {
        // Tentar campo de processo
        const campoProc = page.locator('input[id*="processo"], input[id*="Processo"]').first();
        if (await campoProc.isVisible()) {
          await campoProc.fill(DADOS.cnj);
          log('CNJ preenchido no PJe');
          const btnPesq = page.locator('input[value="Pesquisar"], button:has-text("Pesquisar")').first();
          if (await btnPesq.isVisible()) {
            await btnPesq.click();
            await page.waitForTimeout(5000);
            await salvarScreenshot(page, '04_pje_resultado');
            await salvarTexto(page, '04_pje_resultado');
            resultado.consultas.push({ fase: 4, tipo: 'PJE_CNJ', status: 'OK' });
          }
        }
      }
    } catch (e) {
      log(`PJe preenchimento — ${e.message}`);
      await salvarScreenshot(page, '04_pje_erro');
    }
  } catch (err) {
    log(`ERRO Fase 4: ${err.message}`);
    resultado.consultas.push({ fase: 4, tipo: 'PJE', status: 'ERRO', erro: err.message });
  }

  // ── FASE 5: e-PrecWeb (certidão) ─────────────────────────────────────────
  log('\n════ FASE 5: e-PrecWeb — Certidão de Precatório ════');
  try {
    const urlPrec = 'https://eprecweb.trf1.jus.br/precatorio/certidao/emitirCertidao.seam';
    log(`Acessando: ${urlPrec}`);
    await page.goto(urlPrec, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await salvarScreenshot(page, '05_eprecweb');
    await salvarTexto(page, '05_eprecweb');

    // Tentar preencher campos disponíveis
    const inputs = await page.locator('input[type="text"]').all();
    log(`Campos de texto encontrados: ${inputs.length}`);
    for (const input of inputs) {
      const id = await input.getAttribute('id') || '';
      const name = await input.getAttribute('name') || '';
      const placeholder = await input.getAttribute('placeholder') || '';
      log(`  Campo: id=${id} name=${name} placeholder=${placeholder}`);
    }
    resultado.consultas.push({ fase: 5, tipo: 'E_PRECWEB', status: 'SCREENSHOT_SALVO' });
  } catch (err) {
    log(`ERRO Fase 5: ${err.message}`);
    resultado.consultas.push({ fase: 5, tipo: 'E_PRECWEB', status: 'ERRO', erro: err.message });
  }

  // ── RESULTADO FINAL ──────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════════════════════');
  log('  RESULTADO FINAL DA PESQUISA');
  log('═══════════════════════════════════════════════════════════');
  log(`  Credor: ${DADOS.credor}`);
  log(`  CNPJ: ${DADOS.cnpjFormatado}`);
  log(`  CNJ: ${DADOS.cnj}`);
  log(`  Valor ofício: R$ ${DADOS.valorTotal.toLocaleString('pt-BR')}`);
  log(`  Processos encontrados: ${resultado.processos_encontrados.length}`);
  log(`  Precatórios (PRC): ${resultado.processos_encontrados.filter(p => p.is_precatorio).length}`);
  log(`  Status pagamento: ${resultado.status_pagamento}`);
  log(`  Consultas realizadas: ${resultado.consultas.length}`);
  log('═══════════════════════════════════════════════════════════');
  log(`  Arquivos salvos em: ${SAIDA}`);
  log('═══════════════════════════════════════════════════════════');

  // Salvar JSON com todos os dados
  fs.writeFileSync(
    path.join(SAIDA, 'resultado_pesquisa.json'),
    JSON.stringify(resultado, null, 2),
    'utf-8'
  );
  log('JSON salvo: resultado_pesquisa.json');

  // Aguardar 5s para visualização antes de fechar
  log('\nFechando browser em 5 segundos...');
  await page.waitForTimeout(5000);
  await browser.close();
  log('Browser fechado. Pesquisa concluída.');
})().catch(e => {
  console.error('[FATAL]', e.message);
  process.exit(1);
});
