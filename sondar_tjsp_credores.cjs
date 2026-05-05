// Sonda o portal "Credores" do TJSP DEPRE.
// URL base vista na sidebar: /Precatorios/Precatorios/Credores
// Objetivo: ver se tem busca individual ou listagem exportavel.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URLS = [
  'https://www.tjsp.jus.br/Precatorios/Precatorios/Credores',
  'https://www.tjsp.jus.br/Precatorios/Precatorios/EntidadesDevedoras',
  'https://www.tjsp.jus.br/Precatorios/Precatorios/GestaoPrecatorios',
];

const SAIDA = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/_sonda';

async function sondarPagina(ctx, url) {
  console.log(`\n========== ${url} ==========`);
  const page = await ctx.newPage();
  const resultado = { url, status: null, title: null, tabelas: [], forms: [], links_interesse: [], downloads: [] };

  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    resultado.status = resp ? resp.status() : null;
    resultado.final_url = page.url();
    resultado.title = await page.title().catch(() => null);
    await page.waitForTimeout(3000);

    console.log(`  status=${resultado.status} final=${resultado.final_url}`);
    console.log(`  title=${resultado.title}`);

    // Tabelas
    const tabelas = await page.$$eval('table', (ts) =>
      ts.map((t, i) => ({
        idx: i,
        id: t.id || '',
        classe: t.className || '',
        linhas: t.querySelectorAll('tr').length,
        primeiras: Array.from(t.querySelectorAll('tr'))
          .slice(0, 5)
          .map((r) =>
            Array.from(r.querySelectorAll('th,td')).map((c) => (c.textContent || '').trim().slice(0, 60))
          ),
      }))
    );
    tabelas.sort((a, b) => b.linhas - a.linhas);
    resultado.tabelas = tabelas.slice(0, 5);
    console.log(`  tabelas=${tabelas.length} Top 3: ${tabelas.slice(0, 3).map((t) => `${t.id || 'sem-id'}(${t.linhas}lin)`).join(', ')}`);

    // Formularios
    const forms = await page.$$eval('form', (fs) =>
      fs.map((f) => ({
        action: f.action,
        method: f.method,
        inputs: Array.from(f.querySelectorAll('input,select,textarea')).map((i) => ({
          name: i.name,
          id: i.id,
          type: i.type || i.tagName.toLowerCase(),
          value: (i.value || '').slice(0, 40),
        })),
      }))
    );
    resultado.forms = forms;
    console.log(`  formularios=${forms.length}`);
    for (const f of forms) {
      console.log(`    ${f.method} ${f.action.slice(0, 70)}  inputs=${f.inputs.length}`);
      for (const i of f.inputs.slice(0, 8)) {
        if (!i.name && !i.id) continue;
        console.log(`      - ${i.type} name=${i.name || ''} id=${i.id || ''}`);
      }
    }

    // Links interessantes dentro da pagina (precatorio, credor, download, consulta)
    const interesse = /precat|credor|consult|download|mapa|pendent|expedid|pesquis|or\u00e7ament|\.csv|\.pdf|\.xlsx|\.xls|FileFetch/i;
    const links = await page.$$eval('a[href]', (as) =>
      as.map((a) => ({ href: a.href, texto: (a.textContent || '').trim().slice(0, 80) }))
    );
    const vistos = new Set();
    for (const l of links) {
      if (!l.href || vistos.has(l.href)) continue;
      vistos.add(l.href);
      if (interesse.test(l.href) || interesse.test(l.texto)) {
        resultado.links_interesse.push(l);
      }
    }
    console.log(`  links de interesse: ${resultado.links_interesse.length}`);
    for (const l of resultado.links_interesse.slice(0, 20)) {
      console.log(`    - ${l.texto.slice(0, 60).padEnd(62)} -> ${l.href.slice(0, 90)}`);
    }

    // Salva HTML
    const slug = url.replace(/[^a-z0-9]+/gi, '_').slice(-60);
    const htmlPath = path.join(SAIDA, `credores_${slug}.html`);
    fs.writeFileSync(htmlPath, await page.content(), 'utf-8');

    const texto = await page.evaluate(() => (document.body.innerText || '').trim());
    const txtPath = path.join(SAIDA, `credores_${slug}.txt`);
    fs.writeFileSync(txtPath, texto, 'utf-8');

    console.log(`  salvo: ${htmlPath}`);
    console.log(`  texto_inicio: ${texto.slice(0, 400).replace(/\s+/g, ' ')}`);
  } catch (e) {
    resultado.erro = e.message.slice(0, 200);
    console.log(`  ERRO: ${resultado.erro}`);
  } finally {
    await page.close();
  }
  return resultado;
}

(async () => {
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  // Aquece home
  const home = await ctx.newPage();
  await home.goto('https://www.tjsp.jus.br/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await home.waitForTimeout(1500);
  await home.close();

  const relatorio = { gerado_em: new Date().toISOString(), paginas: [] };
  for (const url of URLS) {
    relatorio.paginas.push(await sondarPagina(ctx, url));
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const relPath = path.join(SAIDA, `_sonda_credores_${ts}.json`);
  fs.writeFileSync(relPath, JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\n[OK] ${relPath}`);

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
