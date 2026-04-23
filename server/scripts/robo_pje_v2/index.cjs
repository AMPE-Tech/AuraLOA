/**
 * robo_pje_v2/index.cjs — Robô PJe v2 (extração estruturada de PARTES)
 * ═══════════════════════════════════════════════════════════════════════
 * AUTORIZADO por Marcos em 17/04/2026.
 * Criado como ROBÔ NOVO sem alterar server/scripts/robo_pje/ (blindado).
 *
 * FOCO EXCLUSIVO: extrair polo ativo / passivo / representantes de um
 * processo no PJe 1g TRF1, devolvendo nome + documento (CPF/CNPJ).
 *
 * Motivação: o robô antigo retorna `partes: []` porque usa regex em texto
 * achatado. O PJe moderno renderiza partes via DOM estruturado (listas de
 * cards / tabela rich-table / details-summary). Este robô tenta múltiplos
 * seletores e faz fallback para regex como último recurso.
 *
 * USO CLI:
 *   node server/scripts/robo_pje_v2/index.cjs --cnj "0013267-78.1994.4.01.3300" [--tribunal=TRF1] [--headless=false]
 *
 * USO MÓDULO:
 *   const { extrairPartes } = require('./robo_pje_v2/index.cjs');
 *   const r = await extrairPartes(cnj, { headless: true });
 *
 * RETORNO:
 *   {
 *     cnj_pesquisado, encontrado, metodo_usado,
 *     partes: [{ tipo, polo, nome, documento_tipo, documento, representantes }],
 *     credor_identificado: { nome, documento, origem },  // melhor match polo ativo
 *     timestamp
 *   }
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const URL_PJE_TRF1 = "https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam";

async function criarBrowser(headless) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  return { browser, context };
}

// Detecta tipo de documento e extrai: "999.999.999-99" / "99.999.999/9999-99"
function detectarDocumento(texto) {
  if (!texto) return { tipo: null, valor: null };
  const mCnpj = texto.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
  if (mCnpj) return { tipo: "CNPJ", valor: mCnpj[1] };
  const mCpf = texto.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
  if (mCpf) return { tipo: "CPF", valor: mCpf[1] };
  // Mascarado: "CPF: ***.***.***-99" — guardamos bruto
  const mask = texto.match(/(\*{3}\.?\*{3}\.?\*{3}-?\d{2}|CPF:\s*[\*\d\.\-]+)/);
  if (mask) return { tipo: "CPF_MASCARADO", valor: mask[1].replace(/^CPF:\s*/i, "") };
  return { tipo: null, valor: null };
}

function classificarPolo(tipo) {
  if (!tipo) return "DESCONHECIDO";
  const t = tipo.toUpperCase();
  if (/AUTOR|AUTORA|REQUERENTE|EXEQUENTE|IMPETRANTE|RECLAMANTE|RECORRENTE/.test(t)) return "ATIVO";
  if (/R[EÉ]U|R[EÉ]|REQUERID[OA]|EXECUTAD[OA]|IMPETRAD[OA]|RECLAMAD[OA]|RECORRID[OA]/.test(t)) return "PASSIVO";
  if (/ADVOGAD[OA]|PROCURAD|DEFENSOR/.test(t)) return "REPRESENTANTE";
  return "DESCONHECIDO";
}

