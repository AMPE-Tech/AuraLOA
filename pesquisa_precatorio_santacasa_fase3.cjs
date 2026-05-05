/**
 * Fase 3 — Detalhes dos 3 precatórios encontrados
 * ─────────────────────────────────────────────────
 * Fase 2 encontrou 3 precatórios da Santa Casa de PP:
 *   1. (PRC)0181820-42.2017.4.01.9198 — IRMANDADE (proc orig: 2002.34.00.036764-1)
 *   2. (PRC)0477119-23.2021.4.01.9198 — SANTA CASA
 *   3. (PRC)0201566-46.2024.4.01.9198 — SANTA CASA ← PROVÁVEL MATCH com ofício R$235M
 *
 * Esta fase:
 *   - Acessa cada um dos 3 precatórios
 *   - Extrai: Processo, Partes, Movimentações, Valores, Status pagamento
 *   - Foco especial no PRC de 2024 (match com ofício requisitório)
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
  fs.appendFileSync(path.join(SAIDA, 'pesquisa_fase3.log'), line + '\n');
}

async function screenshot(page, nome) {
  await page.screenshot({ path: path.join(SAIDA, `${nome}.png`), fullPage: true });
}

async function salvarTexto(page, nome) {
  const t = await page.locator('body').innerText();
  fs.writeFileSync(path.join(SAIDA, `${nome}.txt`), t, 'utf-8');
  return t;
}

const PRECATORIOS = [
  { id: 'prc1_2017', numero: '01818204220174019198', label: '(PRC)0181820-42.2017.4.01.9198', parte: 'IRMANDADE' },
  { id: 'prc2_2021', numero: '04771192320214019198', label: '(PRC)0477119-23.2021.4.01.9198', parte: 'SANTA CASA' },
  { id: 'prc3_2024', numero: '02015664620244019198', label: '(PRC)0201566-46.2024.4.01.9198', parte: 'SANTA CASA — PROVÁVEL R$235M' },
];

(async () => {
  log('═══════════════════════════════════════════════════════════');
  log('  FASE 3 — Detalhes de 3 precatórios Santa Casa PP');
  log('═══════════════════════════════════════════════════════════');

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);

  const resultados = [];

  for (const prc of PRECATORIOS) {
    log(`\n════ ${prc.label} (${prc.parte}) ════`);
    const dados = {
      id: prc.id,
      label: prc.label,
      parte: prc.parte,
      processo: {},
      partes: '',
      movimentacoes: [],
      status_pagamento: 'NAO_VERIFICADO',
    };

    try {
      // ── Aba Processo ──
      const url = `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${prc.numero}&secao=TRF1&pg=1&enviar=Pesquisar`;
      log(`Acessando: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      await screenshot(page, `f3_${prc.id}_processo`);
      const textoProc = await salvarTexto(page, `f3_${prc.id}_processo`);

      // Extrair dados do processo
      const campos = [
        'Classe', 'Assunto', 'Distribuição', 'Autuação', 'Juiz', 'Vara',
        'Processo Originário', 'Processo de Execução', 'Valor da Causa'
      ];
      for (const campo of campos) {
        const regex = new RegExp(`${campo}[:\\s]*([^\\n]+)`, 'i');
        const match = textoProc.match(regex);
        if (match) {
          dados.processo[campo] = match[1].trim();
          log(`  ${campo}: ${match[1].trim()}`);
        }
      }

      // ── Aba Partes ──
      try {
        const abaPartes = page.locator('a[href*="partes"], a:has-text("Partes")').first();
        if (await abaPartes.isVisible({ timeout: 3000 })) {
          await abaPartes.click();
          await page.waitForTimeout(2000);
          await screenshot(page, `f3_${prc.id}_partes`);
          dados.partes = await salvarTexto(page, `f3_${prc.id}_partes`);
          log(`  Partes extraídas (${dados.partes.length} chars)`);
        }
      } catch (e) { log(`  Partes: ${e.message}`); }

      // ── Aba Movimentação ──
      try {
        // Voltar para aba processo primeiro
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);

        const abaMovim = page.locator('a[href*="movimentacao"], a:has-text("Movimentação")').first();
        if (await abaMovim.isVisible({ timeout: 3000 })) {
          await abaMovim.click();
          await page.waitForTimeout(3000);
          await screenshot(page, `f3_${prc.id}_movimentacoes`);
          const textoMovim = await salvarTexto(page, `f3_${prc.id}_movimentacoes`);

          // Códigos relevantes
          const codigos = {
            '10100': '📋 Distribuição Automática',
            '50100': '📋 Autuado Como',
            '40100': '📋 Proposta Orçamentária enviada ao CJF',
            '180500': '📎 Documento Juntado',
            '40900': '💰 OFÍCIO VALOR DEPOSITADO',
            '40910': '✅ OFÍCIO SAQUE REALIZADO',
            '85': '📋 Juntada',
          };

          log('  --- Movimentações encontradas ---');
          for (const [cod, desc] of Object.entries(codigos)) {
            if (textoMovim.includes(cod)) {
              log(`  ${desc} (${cod})`);
              dados.movimentacoes.push({ codigo: cod, descricao: desc });

              if (cod === '40900') dados.status_pagamento = 'DEPOSITO_IDENTIFICADO';
              if (cod === '40910') dados.status_pagamento = 'SAQUE_REALIZADO';
            }
          }

          // Extrair linhas de movimentação com datas
          const linhas = textoMovim.split('\n');
          let countMov = 0;
          for (const linha of linhas) {
            const matchLinha = linha.match(/(\d{2}\/\d{2}\/\d{4})/);
            if (matchLinha && countMov < 30) {
              log(`  ${linha.trim().substring(0, 120)}`);
              countMov++;
            }
          }

          // Verificar se há mais páginas de movimentação
          try {
            const proxPag = page.locator('a:has-text("Próxima"), a:has-text("próxima"), a[href*="pg=2"]').first();
            if (await proxPag.isVisible({ timeout: 2000 })) {
              log('  [Há mais páginas de movimentação — acessando página 2]');
              await proxPag.click();
              await page.waitForTimeout(3000);
              await screenshot(page, `f3_${prc.id}_movimentacoes_p2`);
              const textoMovim2 = await salvarTexto(page, `f3_${prc.id}_movimentacoes_p2`);

              if (textoMovim2.includes('40900')) {
                log('  💰 DEPÓSITO encontrado na página 2');
                dados.status_pagamento = 'DEPOSITO_IDENTIFICADO';
              }
              if (textoMovim2.includes('40910')) {
                log('  ✅ SAQUE encontrado na página 2');
                dados.status_pagamento = 'SAQUE_REALIZADO';
              }
            }
          } catch (e) {}
        }
      } catch (e) { log(`  Movimentação: ${e.message}`); }

      log(`  >>> STATUS: ${dados.status_pagamento}`);

    } catch (err) {
      log(`ERRO no precatório ${prc.label}: ${err.message}`);
      dados.status_pagamento = 'ERRO';
    }

    resultados.push(dados);
  }

  // ── RESUMO FINAL ─────────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════════════════════');
  log('  RESUMO FINAL — 3 PRECATÓRIOS SANTA CASA PP');
  log('═══════════════════════════════════════════════════════════');
  for (const r of resultados) {
    log(`  ${r.label}`);
    log(`    Parte: ${r.parte}`);
    log(`    Status: ${r.status_pagamento}`);
    log(`    Movimentações: ${r.movimentacoes.length}`);
    if (r.processo['Processo Originário']) log(`    Proc Orig: ${r.processo['Processo Originário']}`);
    log('');
  }
  log(`  Arquivos: ${SAIDA}`);
  log('═══════════════════════════════════════════════════════════');

  fs.writeFileSync(path.join(SAIDA, 'resultado_fase3.json'), JSON.stringify(resultados, null, 2), 'utf-8');
  log('JSON salvo: resultado_fase3.json');

  log('\nFechando browser em 5 segundos...');
  await page.waitForTimeout(5000);
  await browser.close();
  log('Fase 3 concluída.');
})().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
