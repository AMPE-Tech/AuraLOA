const { chromium } = require('playwright');

// 5 números da LOA para testar a hipótese "zero à esquerda = CNJ válido"
const TESTES = [
  { n: '1363102520254010000', v: 'R$ 1.044.686.858', tipo: 'FUNDEF #1' },
  { n: '7617735120244010000', v: 'R$ 504.641.115',   tipo: 'Desapropr. #5' },
  { n: '3650677920244010000', v: 'R$ 28.116.915',    tipo: 'DNIT #114' },
  { n: '1145900220254010000', v: 'R$ 200.529.000',   tipo: 'IPI #21' },
  { n: '1344378720254010000', v: 'R$ 130.604.993',   tipo: 'INCRA #41' },
];

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  for (const t of TESTES) {
    const url = `https://processual.trf1.jus.br/consultaProcessual/processo.php?proc=${t.n}&secao=TRF1&pg=1&enviar=Pesquisar`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3500);
      const texto = await page.locator('body').innerText();
      console.log(`\n--- RAW ${t.tipo} ---`);
      console.log(texto.slice(0, 1500));
      console.log('--- end raw ---');

      const cnjMatch = texto.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
      const naoEncontrado = texto.includes('Processo não foi encontrado');
      const temPartes = texto.includes('Autor') || texto.includes('Réu') || texto.includes('Parte');

      console.log(`\n[${t.tipo}] ${t.n} (${t.v})`);
      console.log(`  CNJ formatado: ${cnjMatch ? cnjMatch[1] : '(não detectado)'}`);
      console.log(`  Encontrado?    ${naoEncontrado ? 'NÃO' : (temPartes ? 'SIM' : 'parcial')}`);
      if (!naoEncontrado && temPartes) {
        // Extrai primeiras 500 chars após o CNJ
        const idx = texto.indexOf(cnjMatch[1]);
        if (idx >= 0) {
          const trecho = texto.slice(idx, idx + 800).replace(/\s+/g, ' ');
          console.log(`  Dados: ${trecho}`);
        }
      }
    } catch (e) {
      console.log(`  ERRO: ${e.message.slice(0, 100)}`);
    }
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
