/**
 * Driver TRF1 — Consulta processual via Playwright
 * Código VALIDADO em 12/04/2026 (407 processos INCRA extraídos)
 * Baseado em: enriquecer_precatorio_cnpj.cjs (validado por Marcos)
 *
 * URLs:
 *   - CNPJ: processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1
 *   - CNJ:  processual.trf1.jus.br/consultaProcessual/numeroProcesso.php?secao=TRF1
 * Seletores validados: input#cpf_cnpj, input#enviar, input#proc
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ── Fase 3 G10 — Cadeia de custódia via EvidencePack standalone ──
// Carrega evidence_pack.cjs bundled (gerado por `npm run build` em
// script/build.ts entry "dist/lib/evidence_pack.cjs"). Single source of
// truth: evidence_pack.ts. Drivers .cjs consomem via require puro.
// Ref: contrato_tecnico/aditivos/aditivo_2026-04-24_fase2.md G10.
const EVIDENCE_PACK_PATH = path.resolve(__dirname, '../../../../dist/lib/evidence_pack.cjs');
let EvidencePack = null;
let computeSHA256 = null;
try {
  ({ EvidencePack, computeSHA256 } = require(EVIDENCE_PACK_PATH));
} catch (e) {
  console.error('[trf1] FATAL: dist/lib/evidence_pack.cjs nao encontrado.');
  console.error('[trf1] Rode `npm run build` na raiz do projeto antes de executar este driver.');
  console.error('[trf1] Caminho esperado:', EVIDENCE_PACK_PATH);
  process.exit(1);
}

function packIdFor(prefix, key) {
  const safeKey = String(key).replace(/[^a-zA-Z0-9]/g, '');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${safeKey}_${ts}`;
}

const URLS = {
  numero: 'https://processual.trf1.jus.br/consultaProcessual/numeroProcesso.php?secao=TRF1',
  cpfcnpj: 'https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1',
  pje: 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam',
};

/**
 * Criar browser com configuração anti-detecção
 * O processual.trf1.jus.br tem Cloudflare — precisa parecer browser real
 */
async function criarBrowser(headless = true) {
  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'pt-BR',
  });
  // Remover navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  return { browser, context };
}

