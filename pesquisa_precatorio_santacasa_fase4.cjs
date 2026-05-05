/**
 * Fase 4 — Busca corrigida: precatório por processo originário + advogado
 * ─────────────────────────────────────────────────────────────────────────
 * O sistema processual do TRF1 NÃO aceita busca direta por nº do precatório.
 * Deve-se buscar por: processo originário, processo execução, OAB do advogado.
 *
 * CNJ do ofício: 1061297-10.2020.4.01.3400 (originário E execução)
 * Advogado: Edvaldo Nilo de Almeida — OAB DF29502
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
  fs.appendFileSync(path.join(SAIDA, 'pesquisa_fase4.log'), line + '\n');
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
  log('  FASE 4 — Busca corrigida por proc originário + advogado');
  log('═══════════════════════════════════════════════════════════');

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);

  // ── ETAPA 1: Busca por Processo Originário ───────────────────────────────
  log('\n════ ETAPA 1: Busca por Processo Originário ════');
  try {
    // URL da busca por nº do processo originário
    const url = 'https://processual.trf1.jus.br/consultaProcessual/numeroProcessoOriginario.php?secao=TRF1';
    log(`Acessando: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    await screenshot(page, 'f4_01_form_proc_originario');

    // Preencher campo com o CNJ do ofício
    const campoProc = page.locator('input[name="proc"], input[id*="proc"]').first();
    if (await campoProc.isVisible()) {
      await campoProc.fill('10612971020204013400');
      log('Campo preenchido com CNJ: 10612971020204013400');

      const btnPesq = page.locator('input[value="Pesquisar"], button:has-text("Pesquisar")').first();
      if (await btnPesq.isVisible()) {
        await btnPesq.click();
        await page.waitForTimeout(4000);
        await screenshot(page, 'f4_01b_resultado_proc_originario');
        const texto = await salvarTexto(page, 'f4_01b_resultado_proc_originario');
        log(`Resultado: ${texto.substring(0, 500)}`);

        // Buscar links de processos
        const links = await page.locator('a[href*="processo.php"]').all();
        for (const link of links) {
          const txt = await link.innerText().catch(() => '');
          const href = await link.getAttribute('href').catch(() => '');
          if (txt.trim()) log(`  Link: ${txt.trim()} → ${href}`);
        }
      }
    }
  } catch (err) {
    log(`ERRO Etapa 1: ${err.message}`);
  }

  // ── ETAPA 2: Busca por Processo de Execução ──────────────────────────────
  log('\n════ ETAPA 2: Busca por Processo de Execução ════');
  try {
    const url = 'https://processual.trf1.jus.br/consultaProcessual/numeroProcessoExecucao.php?secao=TRF1';
    log(`Acessando: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const campoProc = page.locator('input[name="proc"], input[id*="proc"]').first();
    if (await campoProc.isVisible()) {
      await campoProc.fill('10612971020204013400');
      log('Campo preenchido com CNJ execução');

      const btnPesq = page.locator('input[value="Pesquisar"], button:has-text("Pesquisar")').first();
      if (await btnPesq.isVisible()) {
        await btnPesq.click();
        await page.waitForTimeout(4000);
        await screenshot(page, 'f4_02_resultado_proc_execucao');
        const texto = await salvarTexto(page, 'f4_02_resultado_proc_execucao');
        log(`Resultado: ${texto.substring(0, 500)}`);

        const links = await page.locator('a[href*="processo.php"]').all();
        for (const link of links) {
          const txt = await link.innerText().catch(() => '');
          if (txt.trim()) log(`  Link: ${txt.trim()}`);
        }
      }
    }
  } catch (err) {
    log(`ERRO Etapa 2: ${err.message}`);
  }

  // ── ETAPA 3: Busca pelo advogado OAB DF29502 e expandir ──────────────────
  log('\n════ ETAPA 3: Busca pelo advogado — expandir todos os processos ════');
  try {
    const url = 'https://processual.trf1.jus.br/consultaProcessual/advogado/listarPorOabAdvogado.php?oab=29502&uf=DF&secao=TRF1&enviar=Pesquisar';
    log(`Acessando: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await screenshot(page, 'f4_03_advogado_lista');
    const textoAdv = await salvarTexto(page, 'f4_03_advogado_lista');

    // Contar processos
    const matchNum = textoAdv.match(/(\d+)\s+[\d\/]+\s*\/?\s*EDVALDO/i);
    log(`Texto advogado: ${textoAdv.substring(0, 400)}`);

    // Clicar para expandir
    const linkAdv = page.locator('a', { hasText: /EDVALDO/i }).first();
    if (await linkAdv.isVisible({ timeout: 3000 })) {
      log('Expandindo processos do advogado...');
      await linkAdv.click();
      await page.waitForTimeout(4000);
      await screenshot(page, 'f4_03b_advogado_expandido');
      const textoExp = await salvarTexto(page, 'f4_03b_advogado_expandido');

      // Buscar todos os processos
      const regexP = /\((\w+)\)\s*([\d.-]+)/g;
      let mp;
      let countPrc = 0;
      while ((mp = regexP.exec(textoExp)) !== null) {
        const isPrc = mp[1] === 'PRC';
        log(`  (${mp[1]}) ${mp[2]}${isPrc ? ' ← PRECATÓRIO' : ''}`);
        if (isPrc) countPrc++;
      }
      log(`  Total precatórios do advogado: ${countPrc}`);

      // Buscar por links que contenham o CNJ do nosso caso
      if (textoExp.includes('1061297') || textoExp.includes('0201566')) {
        log('  ✅ MATCH ENCONTRADO nos processos do advogado');
      }

      // Se expandido parcial, rolar para ver mais
      const linksProc = await page.locator('a[href*="processo.php"]').all();
      log(`  Links de processo na página: ${linksProc.length}`);
      for (const lp of linksProc) {
        const txt = await lp.innerText().catch(() => '');
        if (txt.includes('PRC') || txt.includes('1061297') || txt.includes('0201566')) {
          log(`  >>> MATCH: ${txt.trim()}`);
        }
      }
    }
  } catch (err) {
    log(`ERRO Etapa 3: ${err.message}`);
  }

  // ── ETAPA 4: Busca pelo nome "SANTA CASA DE MISERICORDIA DE PRESIDENTE PRUDENTE" ─
  log('\n════ ETAPA 4: Busca por nome da parte ════');
  try {
    const url = 'https://processual.trf1.jus.br/consultaProcessual/parte/listarPorNomeParte.php?nome=SANTA+CASA+DE+MISERICORDIA+DE+PRESIDENTE+PRUDENTE&secao=TRF1&enviar=Pesquisar';
    log(`Acessando busca por nome...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await screenshot(page, 'f4_04_nome_parte');
    const textoNome = await salvarTexto(page, 'f4_04_nome_parte');

    // Contar registros
    const matchNumProc = textoNome.match(/Número de\s*processos\s*(\d+)/i);
    if (matchNumProc) log(`  Total processos por nome: ${matchNumProc[1]}`);

    // Expandir
    const linkNome = page.locator('a', { hasText: /SANTA CASA.*PRESIDENTE PRUDENTE/i }).first();
    if (await linkNome.isVisible({ timeout: 3000 })) {
      await linkNome.click();
      await page.waitForTimeout(4000);
      await screenshot(page, 'f4_04b_nome_expandido');
      const textoNomeExp = await salvarTexto(page, 'f4_04b_nome_expandido');

      const regexP = /\((\w+)\)\s*([\d.-]+)/g;
      let mp;
      while ((mp = regexP.exec(textoNomeExp)) !== null) {
        if (mp[1] === 'PRC') {
          log(`  PRECATÓRIO: (${mp[1]}) ${mp[2]}`);
        }
      }
    }
  } catch (err) {
    log(`ERRO Etapa 4: ${err.message}`);
  }

  // ── ETAPA 5: Acessar precatório 0201566-46.2024 via link de processo originário ──
  log('\n════ ETAPA 5: Acessar PRC 2024 via link do processo de origem ════');
  try {
    // Tentar com formato antigo: 1061297-10.2020.4.01.3400
    const formatos = [
      'https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=10612971020204013400&secao=TRF1&pg=1&trf1_captcha_id=&trf1_captcha=&enviar=Pesquisar',
      'https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=10612971020204013400&secao=DF&pg=1&enviar=Pesquisar',
      // Formato antigo: 2020.34.00.1061297-1
      'https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=202034001061297&secao=JFDF&pg=1&enviar=Pesquisar',
    ];

    for (const url of formatos) {
      log(`Testando: ${url.substring(0, 120)}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const texto = await page.locator('body').innerText();

      if (!texto.includes('não foi encontrado') && (texto.includes('Partes') || texto.includes('Classe'))) {
        log('  ✅ PROCESSO ENCONTRADO');
        await screenshot(page, 'f4_05_processo_encontrado');
        await salvarTexto(page, 'f4_05_processo_encontrado');
        break;
      } else {
        log('  ✗ Não encontrado');
      }
    }
  } catch (err) {
    log(`ERRO Etapa 5: ${err.message}`);
  }

  // ── RESULTADO ────────────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════════════════════');
  log('  FASE 4 CONCLUÍDA');
  log(`  Arquivos: ${SAIDA}`);
  log('═══════════════════════════════════════════════════════════');

  log('\nFechando browser em 5 segundos...');
  await page.waitForTimeout(5000);
  await browser.close();
  log('Fase 4 concluída.');
})().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