async function navegarParaDetalhesProcesso(page, cnj) {
  console.log("[v2] Acessando PJe 1g TRF1 consulta pública...");
  await page.goto(URL_PJE_TRF1, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);

  const cnjLimpo = cnj.replace(/[.\-\/]/g, "");
  const campo = page.locator('input[id*="processo"], input[id*="Processo"]').first();
  await campo.waitFor({ timeout: 10000 });
  await campo.click();
  await campo.fill("");
  await page.waitForTimeout(300);
  await campo.pressSequentially(cnjLimpo, { delay: 50 });
  await page.waitForTimeout(1000);
  await campo.press("Enter");
  await page.waitForTimeout(6000);

  const bodyTxt = await page.locator("body").innerText();
  if (/Nenhum processo encontrado|0 resultados/i.test(bodyTxt)) {
    return { achado: false, motivo: "nao_encontrado_lista" };
  }

  // Achar link openPopUp e navegar direto (sem popup window)
  const links = await page.locator("a[onclick*='openPopUp']").all();
  if (links.length === 0) {
    return { achado: false, motivo: "sem_link_popup" };
  }
  const onclick = (await links[0].getAttribute("onclick")) || "";
  const m = onclick.match(/openPopUp\([^,]+,\s*'([^']+)'\)/);
  if (!m) return { achado: false, motivo: "onclick_sem_url" };

  const url = "https://pje1g-consultapublica.trf1.jus.br" + m[1];
  console.log(`[v2] Abrindo detalhes: ${url.substring(0, 90)}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);
  return { achado: true, url };
}

// Estratégia 1 — tabela estruturada (PJe TRF1 usa rich-table com classes id='partes*')
async function extrairPorTabelaEstruturada(page) {
  const partes = [];
  // Seletores observados no PJe TRF1: .partes-processo, [id*=partes], .sub-titulo + tabela
  const blocos = await page.locator("[id*='partes'], [id*='Partes'], .partes-processo, .rich-panel").all();
  for (const bloco of blocos) {
    try {
      const html = await bloco.innerHTML({ timeout: 1500 });
      if (!/AUTOR|REQUERENTE|EXEQUENTE|RÉU|REQUERIDO|EXECUTADO|IMPETRANTE/i.test(html)) continue;
      const linhas = await bloco.locator("tr, li, .parte, .partes-processo-item").all();
      for (const li of linhas) {
        try {
          const txt = (await li.innerText({ timeout: 1000 })).trim();
          if (!txt || txt.length < 4) continue;
          const tipoMatch = txt.match(/^(AUTOR[A]?|REQUERENTE|EXEQUENTE|IMPETRANTE|RÉU|RÉ|REQUERID[OA]|EXECUTAD[OA]|IMPETRAD[OA]|ADVOGAD[OA])/i);
          if (!tipoMatch) continue;
          const tipo = tipoMatch[1].toUpperCase();
          const sobrando = txt.slice(tipoMatch[0].length).replace(/^[\s:,\-]+/, "");
          const doc = detectarDocumento(sobrando);
          const nome = sobrando.replace(doc.valor || "", "").replace(/CPF:|CNPJ:/i, "").trim().split(/\n/)[0].slice(0, 200);
          partes.push({ tipo, polo: classificarPolo(tipo), nome, documento_tipo: doc.tipo, documento: doc.valor });
        } catch {}
      }
    } catch {}
  }
  return partes;
}

// Estratégia 2 — details/summary (accordion de partes)
async function extrairPorDetails(page) {
  const partes = [];
  const details = await page.locator("details, .accordion, .collapse").all();
  for (const d of details) {
    try {
      const head = (await d.locator("summary, .accordion-header, .card-header").first().innerText({ timeout: 1000 }).catch(() => "")).trim();
      if (!/parte|polo|autor|réu|exequente|executado/i.test(head)) continue;
      await d.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(400);
      const body = (await d.innerText({ timeout: 2000 })).trim();
      const re = /(AUTOR[A]?|REQUERENTE|EXEQUENTE|IMPETRANTE|RÉU|RÉ|REQUERID[OA]|EXECUTAD[OA]|IMPETRAD[OA]|ADVOGAD[OA])[:\s\-]+([^\n]{2,200})/gi;
      let m;
      while ((m = re.exec(body)) !== null) {
        const tipo = m[1].toUpperCase();
        const doc = detectarDocumento(m[2]);
        const nome = m[2].replace(doc.valor || "", "").replace(/CPF:|CNPJ:/i, "").trim().slice(0, 200);
        partes.push({ tipo, polo: classificarPolo(tipo), nome, documento_tipo: doc.tipo, documento: doc.valor });
      }
    } catch {}
  }
  return partes;
}

// Estratégia 3 — regex em texto global (fallback — igual ao robô antigo, mas após esgotar estruturais)
async function extrairPorRegexGlobal(page) {
  const partes = [];
  const body = await page.locator("body").innerText({ timeout: 3000 });
  const re = /(AUTOR[A]?|REQUERENTE|EXEQUENTE|IMPETRANTE|RÉU|RÉ|REQUERID[OA]|EXECUTAD[OA]|IMPETRAD[OA]|ADVOGAD[OA])[:\s\-]+([^\n]{3,200})/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    const tipo = m[1].toUpperCase();
    const valor = m[2].trim();
    const doc = detectarDocumento(valor);
    const nome = valor.replace(doc.valor || "", "").replace(/CPF:|CNPJ:/i, "").trim().slice(0, 200);
    if (nome.length >= 4) {
      partes.push({ tipo, polo: classificarPolo(tipo), nome, documento_tipo: doc.tipo, documento: doc.valor });
    }
  }
  return partes;
}

function dedupePartes(partes) {
  const seen = new Set();
  const out = [];
  for (const p of partes) {
    const k = `${p.polo}|${p.nome}|${p.documento || ""}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function escolherCredor(partes) {
  // Regra simples: primeira parte do polo ATIVO com documento não mascarado
  const ativos = partes.filter(p => p.polo === "ATIVO");
  const comDoc = ativos.find(p => p.documento && p.documento_tipo !== "CPF_MASCARADO");
  if (comDoc) return { ...comDoc, origem: "polo_ativo_com_documento" };
  const semDoc = ativos[0];
  if (semDoc) return { ...semDoc, origem: "polo_ativo_sem_documento" };
  return null;
}

async function extrairPartes(cnj, options = {}) {
  const { headless = true, dumpHtml = null } = options;
  const resultado = {
    cnj_pesquisado: cnj,
    encontrado: false,
    metodo_usado: null,
    url_detalhes: null,
    partes: [],
    credor_identificado: null,
    erro: null,
    timestamp: new Date().toISOString(),
  };

  let browser;
  try {
    const ctx = await criarBrowser(headless);
    browser = ctx.browser;
    const page = await ctx.context.newPage();
    page.setDefaultTimeout(45000);

    const nav = await navegarParaDetalhesProcesso(page, cnj);
    if (!nav.achado) {
      resultado.erro = `Navegação falhou: ${nav.motivo}`;
      return resultado;
    }
    resultado.encontrado = true;
    resultado.url_detalhes = nav.url;

    if (dumpHtml) {
      try {
        const html = await page.content();
        fs.writeFileSync(dumpHtml, html, "utf-8");
        console.log(`[v2] HTML dump: ${dumpHtml}`);
      } catch {}
    }

    // Tentativa 1
    let partes = await extrairPorTabelaEstruturada(page);
    if (partes.length > 0) resultado.metodo_usado = "tabela_estruturada";

    // Tentativa 2
    if (partes.length === 0) {
      partes = await extrairPorDetails(page);
      if (partes.length > 0) resultado.metodo_usado = "details_accordion";
    }

    // Tentativa 3 (fallback)
    if (partes.length === 0) {
      partes = await extrairPorRegexGlobal(page);
      if (partes.length > 0) resultado.metodo_usado = "regex_global_fallback";
    }

    resultado.partes = dedupePartes(partes);
    resultado.credor_identificado = escolherCredor(resultado.partes);
    console.log(`[v2] partes=${resultado.partes.length} | método=${resultado.metodo_usado || "nenhum"} | credor=${resultado.credor_identificado?.nome || "[não identificado]"}`);
  } catch (e) {
    resultado.erro = (e.message || String(e)).substring(0, 300);
    console.log(`[v2] Erro: ${resultado.erro}`);
  } finally {
    if (browser) await browser.close();
  }
  return resultado;
}

// ── CLI ─────────────────────────────────────────────────────────────────
function parseArgs() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) { out[m[1]] = m[2]; continue; }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) { out[key] = next; i++; }
      else { out[key] = true; }
    }
  }
  return out;
}

if (require.main === module) {
  const args = parseArgs();
  if (!args.cnj) {
    console.error("USO: node robo_pje_v2/index.cjs --cnj \"0013267-78.1994.4.01.3300\" [--headless=false] [--dump=saida.html]");
    process.exit(2);
  }
  const headless = String(args.headless || "true") !== "false";
  extrairPartes(args.cnj, { headless, dumpHtml: args.dump || null }).then(r => {
    console.log("\n" + JSON.stringify(r, null, 2));
    process.exit(r.erro ? 1 : 0);
  });
}

module.exports = { extrairPartes };