async function consultarPorCNJ(cnj, options = {}) {
  const { headless = true, timeout = 45000 } = options;
  const resultado = {
    tribunal: 'TRF1',
    cnj_pesquisado: cnj,
    encontrado: false,
    dados_processo: {},
    movimentacoes: [],
    partes: [],
    erro: null,
    timestamp: new Date().toISOString(),
  };

  // Fase 3 G10 — pack de evidência por consulta
  const pack = new EvidencePack(packIdFor('trf1_cnj', cnj));
  pack.log(`consultarPorCNJ start cnj=${cnj} headless=${headless}`);
  pack.saveRequest({ cnj, url: URLS.numero, headless, timeout, method: 'consultarPorCNJ' });

  let browser;
  try {
    const ctx = await criarBrowser(headless);
    browser = ctx.browser;
    const page = await ctx.context.newPage();

    await page.goto(URLS.numero, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(3000);

    // Verificar Cloudflare
    const titulo = await page.title();
    if (titulo.includes('Just a moment') || titulo.includes('Cloudflare')) {
      // Esperar resolução do challenge
      console.log('[TRF1] Cloudflare detectado, aguardando...');
      await page.waitForTimeout(8000);
      const titulo2 = await page.title();
      if (titulo2.includes('Just a moment')) {
        resultado.erro = 'Cloudflare bloqueou acesso ao processual TRF1';
        await browser.close();
        return resultado;
      }
    }

    // Seletor validado: input#proc
    const cnjLimpo = cnj.replace(/[.\-\/]/g, '');
    const input = page.locator('input#proc, input[name="proc"]').first();
    await input.waitFor({ timeout: 10000 });
    await input.fill(cnjLimpo);
    await page.waitForTimeout(300);

    // Enviar — Enter contorna reCAPTCHA (validado)
    await page.press('input#proc, input[name="proc"]', 'Enter');
    await page.waitForTimeout(5000);

    const bodyText = await page.locator('body').innerText();
    pack.saveRawPayload('antigo_resultado_body.txt', bodyText);

    if (bodyText.includes('não foi encontrado') || bodyText.includes('Nenhum')) {
      resultado.erro = 'Processo não encontrado no sistema antigo TRF1';
      pack.log(`antigo: nao encontrado para cnj=${cnj}`);
      // NÃO retornar aqui — deixar o fallback PJe tentar
    } else {

    resultado.encontrado = true;

    // Extrair dados estruturados
    const linhas = bodyText.split('\n').map(l => l.trim()).filter(l => l);
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      if (l.includes('Classe:') || l.includes('Classe Judicial:')) {
        resultado.dados_processo.classe = linhas[i + 1] || l.split(':').pop().trim();
      }
      if (l.includes('Assunto:') || l.includes('Assuntos:')) {
        resultado.dados_processo.assunto = linhas[i + 1] || l.split(':').pop().trim();
      }
      if (/[Óó]rg[aã]o\s*Julg/i.test(l)) {
        resultado.dados_processo.orgao_julgador = linhas[i + 1] || l.split(':').pop().trim();
      }
      if (/[Úú]ltima\s*Movimenta/i.test(l)) {
        resultado.dados_processo.ultima_movimentacao = linhas[i + 1] || l.split(':').pop().trim();
      }
    }

    // Extrair movimentações
    const movLink = page.locator('a:has-text("Moviment"), a:has-text("moviment")').first();
    if (await movLink.count() > 0) {
      await movLink.click();
      await page.waitForTimeout(3000);
    }

    const rows = await page.locator('table tr, .movimentacao, .timeline-item').all();
    for (const row of rows) {
      try {
        const texto = await row.innerText({ timeout: 1000 });
        const match = texto.match(/(\d{2}\/\d{2}\/\d{4})\s+(.+)/);
        if (match) {
          resultado.movimentacoes.push({
            dataHora: match[1],
            nome: match[2].trim().substring(0, 200),
            codigo: 0,
          });
        }
      } catch (e) { /* ignorar */ }
    }

    // Fallback: extrair datas do texto
    if (resultado.movimentacoes.length === 0) {
      const datePattern = /(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(.+?)(?=\d{2}\/\d{2}\/\d{4}|$)/gs;
      let m;
      while ((m = datePattern.exec(bodyText)) !== null) {
        resultado.movimentacoes.push({
          dataHora: m[1],
          nome: m[2].trim().substring(0, 200),
          codigo: 0,
        });
      }
    }

    // Extrair partes
    const partesMatch = bodyText.match(/(AUTOR|REQUERENTE|EXEQUENTE|RÉU|REQUERIDO|EXECUTADO)[:\s]+([^\n]+)/gi);
    if (partesMatch) {
      partesMatch.forEach(p => {
        const parts = p.split(/[:\s]+/);
        resultado.partes.push({ tipo: parts[0], nome: parts.slice(1).join(' ').trim() });
      });
    }

    } // fim do else (processo encontrado no sistema antigo)

    if (options.screenshot) {
      await page.screenshot({ path: options.screenshot, fullPage: true });
    }

  } catch (e) {
    resultado.erro = e.message.substring(0, 300);
  } finally {
    if (browser) await browser.close();
  }

  // FALLBACK: Se não encontrou no sistema antigo, tentar PJe 1g
  if (!resultado.encontrado || resultado.movimentacoes.length <= 1) {
    console.log('[TRF1] Sistema antigo insuficiente — tentando PJe 1g...');
    pack.log('fallback: tentando PJe 1g');
    try {
      const pjeResult = await consultarPJe1g(cnj, options);
      if (pjeResult.encontrado) {
        // Merge: PJe tem dados mais ricos
        resultado.encontrado = true;
        resultado.sistema = 'pje';
        if (pjeResult.movimentacoes.length > resultado.movimentacoes.length) {
          resultado.movimentacoes = pjeResult.movimentacoes;
        }
        if (pjeResult.dados_processo.classe) resultado.dados_processo = pjeResult.dados_processo;
        if (pjeResult.partes.length > 0) resultado.partes = pjeResult.partes;
        resultado.erro = null;
        pack.log(`fallback PJe: encontrado classe=${resultado.dados_processo.classe || '?'} movs=${resultado.movimentacoes.length}`);
      } else {
        pack.log('fallback PJe: nao encontrado');
      }
    } catch (e) {
      console.log(`[TRF1] PJe fallback falhou: ${e.message}`);
      pack.log(`fallback PJe erro: ${e.message.substring(0, 200)}`);
    }
  }

  // Cadeia de custódia final
  const responseHash = pack.saveResponse(resultado);
  pack.saveLog();
  resultado._evidence = { processId: pack.getBasePath().split(/[\\/]/).pop(), responseHash };

  return resultado;
}

/**
 * Consulta PJe 1º grau — processos novos (2010+)
 * Usa pressSequentially (campo tem máscara) + click no resultado + extrai movimentações
 * Validado: campo usa máscara, Enter contorna captcha, precisa clicar no resultado
 */
async function consultarPJe1g(cnj, options = {}) {
  const { headless = true, timeout = 45000 } = options;
  const resultado = {
    tribunal: 'TRF1',
    cnj_pesquisado: cnj,
    encontrado: false,
    dados_processo: {},
    movimentacoes: [],
    partes: [],
    erro: null,
    sistema: 'pje',
    timestamp: new Date().toISOString(),
  };

  // Fase 3 G10 — pack só se chamada direta (sem caller pack)
  // Se chamado pelo fallback de consultarPorCNJ, o caller já tem seu próprio pack;
  // este pack adicional grava a tentativa PJe isoladamente.
  const pack = new EvidencePack(packIdFor('trf1_pje1g', cnj));
  pack.log(`consultarPJe1g start cnj=${cnj} headless=${headless}`);
  pack.saveRequest({ cnj, url: URLS.pje, headless, timeout, method: 'consultarPJe1g' });

  let browser;
  try {
    const ctx = await criarBrowser(headless);
    browser = ctx.browser;
    const page = await ctx.context.newPage();
    page.setDefaultTimeout(timeout);

    console.log('[TRF1-PJe] Acessando PJe 1g consulta pública...');
    await page.goto(URLS.pje, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(4000);

    // Campo processo — tem máscara, usar pressSequentially
    const cnjLimpo = cnj.replace(/[.\-\/]/g, '');
    const campoProc = page.locator('input[id*="processo"], input[id*="Processo"]').first();
    await campoProc.waitFor({ timeout: 10000 });
    await campoProc.click();
    await campoProc.fill('');
    await page.waitForTimeout(300);
    await campoProc.pressSequentially(cnjLimpo, { delay: 50 });
    await page.waitForTimeout(1000);

    // Enviar com Enter (contorna reCAPTCHA — validado 13/04/2026)
    await campoProc.press('Enter');
    await page.waitForTimeout(6000);

    // Verificar resultado
    const bodyText = await page.locator('body').innerText();
    pack.saveRawPayload('pje1g_listagem_body.txt', bodyText);

    if (bodyText.includes('Nenhum processo encontrado') || bodyText.includes('0 resultados')) {
      resultado.erro = 'Processo não encontrado no PJe 1g';
      pack.log(`pje1g: nao encontrado para cnj=${cnj}`);
      pack.saveResponse(resultado);
      pack.saveLog();
      await browser.close();
      return resultado;
    }

    if (bodyText.includes('resultados encontrados') || bodyText.includes('resultado encontrado')) {
      resultado.encontrado = true;
      console.log('[TRF1-PJe] Processo encontrado — clicando para abrir detalhes...');

      // Clicar no primeiro resultado — PJe pode abrir em nova aba ou via JS
      const cnjPrefix = cnj.substring(0, 7);
      const linkProcesso = page.locator(`a:has-text("${cnjPrefix}")`).first();
      try {
        await linkProcesso.waitFor({ timeout: 8000 });
        // Dump do link para debug
        const href = await linkProcesso.getAttribute('href').catch(() => 'N/A');
        const onclick = await linkProcesso.getAttribute('onclick').catch(() => 'N/A');
        const target = await linkProcesso.getAttribute('target').catch(() => 'N/A');
        console.log(`[TRF1-PJe] Link: href=${href}, onclick=${onclick}, target=${target}`);

        // PJe usa openPopUp(título, url) — extrair URL do onclick e navegar direto
        const onclickStr = onclick || '';
        const popupMatch = onclickStr.match(/openPopUp\([^,]+,\s*'([^']+)'\)/);
        if (popupMatch) {
          const popupUrl = 'https://pje1g-consultapublica.trf1.jus.br' + popupMatch[1];
          console.log(`[TRF1-PJe] Navegando para URL do popup: ${popupUrl.substring(0, 80)}...`);
          await page.goto(popupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(5000);
        } else {
          await linkProcesso.click();
          await page.waitForTimeout(6000);
        }
      } catch (e) {
        console.log(`[TRF1-PJe] Click falhou: ${e.message.substring(0, 100)}`);
        // Extrair dados diretamente da tela de resultados (fallback)
      }

      // Extrair dados do processo
      const detalheText = await page.locator('body').innerText();
      pack.saveRawPayload('pje1g_detalhe_body.txt', detalheText);
      const linhas = detalheText.split('\n').map(l => l.trim()).filter(l => l);

      for (let i = 0; i < linhas.length; i++) {
        const l = linhas[i];
        if (/^Classe[\s:]/i.test(l)) {
          resultado.dados_processo.classe = l.replace(/^Classe[\s:]+/i, '').trim() || linhas[i+1] || '';
        }
        if (/^Assunto/i.test(l)) {
          resultado.dados_processo.assunto = l.replace(/^Assuntos?[\s:]+/i, '').trim() || linhas[i+1] || '';
        }
        if (/^Jurisdi/i.test(l) || /[Óó]rg[aã]o/i.test(l)) {
          resultado.dados_processo.orgao_julgador = l.replace(/^[^:]+:/, '').trim() || linhas[i+1] || '';
        }
        if (/^Valor da causa/i.test(l)) {
          resultado.dados_processo.valor_causa = l.replace(/^Valor da causa[\s:]+/i, '').trim();
        }
      }

      // Extrair partes
      const partesRegex = /(AUTOR|AUTORA|REQUERENTE|EXEQUENTE|IMPETRANTE|RÉU|RÉ|REQUERIDO|EXECUTADO|IMPETRADO)[:\s]+([^\n]+)/gi;
      let mp;
      while ((mp = partesRegex.exec(detalheText)) !== null) {
        resultado.partes.push({ tipo: mp[1].toUpperCase(), nome: mp[2].trim().substring(0, 200) });
      }

      // Extrair movimentações — PJe lista como timeline
      // Padrão: "dd/mm/aaaa HH:MM:SS" ou "dd/mm/aaaa" seguido de descrição
      const movRegex = /(\d{2}\/\d{2}\/\d{4})\s*(?:(\d{2}:\d{2}:\d{2})\s*)?[-–]?\s*(.+?)(?=\d{2}\/\d{2}\/\d{4}|\n|$)/g;
      let mm;
      const movTexto = detalheText;
      while ((mm = movRegex.exec(movTexto)) !== null) {
        const nome = mm[3].trim();
        if (nome.length > 3 && nome.length < 500 && !nome.startsWith('Consulta') && !nome.startsWith('http')) {
          // Tentar extrair código da movimentação (se presente como número no início)
          const codMatch = nome.match(/^(\d{2,5})\s*[-–]\s*(.+)/);
          resultado.movimentacoes.push({
            dataHora: mm[1] + (mm[2] ? ' ' + mm[2] : ''),
            nome: codMatch ? codMatch[2].trim() : nome,
            codigo: codMatch ? parseInt(codMatch[1]) : 0,
          });
        }
      }

      // Fallback: buscar movimentações por seletor de tabela/lista
      if (resultado.movimentacoes.length <= 1) {
        console.log('[TRF1-PJe] Tentando extrair movimentações por seletores DOM...');
        const movItems = await page.locator('.movimentacao, .timeline-item, tr.movimentacao, [id*="movimentacao"]').all();
        for (const item of movItems) {
          try {
            const texto = await item.innerText({ timeout: 1000 });
            const dateMatch = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
            if (dateMatch) {
              const desc = texto.replace(dateMatch[0], '').trim().substring(0, 200);
              const codMatch = desc.match(/^(\d{2,5})\s*[-–]\s*(.+)/);
              resultado.movimentacoes.push({
                dataHora: dateMatch[1],
                nome: codMatch ? codMatch[2].trim() : desc,
                codigo: codMatch ? parseInt(codMatch[1]) : 0,
              });
            }
          } catch (e) {}
        }
      }

      // Screenshot para debug
      if (options.screenshot) {
        const screenshotPath = options.screenshot.replace('.png', '_pje.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[TRF1-PJe] Screenshot: ${screenshotPath}`);
      }

      console.log(`[TRF1-PJe] Dados: classe=${resultado.dados_processo.classe || '?'}, partes=${resultado.partes.length}, movimentações=${resultado.movimentacoes.length}`);
    }

  } catch (e) {
    resultado.erro = e.message.substring(0, 300);
    console.log(`[TRF1-PJe] Erro: ${resultado.erro}`);
    pack.log(`pje1g erro: ${resultado.erro}`);
  } finally {
    if (browser) await browser.close();
  }

  // Cadeia de custódia final
  const responseHash = pack.saveResponse(resultado);
  pack.saveLog();
  resultado._evidence = { processId: pack.getBasePath().split(/[\\/]/).pop(), responseHash };

  return resultado;
}

/**
 * Consulta por CNPJ — Código validado (407 processos INCRA em 12/04/2026)
 * Fluxo: CNPJ → processual.trf1 → lista partes → click entidade → tabela processos → paginação
 */
async function consultarPorCNPJ(cnpj, options = {}) {
  const { headless = true, timeout = 60000, nome_entidade = null } = options;
  const resultado = {
    tribunal: 'TRF1',
    cnpj_pesquisado: cnpj,
    nome_entidade: nome_entidade || null,
    processos: [],
    erro: null,
    timestamp: new Date().toISOString(),
  };

  // Fase 3 G10 — pack de evidência por consulta
  const pack = new EvidencePack(packIdFor('trf1_cnpj', cnpj));
  pack.log(`consultarPorCNPJ start cnpj=${cnpj} nome_entidade=${nome_entidade || ''} headless=${headless}`);
  pack.saveRequest({ cnpj, nome_entidade, url: URLS.cpfcnpj, headless, timeout, method: 'consultarPorCNPJ' });

  let browser;
  try {
    const ctx = await criarBrowser(headless);
    browser = ctx.browser;
    const page = await ctx.context.newPage();

    // ETAPA 1: Buscar por CNPJ
    console.log(`[TRF1] Buscando CNPJ ${cnpj} no processual TRF1...`);
    await page.goto(URLS.cpfcnpj, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(3000);

    // Verificar Cloudflare
    const titulo = await page.title();
    if (titulo.includes('Just a moment') || titulo.includes('Cloudflare')) {
      console.log('[TRF1] Cloudflare detectado, aguardando resolução...');
      await page.waitForTimeout(10000);
      const titulo2 = await page.title();
      if (titulo2.includes('Just a moment')) {
        resultado.erro = 'Cloudflare bloqueou acesso — tentar headless:false ou PJe como fallback';
        await browser.close();
        return resultado;
      }
    }

    // Seletor validado: input#cpf_cnpj
    const campo = page.locator('input#cpf_cnpj, input[name="cpf_cnpj"]').first();
    await campo.waitFor({ timeout: 10000 });
    await campo.fill(cnpj.replace(/[.\-\/]/g, ''));
    await page.waitForTimeout(300);

    // Marcar mostrar baixados
    try {
      await page.locator('input[name="mostrarBaixados"]').check({ timeout: 2000 });
    } catch (e) {}

    // Enviar — seletor validado: input#enviar
    const btnEnviar = page.locator('input#enviar, input[type="submit"]').first();
    await btnEnviar.click();
    await page.waitForTimeout(5000);

    // ETAPA 2: Clicar no nome da entidade (expande lista de processos)
    if (nome_entidade) {
      console.log(`[TRF1] Procurando link da entidade: ${nome_entidade}...`);
      const linkEntidade = page.locator('a').filter({
        hasText: new RegExp(nome_entidade.slice(0, 15), 'i')
      }).first();
      try {
        await linkEntidade.waitFor({ timeout: 10000 });
        const textoLink = await linkEntidade.innerText();
        console.log(`[TRF1] Encontrado: "${textoLink.trim().slice(0, 80)}"`);
        await linkEntidade.click();
        await page.waitForTimeout(5000);
      } catch (e) {
        console.log('[TRF1] Link entidade não encontrado, tentando primeiro link...');
        const primeiroLink = page.locator('table a').first();
        try {
          await primeiroLink.click();
          await page.waitForTimeout(5000);
        } catch (e2) {
          console.log('[TRF1] Nenhum link de parte encontrado');
        }
      }
    } else {
      // Sem nome, tentar clicar no primeiro resultado
      const primeiroLink = page.locator('table a').first();
      try {
        await primeiroLink.click();
        await page.waitForTimeout(5000);
      } catch (e) {}
    }

    // ETAPA 3: Extrair tabela de processos com paginação
    let paginaAtual = 1;
    let temProxima = true;

    while (temProxima) {
      const linhas = await page.locator('table tr').all();
      for (const linha of linhas) {
        const celulas = await linha.locator('td').all();
        if (celulas.length >= 2) {
          try {
            const numProcesso = (await celulas[0].innerText({ timeout: 1000 })).trim();
            const procOriginario = (await celulas[1].innerText({ timeout: 1000 })).trim();

            if (numProcesso && /\d{5,}/.test(numProcesso.replace(/[.\-\/]/g, ''))) {
              // Evitar duplicatas
              if (!resultado.processos.find(p => p.cnj === numProcesso)) {
                resultado.processos.push({
                  cnj: numProcesso,
                  processo_originario: procOriginario,
                  tribunal: 'TRF1',
                  pagina: paginaAtual,
                });
              }
            }
          } catch (e) {}
        }
      }

      // Extrair CNJs do texto (fallback)
      if (resultado.processos.length === 0) {
        const bodyText = await page.locator('body').innerText();
        pack.saveRawPayload(`cnpj_pagina${paginaAtual}_fallback_body.txt`, bodyText);
        const cnjPattern = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/g;
        const cnjs = [...new Set((bodyText.match(cnjPattern) || []))];
        cnjs.forEach(c => {
          if (!resultado.processos.find(p => p.cnj === c)) {
            resultado.processos.push({ cnj: c, tribunal: 'TRF1', pagina: paginaAtual });
          }
        });
      }

      // Paginação
      const btnProx = page.locator('a:has-text("Próxima"), a:has-text("próxima"), a:has-text(">>")').last();
      try {
        const isVisible = await btnProx.isVisible({ timeout: 2000 });
        if (isVisible && paginaAtual < 50) {
          const href = await btnProx.getAttribute('href');
          if (href && !href.includes('javascript:void')) {
            await btnProx.click();
            await page.waitForTimeout(3000);
            paginaAtual++;
            console.log(`[TRF1] Página ${paginaAtual}... (total parcial: ${resultado.processos.length})`);
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

    console.log(`[TRF1] Total: ${resultado.processos.length} processos em ${paginaAtual} página(s)`);
    pack.log(`consultarPorCNPJ end cnpj=${cnpj} processos=${resultado.processos.length} paginas=${paginaAtual}`);

  } catch (e) {
    resultado.erro = e.message.substring(0, 300);
    pack.log(`consultarPorCNPJ erro: ${resultado.erro}`);
  } finally {
    if (browser) await browser.close();
  }

  // Cadeia de custódia final
  const responseHash = pack.saveResponse(resultado);
  pack.saveLog();
  resultado._evidence = { processId: pack.getBasePath().split(/[\\/]/).pop(), responseHash };

  return resultado;
}

module.exports = { consultarPorCNJ, consultarPorCNPJ, consultarPJe1g, URLS };
