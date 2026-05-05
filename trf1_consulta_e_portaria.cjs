// MANTRA: mostrar bruto, listar campos literais, não inferir.
// Faz 2 coisas: (1) testa numeroProcesso.php e (2) baixa Portaria PRESI 8886381
const { chromium } = require('playwright');
const fs = require('fs');

const URL_CONSULTA = 'https://processual.trf1.jus.br/consultaProcessual/numeroProcesso.php?secao=TRF1&enviar=ok';
const URL_PORTARIA = 'https://www.trf1.jus.br/trf1/conteudo/files/PORTARIAPRESI8886381CertidoEletrnicaNegativadePrecatriosJudiciais.pdf';
const NUMERO_LOA = '1363102520254010000'; // #1 — R$ 1.044.686.858 FUNDEF

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    acceptDownloads: true,
  });
  const page = await ctx.newPage();

  // ============== PARTE 1: numeroProcesso.php ==============
  console.log('\n========== PARTE 1: numeroProcesso.php ==========');
  console.log(`URL: ${URL_CONSULTA}`);
  await page.goto(URL_CONSULTA, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log('título:', await page.title());
  console.log('URL final:', page.url());
  await page.screenshot({ path: 'C:/Temp/trf1_numeroProcesso_inicial.png', fullPage: true });

  // Lista TODOS os inputs visíveis literalmente
  console.log('\n>> CAMPOS DE INPUT (literal):');
  const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
  const inputsInfo = [];
  for (let i = 0; i < inputs.length; i++) {
    try {
      const info = await inputs[i].evaluate(el => ({
        tag: el.tagName,
        type: el.type || '-',
        name: el.name || '-',
        id: el.id || '-',
        placeholder: el.placeholder || '-',
        value: el.value || '',
        size: el.size || '-',
        maxlength: el.maxLength || '-',
      }));
      inputsInfo.push(info);
      console.log(`  ${i+1}. <${info.tag}> type=${info.type} name=${info.name} id=${info.id} placeholder="${info.placeholder}" maxlen=${info.maxlength}`);
    } catch (e) {}
  }

  // Lista labels visíveis (texto associado aos inputs)
  console.log('\n>> LABELS / TEXTOS visíveis na tela:');
  const corpoTexto = await page.locator('body').innerText();
  console.log(corpoTexto.slice(0, 2500));
  console.log('--- fim do dump ---');

  // Tenta achar campo de número de processo (sem inferir, só pelos atributos)
  console.log(`\n>> Tentando colar Nº Precatório ${NUMERO_LOA} no primeiro input de texto/número...`);
  const txtInput = page.locator('input[type="text"]:visible, input[type="number"]:visible, input:not([type]):visible').first();
  try {
    await txtInput.waitFor({ timeout: 5000 });
    await txtInput.fill(NUMERO_LOA);
    console.log('  preenchido OK');
    await page.waitForTimeout(500);

    // Procura botão de pesquisar/enviar
    const btn = page.locator('input[type="submit"]:visible, button[type="submit"]:visible, button:has-text("Pesquisar"), input[value*="Pesquisar"]').first();
    await btn.click();
    console.log('  botão clicado');
    await page.waitForTimeout(4000);

    await page.screenshot({ path: 'C:/Temp/trf1_numeroProcesso_resultado.png', fullPage: true });
    const resultado = await page.locator('body').innerText();
    console.log('\n>> RESULTADO BRUTO (primeiros 2500 chars):');
    console.log(resultado.slice(0, 2500));
  } catch (e) {
    console.log('  erro ao preencher/enviar:', e.message);
  }

  // ============== PARTE 2: baixar Portaria PRESI ==============
  console.log('\n========== PARTE 2: Portaria PRESI 8886381 ==========');
  try {
    // Visita home antes para pegar cookies WAF
    await page.goto('https://www.trf1.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Tenta como APIRequest (já tem cookies)
    const respPortaria = await ctx.request.get(URL_PORTARIA);
    console.log('  status:', respPortaria.status());
    console.log('  content-type:', respPortaria.headers()['content-type']);
    const buf = await respPortaria.body();
    console.log('  bytes:', buf.length);
    const out = 'C:/Temp/auraloa-saida/manuais/PortariaPRESI8886381.pdf';
    fs.writeFileSync(out, buf);
    console.log('  salvo:', out);
    const magic = buf.slice(0, 4).toString('hex');
    console.log('  magic:', magic, magic === '25504446' ? '(PDF OK)' : '(NÃO é PDF)');
  } catch (e) {
    console.log('  erro:', e.message);
  }

  console.log('\n[*] Aguardando 30s para visualização...');
  await page.waitForTimeout(30000);
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
