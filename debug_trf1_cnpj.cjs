const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('[1] Abrindo consulta CPF/CNPJ TRF1');
  await page.goto('https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1', {
    waitUntil: 'domcontentloaded', timeout: 60000
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Temp/trf1_cnpj_debug1.png', fullPage: true });

  // Dump ALL inputs
  console.log('\n>> Inputs visíveis:');
  const inputs = await page.locator('input, select, button').all();
  for (let i = 0; i < inputs.length; i++) {
    try {
      const info = await inputs[i].evaluate(el => ({
        tag: el.tagName, type: el.type, name: el.name, id: el.id,
        value: el.value?.slice(0, 30), visible: el.offsetParent !== null
      }));
      if (info.visible) console.log(`  ${i}. <${info.tag}> type=${info.type} name=${info.name} id=${info.id} value="${info.value}"`);
    } catch(e) {}
  }

  // Preencher CNPJ do INSS
  console.log('\n[2] Preenchendo CNPJ: 29979036000140');
  try {
    const field = page.locator('#cpf_cnpj, input[name="cpf_cnpj"]').first();
    await field.fill('29979036000140');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Temp/trf1_cnpj_debug2.png', fullPage: true });

    // Clicar enviar
    const btn = page.locator('#enviar, input[name="enviar"], input[value="Pesquisar"]').first();
    console.log('[3] Clicando enviar');
    await btn.click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'C:/Temp/trf1_cnpj_debug3.png', fullPage: true });

    const txt = await page.locator('body').innerText();
    console.log('\n>> Resultado (500 chars):');
    console.log(txt.slice(0, 500));
  } catch(e) {
    console.log('ERRO:', e.message.slice(0, 200));
    // Tentar screenshot mesmo com erro
    await page.screenshot({ path: 'C:/Temp/trf1_cnpj_debug_erro.png', fullPage: true });
    // Dump body
    const txt = await page.locator('body').innerText();
    console.log('\n>> Body (300 chars):');
    console.log(txt.slice(0, 300));
  }

  console.log('\n[*] Aguardando 30s...');
  await page.waitForTimeout(30000);
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
