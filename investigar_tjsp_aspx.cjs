// Fase 2 — Investigar paginas .aspx do TJSP + 1 comunicado de entidades devedoras.
// Confirmar se tem tabelas/lista de precatorios baixaveis.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SAIDA_BASE = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2';

const ALVOS = [
  {
    nome: 'Precatorios Pendentes de Pagamento',
    url: 'http://www.tjsp.jus.br/cac/scp/webRelPublicLstPagPrecatPendentes.aspx',
  },
  {
    nome: 'Pagamentos Disponibilizados',
    url: 'http://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatefetuados.aspx',
  },
  {
    nome: 'Pesquisa de Precatorios e Pagamentos',
    url: 'http://www.tjsp.jus.br/cac/scp/webmenupesquisa.aspx',
  },
  {
    nome: 'Comunicado 53210 - Entidades Devedoras com Precatorios Inseridos',
    url: 'https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=53210&pagina=1',
  },
];

(async () => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(SAIDA_BASE, `_investigacao_tjsp_aspx_${ts}.json`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  const relatorio = { gerado_em: new Date().toISOString(), alvos: [] };

  for (const alvo of ALVOS) {
    console.log(`\n========== ${alvo.nome} ==========`);
    console.log(`URL: ${alvo.url}`);
    const page = await ctx.newPage();
    const dados = { ...alvo };
    try {
      const resp = await page.goto(alvo.url, { waitUntil: 'networkidle', timeout: 60000 });
      dados.status = resp ? resp.status() : null;
      dados.final_url = page.url();
      dados.title = await page.title().catch(() => null);
      await page.waitForTimeout(3500);

      dados.tabelas_count = await page.$$eval('table', (ts) => ts.length);
      dados.forms_count = await page.$$eval('form', (fs) => fs.length);

      // Extrai amostra das 3 primeiras tabelas
      dados.amostra_tabelas = await page.$$eval('table', (tables) =>
        tables.slice(0, 3).map((t, i) => {
          const rows = Array.from(t.querySelectorAll('tr')).slice(0, 5);
          return {
            idx: i,
            id: t.id || '',
            class: t.className || '',
            total_linhas: t.querySelectorAll('tr').length,
            primeiras_linhas: rows.map((r) =>
              Array.from(r.querySelectorAll('th,td')).map((c) =>
                (c.textContent || '').trim().slice(0, 80)
              )
            ),
          };
        })
      );

      // Campos de formulario (interativo)
      dados.inputs = await page.$$eval('input,select', (els) =>
        els.slice(0, 30).map((el) => ({
          name: el.name,
          id: el.id,
          type: el.type || el.tagName.toLowerCase(),
          value: el.value ? String(el.value).slice(0, 40) : null,
        }))
      );

      // Dropdowns relevantes (ano/orgao etc)
      dados.selects = await page.$$eval('select', (els) =>
        els.map((s) => ({
          name: s.name,
          id: s.id,
          opcoes_count: s.options.length,
          opcoes_amostra: Array.from(s.options).slice(0, 10).map((o) => ({
            value: o.value,
            text: (o.textContent || '').trim().slice(0, 60),
          })),
        }))
      );

      // Texto total da pagina (primeiros 1500 chars)
      dados.texto_inicio = await page.evaluate(() =>
        (document.body.innerText || '').trim().slice(0, 1500)
      );

      // Salva HTML completo para analise posterior
      const htmlFile = path.join(
        SAIDA_BASE,
        `${alvo.nome.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}.html`
      );
      fs.writeFileSync(htmlFile, await page.content(), 'utf-8');
      dados.html_salvo = htmlFile;

      console.log(`status=${dados.status}`);
      console.log(`title=${dados.title}`);
      console.log(`tabelas=${dados.tabelas_count} forms=${dados.forms_count}`);
      console.log(`selects=${dados.selects.length} inputs=${dados.inputs.length}`);
      for (const s of dados.selects) {
        console.log(
          `  select #${s.id || s.name}: ${s.opcoes_count} opcoes ex: ${s.opcoes_amostra.slice(0, 3).map((o) => o.text).join(' | ')}`
        );
      }
      for (const t of dados.amostra_tabelas) {
        console.log(
          `  tabela #${t.idx} (id=${t.id} class=${t.class.slice(0, 30)}) total=${t.total_linhas} linhas`
        );
        for (const r of t.primeiras_linhas.slice(0, 3)) {
          console.log(`    ${r.slice(0, 6).map((c) => c.slice(0, 35)).join(' | ')}`);
        }
      }
      console.log(`texto_inicio: ${dados.texto_inicio.slice(0, 300).replace(/\s+/g, ' ')}`);
    } catch (e) {
      dados.erro = e.message.slice(0, 300);
      console.log(`ERRO: ${dados.erro}`);
    } finally {
      await page.close();
    }
    relatorio.alvos.push(dados);
  }

  fs.writeFileSync(out, JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\n[OK] ${out}`);

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
