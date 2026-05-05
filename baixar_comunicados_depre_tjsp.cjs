// Camada 2 TJSP — baixa comunicados DEPRE sobre "Entidades Devedoras com Precatorios Inseridos".
// Fonte: https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=159
// Saida: ArquivosLOA/camada2/tjsp/comunicados/
//
// MANTRA: baixar raw + mostrar antes de parsear. Validar magic bytes.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/comunicados';
const INDEX_URL = 'https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=159';

// Filtro para reconhecer comunicados relevantes
const PADRAO_TITULO = /ENTIDADES\s+DEVEDORAS\s+COM\s+PRECAT[\u00d3O]RIOS\s+INSERIDOS/i;

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

async function baixarAnexos(ctx, page, pastaComunicado, codigo) {
  // Coleta todos os href que tenham aparencia de anexo (pdf, xlsx, doc, docx)
  const anexos = await page.$$eval('a[href]', (as) =>
    as
      .map((a) => ({ href: a.href, texto: (a.textContent || '').trim().slice(0, 120) }))
      .filter((l) => /\.(pdf|xlsx?|docx?|ods|csv|zip)(\?|$)/i.test(l.href))
  );

  const baixados = [];
  for (const a of anexos) {
    try {
      const resp = await ctx.request.get(a.href, { maxRedirects: 5 });
      const buf = await resp.body();
      const ext = (a.href.match(/\.(pdf|xlsx?|docx?|ods|csv|zip)/i) || ['', 'bin'])[1].toLowerCase();
      const nome = `anexo_${slug(a.texto || 'sem_titulo')}_${baixados.length + 1}.${ext}`;
      const destino = path.join(pastaComunicado, nome);
      fs.writeFileSync(destino, buf);
      const magic = buf.slice(0, 4).toString('hex');
      const isPdf = magic === '25504446';
      const isOffice = buf.slice(0, 2).toString('hex') === '504b'; // xlsx/docx = zip
      baixados.push({
        href: a.href,
        texto: a.texto,
        bytes: buf.length,
        magic,
        tipo: isPdf ? 'PDF' : isOffice ? 'OFFICE' : 'OUTRO',
        arquivo: destino,
      });
      console.log(
        `      [${resp.status()}] ${buf.length} bytes | ${isPdf ? 'PDF' : isOffice ? 'OFFICE' : 'outro'} | ${nome}`
      );
    } catch (e) {
      console.log(`      ERRO anexo ${a.href}: ${e.message.slice(0, 100)}`);
    }
  }
  return anexos.length === 0 ? [] : baixados;
}

(async () => {
  if (!fs.existsSync(BASE)) fs.mkdirSync(BASE, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  console.log('[*] Aquecendo home TJSP...');
  const home = await ctx.newPage();
  await home.goto('https://www.tjsp.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await home.waitForTimeout(2000);
  await home.close();

  // Vai na listagem de comunicados do DEPRE
  console.log(`[*] Abrindo indice: ${INDEX_URL}`);
  const page = await ctx.newPage();
  await page.goto(INDEX_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Extrai todos os links para Comunicado?codigoComunicado=XXXX
  const comunicados = await page.$$eval('a[href*="codigoComunicado="]', (as) =>
    as.map((a) => ({
      href: a.href,
      texto: (a.textContent || '').trim(),
    }))
  );

  // Dedup por codigo
  const porCodigo = new Map();
  for (const c of comunicados) {
    const m = c.href.match(/codigoComunicado=(\d+)/);
    if (!m) continue;
    const codigo = m[1];
    if (!porCodigo.has(codigo)) porCodigo.set(codigo, c);
  }

  // Filtra os que batem com "ENTIDADES DEVEDORAS COM PRECATORIOS INSERIDOS"
  const relevantes = [];
  for (const [codigo, c] of porCodigo.entries()) {
    if (PADRAO_TITULO.test(c.texto)) relevantes.push({ codigo, ...c });
  }

  console.log(`\n[INFO] Comunicados totais na pagina: ${porCodigo.size}`);
  console.log(`[INFO] Comunicados "Entidades Devedoras...Inseridos": ${relevantes.length}`);

  const relatorio = {
    gerado_em: new Date().toISOString(),
    indice: INDEX_URL,
    total_pagina: porCodigo.size,
    filtrados: relevantes.length,
    itens: [],
  };

  for (const c of relevantes) {
    console.log(`\n===== Comunicado ${c.codigo} =====`);
    console.log(`  titulo: ${c.texto.slice(0, 120)}`);
    console.log(`  url: ${c.href}`);

    const pastaCom = path.join(BASE, `comunicado_${c.codigo}`);
    if (!fs.existsSync(pastaCom)) fs.mkdirSync(pastaCom, { recursive: true });

    const pg = await ctx.newPage();
    try {
      const resp = await pg.goto(c.href, { waitUntil: 'networkidle', timeout: 60000 });
      await pg.waitForTimeout(2500);

      const titulo = await pg.title().catch(() => null);
      const textoBody = await pg.evaluate(() => (document.body.innerText || '').trim());
      const dataMatch = textoBody.match(/Comunicado\s+(\d{2}\/\d{2}\/\d{4})/i);
      const html = await pg.content();

      const htmlPath = path.join(pastaCom, 'pagina.html');
      const txtPath = path.join(pastaCom, 'texto.txt');
      fs.writeFileSync(htmlPath, html, 'utf-8');
      fs.writeFileSync(txtPath, textoBody, 'utf-8');

      console.log(`  status: ${resp ? resp.status() : '?'}  bytes HTML: ${html.length}`);
      console.log(`  data: ${dataMatch ? dataMatch[1] : 'n/a'}`);
      console.log(`  chars texto: ${textoBody.length}`);
      console.log(`  inicio: ${textoBody.slice(0, 300).replace(/\s+/g, ' ')}...`);

      console.log(`  [anexos]`);
      const anexos = await baixarAnexos(ctx, pg, pastaCom, c.codigo);

      relatorio.itens.push({
        codigo: c.codigo,
        titulo: c.texto,
        url: c.href,
        data: dataMatch ? dataMatch[1] : null,
        status: resp ? resp.status() : null,
        html: htmlPath,
        texto: txtPath,
        anexos,
      });
    } catch (e) {
      console.log(`  ERRO: ${e.message.slice(0, 200)}`);
      relatorio.itens.push({ codigo: c.codigo, titulo: c.texto, url: c.href, erro: e.message });
    } finally {
      await pg.close();
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const relPath = path.join(BASE, `_relatorio_download_${ts}.json`);
  fs.writeFileSync(relPath, JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\n[OK] Relatorio: ${relPath}`);

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
