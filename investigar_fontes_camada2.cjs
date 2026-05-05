// Camada 2 — Investigacao empirica de fontes TRF3 PrecWeb + TRF5 Mapas.
// MANTRA: descobrir URLs reais antes de baixar. Nunca supor.
// Output: ArquivosLOA/camada2/_investigacao_{timestamp}.json

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA_BASE = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2';

const PORTAIS = [
  {
    tribunal: 'TRF3',
    paginas: [
      'https://www.trf3.jus.br/secretaria-da-presidencia/precatorios',
      'https://web.trf3.jus.br/precweb/',
      'https://www.trf3.jus.br/documentos/sepe/Pagamentos/2026/',
      'https://www.trf3.jus.br/documentos/sepe/Pagamentos/',
    ],
  },
  {
    tribunal: 'TRF5',
    paginas: [
      'https://rpvprecatorio.trf5.jus.br/downloadMapas/',
      'https://www.trf5.jus.br/precatorios',
      'https://www.trf5.jus.br/',
    ],
  },
];

const EXT_INTERESSE = /\.(csv|xlsx?|ods|pdf|htm|html|zip)(\?|$)/i;

async function investigarPagina(ctx, url) {
  const resultado = {
    url,
    status: null,
    title: null,
    total_links: 0,
    links_download: [],
    erro: null,
  };

  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    resultado.status = resp ? resp.status() : null;
    resultado.title = await page.title().catch(() => null);
    await page.waitForTimeout(2500);

    const links = await page.$$eval('a[href]', (as) =>
      as.map((a) => ({
        href: a.href,
        texto: (a.textContent || '').trim().slice(0, 120),
      }))
    );
    resultado.total_links = links.length;

    const vistos = new Set();
    for (const l of links) {
      if (!l.href || vistos.has(l.href)) continue;
      vistos.add(l.href);
      if (EXT_INTERESSE.test(l.href)) {
        resultado.links_download.push(l);
      }
    }
  } catch (e) {
    resultado.erro = e.message.slice(0, 200);
  } finally {
    await page.close();
  }
  return resultado;
}

async function headCheck(ctx, url) {
  try {
    const r = await ctx.request.fetch(url, { method: 'HEAD', maxRedirects: 5, timeout: 20000 });
    return {
      status: r.status(),
      content_type: r.headers()['content-type'] || null,
      content_length: r.headers()['content-length'] || null,
    };
  } catch (e) {
    return { status: 'erro', erro: e.message.slice(0, 150) };
  }
}

(async () => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(SAIDA_BASE, `_investigacao_${ts}.json`);
  if (!fs.existsSync(SAIDA_BASE)) fs.mkdirSync(SAIDA_BASE, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const relatorio = { gerado_em: new Date().toISOString(), portais: [] };

  for (const portal of PORTAIS) {
    console.log(`\n========== ${portal.tribunal} ==========`);
    const dados = { tribunal: portal.tribunal, paginas: [] };

    for (const url of portal.paginas) {
      console.log(`\n[*] Investigando: ${url}`);
      const info = await investigarPagina(ctx, url);
      console.log(
        `    status=${info.status} links_total=${info.total_links} downloads=${info.links_download.length}${info.erro ? ' ERRO: ' + info.erro : ''}`
      );

      for (const link of info.links_download.slice(0, 40)) {
        const head = await headCheck(ctx, link.href);
        link.head = head;
        console.log(
          `      - [${head.status}] ${link.texto.slice(0, 60)} -> ${link.href.slice(0, 90)}`
        );
      }

      dados.paginas.push(info);
    }

    relatorio.portais.push(dados);
  }

  fs.writeFileSync(out, JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\n[OK] Relatorio salvo em: ${out}`);

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
