// MANTRA: seguir o caminho OFICIAL documentado, listar campos LITERAIS, mostrar bruto.
// Caminho: www.trf1.jus.br → Processual → RPV e Precatório → Consulta processual
const { chromium } = require('playwright');

const NUMERO_LOA = '1363102520254010000'; // #1 — R$ 1.044.686.858 FUNDEF

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ========== ETAPA 1: home ==========
  console.log('\n[1] Abrindo www.trf1.jus.br');
  await page.goto('https://www.trf1.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);

  // ========== ETAPA 2: hover no menu Processual e expandir ==========
  console.log('[2] Hover em "Processual"');
  const proc = page.locator('a, button, span').filter({ hasText: /^Processual$/ }).first();
  await proc.hover().catch(() => console.log('  (hover falhou, tentando click)'));
  await page.waitForTimeout(1500);
  await proc.click({ trial: true }).catch(() => {});

  // Tenta clicar para abrir
  try { await proc.click(); await page.waitForTimeout(1500); } catch(e) {}

  // Lista links visíveis após hover
  const linksProcessual = await page.locator('a:visible').all();
  console.log('\n  Links visíveis após Processual:');
  const candidatosRPV = [];
  for (const l of linksProcessual.slice(0, 300)) {
    try {
      const t = (await l.innerText({ timeout: 300 })).trim();
      const h = await l.getAttribute('href');
      if (t && /precat|rpv/i.test(t)) {
        candidatosRPV.push({ texto: t.slice(0, 80), href: h });
      }
    } catch (e) {}
  }
  candidatosRPV.forEach((c, i) => console.log(`    ${i+1}. "${c.texto}" → ${c.href}`));

  // ========== ETAPA 3: Acessar página RPV e Precatórios direto ==========
  console.log('\n[3] Indo direto para a página oficial de RPV e Precatórios');
  await page.goto('https://www.trf1.jus.br/trf1/processual/rpv-e-precatorios', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(async () => {
    console.log('  (URL 1 falhou, tentando alternativa)');
    await page.goto('https://portal.trf1.jus.br/portaltrf1/processual/rpv-e-precatorios.htm', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
  });
  await page.waitForTimeout(3000);
  console.log('  URL final:', page.url());
  console.log('  título:', await page.title());
  await page.screenshot({ path: 'C:/Temp/trf1_rpv_pagina.png', fullPage: true });

  // Lista TODOS os links da página com "consulta", "precatório", "processo", "sistema"
  console.log('\n  Links relevantes nesta página:');
  const allLinks = await page.locator('a:visible').all();
  const relev = [];
  for (const l of allLinks.slice(0, 400)) {
    try {
      const t = (await l.innerText({ timeout: 300 })).trim();
      const h = await l.getAttribute('href');
      if (t && /consulta|precat|sistema|outros|processo/i.test(t) && t.length < 120) {
        relev.push({ texto: t, href: h });
      }
    } catch (e) {}
  }
  relev.slice(0, 30).forEach((c, i) => console.log(`    ${i+1}. "${c.texto}" → ${c.href}`));

  // ========== ETAPA 4: Tentar consulta processual ==========
  console.log('\n[4] Indo para consulta processual TRF1');
  await page.goto('https://processual.trf1.jus.br/consultaProcessual/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Temp/trf1_consulta.png', fullPage: true });

  // Lista TODOS os campos de input + select
  console.log('\n  CAMPOS DE INPUT visíveis (literal):');
  const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
  for (let i = 0; i < inputs.length; i++) {
    try {
      const tag = await inputs[i].evaluate(el => el.tagName);
      const type = await inputs[i].getAttribute('type') || '-';
      const name = await inputs[i].getAttribute('name') || '-';
      const id = await inputs[i].getAttribute('id') || '-';
      const placeholder = await inputs[i].getAttribute('placeholder') || '-';
      const label = await inputs[i].evaluate(el => {
        const parent = el.closest('label') || el.previousElementSibling;
        return parent ? (parent.innerText || '').trim().slice(0, 50) : '-';
      }).catch(() => '-');
      console.log(`    ${i+1}. <${tag}> type=${type} name=${name} id=${id} placeholder="${placeholder}" label="${label}"`);
    } catch (e) {}
  }

  // Lista links de "Opções de pesquisa" se houver
  console.log('\n  Opções de pesquisa visíveis:');
  const opcoes = await page.locator('a:visible, button:visible').filter({ hasText: /processo|cpf|advogado|parte|origin|execu|sedex|protocolo|oab|nome/i }).all();
  for (let i = 0; i < Math.min(opcoes.length, 20); i++) {
    try {
      const t = (await opcoes[i].innerText({ timeout: 300 })).trim();
      console.log(`    ${i+1}. "${t}"`);
    } catch (e) {}
  }

  console.log('\n[*] Inspeção completa. Browser ficará aberto 60s para visualização.');
  await page.waitForTimeout(60000);
  await browser.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
