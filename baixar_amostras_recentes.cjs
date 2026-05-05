// Baixa 1 amostra de cada tipo de comunicado recente para analise de formato.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda/amostras_recentes';

const ALVOS = [
  { nome: 'MOC_2025', codigo: 44624, tipo: 'MOC consolidado entidades 2025' },
  { nome: 'MOC_2024', codigo: 37264, tipo: 'MOC consolidado entidades 2024' },
  { nome: 'Plano_Pagto_FAZ_ESTADO_2026', codigo: 16937, tipo: 'Plano de Pagamento Fazenda Estado 2026' },
  { nome: 'Plano_Pagto_ITAQUAQUECETUBA_2026', codigo: 19658, tipo: 'Plano de Pagamento Itaquaquecetuba 2026' },
  { nome: 'Edital_Acordo_ITANHAEM_2026', codigo: 64600, tipo: 'Edital de Acordo Itanhaem abril/2026' },
  { nome: 'Edital_Acordo_FAZ_ESTADO_2026', codigo: 64471, tipo: 'Edital de Acordo Fazenda Estado abril/2026' },
  { nome: 'Mapa_Anual_2025', codigo: 63491, tipo: 'Mapa Anual 2025 - Divida 31/12/2025' },
];

async function abrirPegarFileFetch(ctx, codigo) {
  const url = `https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=${codigo}&pagina=1`;
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    const anexos = await page.$$eval('a[href*="FileFetch.ashx"]', as =>
      as.map(a => ({ href: a.href, titulo: a.title || a.textContent?.trim() || '' }))
    );
    return anexos;
  } finally {
    await page.close();
  }
}

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });
  const home = await ctx.newPage();
  await home.goto('https://www.tjsp.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await home.waitForTimeout(1500);
  await home.close();

  for (const a of ALVOS) {
    console.log(`\n=== ${a.nome} (${a.codigo}) - ${a.tipo} ===`);
    try {
      const anexos = await abrirPegarFileFetch(ctx, a.codigo);
      console.log(`  anexos FileFetch: ${anexos.length}`);
      for (const x of anexos) console.log(`    - ${x.titulo} -> ${x.href}`);
      if (anexos.length === 0) {
        console.log('  NENHUM anexo oficial. Pulando.');
        continue;
      }
      // Baixa o primeiro
      const url = anexos[0].href;
      const resp = await ctx.request.get(url, { maxRedirects: 5, timeout: 120000 });
      const buf = await resp.body();
      const magic = buf.slice(0, 4).toString('hex');
      const isPdf = magic.startsWith('25504446');
      const ext = isPdf ? 'pdf' : 'bin';
      const out = path.join(SAIDA, `${a.nome}_${anexos[0].titulo.replace(/[^a-z0-9]+/gi, '_').slice(0, 30)}.${ext}`);
      fs.writeFileSync(out, buf);
      console.log(`  baixado: ${out}  (${buf.length} bytes, ${isPdf ? 'PDF' : 'OUTRO'})`);
    } catch (e) {
      console.log(`  ERRO: ${e.message.slice(0, 150)}`);
    }
  }

  await browser.close();
  console.log(`\n[OK] amostras em ${SAIDA}`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
