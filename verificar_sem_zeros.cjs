/**
 * Testa variantes sem zeros para os 126 pendentes no TRF1
 * Variantes testadas para cada nr LOA:
 *   V1: nr LOA direto (sem transformacao)
 *   V2: nr LOA sem zeros a direita (trailing)
 *   V3: nr LOA sem zeros a esquerda (leading)
 *   V4: CNJ candidato sem zero a esquerda no sequencial
 */
const { chromium } = require('playwright');
const fs = require('fs');

const ENR_DIR = 'C:/Temp/auraloa-saida/enriquecimento/';
const CSV_IN = ENR_DIR + 'CRUZAMENTO_LOA_TRF1_v4_verificado.csv';
const CSV_OUT = ENR_DIR + 'CRUZAMENTO_LOA_TRF1_v5_sem_zeros.csv';
const URL_BASE = 'https://processual.trf1.jus.br/consultaProcessual/processo.php';

function lerCSV(p) {
  const content = fs.readFileSync(p, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const header = lines[0].replace(/^\uFEFF/, '').split(';');
  return lines.slice(1).map(line => {
    const vals = line.split(';');
    const obj = {};
    header.forEach((h, i) => obj[h] = (vals[i] || '').trim());
    return obj;
  });
}

(async () => {
  const rows = lerCSV(CSV_IN);
  const pendentes = rows.filter(r => (r.match_status || '').includes('NAO_ENCONTRADO'));
  const resolvidos = rows.filter(r => !(r.match_status || '').includes('NAO_ENCONTRADO'));

  console.log(`Pendentes: ${pendentes.length} | Resolvidos: ${resolvidos.length}`);

  // Testar primeiros 15 com todas as variantes para encontrar o padrao
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  let encontrados = 0;
  const amostra = pendentes.slice(0, 15);

  for (let i = 0; i < amostra.length; i++) {
    const r = amostra[i];
    const nrLoa = r.Precatorio || '';
    const cnj = r.cnj_candidato || '';

    const variantes = [
      { label: 'V1_loa_direto', valor: nrLoa },
      { label: 'V2_loa_sem_trail_0', valor: nrLoa.replace(/0+$/, '') },
      { label: 'V3_loa_sem_lead_0', valor: nrLoa.replace(/^0+/, '') },
      { label: 'V4_cnj_sem_0', valor: cnj.replace(/^0+/, '') },
      { label: 'V5_loa_15dig', valor: nrLoa.slice(0, 15) },
      { label: 'V6_loa_13dig', valor: nrLoa.slice(0, 13) },
    ];

    console.log(`\n[${i+1}/${amostra.length}] LOA: ${nrLoa} | R$ ${parseInt(r.Valor_RS || 0).toLocaleString()} | ${(r.UO_Devedora_Nome || '').slice(0, 20)}`);

    for (const v of variantes) {
      if (!v.valor || v.valor.length < 5) continue;
      try {
        const url = `${URL_BASE}?proc=${v.valor}&secao=TRF1&pg=1&enviar=Pesquisar`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);
        const texto = await page.locator('body').innerText();
        const naoAchou = texto.includes('Processo n\u00e3o foi encontrado') || texto.includes('Processo não foi encontrado');
        const achou = !naoAchou && (texto.includes('Partes') || texto.includes('Movimenta') || texto.includes('Classe'));

        if (achou) {
          // Extrair processo originario
          const matchOrig = texto.match(/Processo\s+Origin[aá]rio[:\s]*(\S+)/i);
          const orig = matchOrig ? matchOrig[1].trim() : '[ver detalhes]';

          console.log(`  >>> ${v.label}: "${v.valor}" -> ENCONTRADO! Orig: ${orig}`);
          r.cnj_processo_execucao = v.valor;
          r.cnj_processo_originario = orig;
          r.match_status = 'VERIFICADO_SEM_ZERO';
          r.match_metodo = v.label;
          encontrados++;
          break;
        } else {
          // silencioso para nao poluir
        }
      } catch (e) {
        // timeout, ignora
      }
    }

    if (r.match_status !== 'VERIFICADO_SEM_ZERO') {
      console.log(`  --- nenhuma variante funcionou`);
    }

    await page.waitForTimeout(500);
  }

  await browser.close();

  console.log(`\n=== RESULTADO AMOSTRA (15 primeiros) ===`);
  console.log(`Encontrados: ${encontrados}/15`);
  console.log(`Variantes que funcionaram:`);
  amostra.filter(r => r.match_status === 'VERIFICADO_SEM_ZERO').forEach(r => {
    console.log(`  ${r.match_metodo}: LOA ${r.Precatorio} -> ${r.cnj_processo_execucao} | Orig: ${r.cnj_processo_originario}`);
  });
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
