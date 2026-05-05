/**
 * _portal_transp_caso1_incra.cjs
 * Caso 1 — INCRA R$26,4M Desapropriação (precatório 1666808420254010000)
 * Consulta 4 endpoints do Portal da Transparência, salva JSON bruto,
 * mostra campo por campo na tela para análise manual.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve("Saida/portal_transp/caso1_incra_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const API_KEY = process.env.PORTAL_API_KEY || "6081aeff3e70fc8c1fb98be64e427669";
const PRECATORIO = {
  loaNum: "1666808420254010000",
  uoDevedoraCodigo: "49201",   // INCRA SIAFI
  uoDevedoraNome: "INCRA - Instituto Nacional de Colonização e Reforma Agrária",
  cnpjInstituicao: "00375972000160",
  valor: 26_400_020,
  tipoCausa: "Desapropriação por Interesse Social",
  ano: 2026,
};

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "GET",
      headers: { "chave-api-dados": API_KEY, "Accept": "application/json" },
    };
    const req = https.request(opts, (res) => {
      let body = ""; res.on("data", c => body += c);
      res.on("end", () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

async function consultar(label, url) {
  console.log(`\n══════════════════════════════════════════════════════════════════`);
  console.log(`▶ ${label}`);
  console.log(`  URL: ${url}`);
  const t0 = Date.now();
  const { status, body } = await httpGet(url);
  const dur = Date.now() - t0;
  console.log(`  HTTP ${status} · ${dur}ms · ${body.length} bytes`);

  let data = null;
  try { data = JSON.parse(body); } catch { /* não-JSON */ }

  // Salvar raw
  const fname = label.toLowerCase().replace(/[^a-z0-9]+/g, "_") + ".json";
  fs.writeFileSync(path.join(OUT, fname), body);
  console.log(`  Raw: ${path.join(OUT, fname)}`);

  if (Array.isArray(data)) {
    console.log(`  ► array com ${data.length} registros`);
    if (data.length > 0) {
      console.log(`  ► Primeiro registro — campos:`);
      const reg = data[0];
      for (const k of Object.keys(reg)) {
        const v = reg[k];
        const mostrar = v === null ? "null" : typeof v === "object" ? JSON.stringify(v).substring(0, 100) : String(v).substring(0, 100);
        console.log(`     ${k.padEnd(32)} : ${mostrar}`);
      }
      if (data.length > 1) {
        console.log(`  ► Preview de até 3 registros: ver JSON bruto`);
      }
    } else {
      console.log(`  ► VAZIO (nenhum registro)`);
    }
  } else if (data && typeof data === "object") {
    console.log(`  ► objeto único — campos:`);
    for (const k of Object.keys(data)) {
      const v = data[k];
      const mostrar = v === null ? "null" : typeof v === "object" ? JSON.stringify(v).substring(0, 100) : String(v).substring(0, 100);
      console.log(`     ${k.padEnd(32)} : ${mostrar}`);
    }
  } else {
    console.log(`  ► resposta não-JSON (primeiros 300 chars):`);
    console.log(`  ${body.substring(0, 300)}`);
  }

  return data;
}

(async () => {
  console.log(`\n╔══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║ CASO 1 · INCRA R$ ${(PRECATORIO.valor/1e6).toFixed(2)}M · Desapropriação · LOA 2026            ║`);
  console.log(`║ Precatório: ${PRECATORIO.loaNum}                                      ║`);
  console.log(`║ UO INCRA: ${PRECATORIO.uoDevedoraCodigo} · CNPJ: ${PRECATORIO.cnpjInstituicao}                      ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════════╝`);

  // 1) /despesas/por-orgao — empenhado/liquidado/pago no INCRA 2026
  await consultar(
    "1_despesas_por_orgao_INCRA_2026",
    `https://api.portaldatransparencia.gov.br/api-de-dados/despesas/por-orgao?ano=${PRECATORIO.ano}&orgao=${PRECATORIO.uoDevedoraCodigo}&pagina=1`,
  );

  // 2) /despesas/por-funcional-programatica — ação 218Y (precatórios federais)
  await consultar(
    "2_despesas_funcprog_acao218Y",
    `https://api.portaldatransparencia.gov.br/api-de-dados/despesas/por-funcional-programatica?ano=${PRECATORIO.ano}&funcao=28&subfuncao=846&programa=0901&acao=218Y&pagina=1`,
  );

  // 3) /despesas/por-funcional-programatica — ação 0022 (estatais) só pra comparar (teste de manhã retornou R$122M desta ação)
  await consultar(
    "3_despesas_funcprog_acao0022",
    `https://api.portaldatransparencia.gov.br/api-de-dados/despesas/por-funcional-programatica?ano=${PRECATORIO.ano}&acao=0022&pagina=1`,
  );

  // 4) /despesas/documentos — buscar documentos do INCRA em 2026 (descrição pode ter CNJ/credor)
  await consultar(
    "4_despesas_documentos_INCRA",
    `https://api.portaldatransparencia.gov.br/api-de-dados/despesas/documentos?ano=${PRECATORIO.ano}&codigoOrgao=${PRECATORIO.uoDevedoraCodigo}&fase=EMPENHO&pagina=1`,
  );

  console.log(`\n╔══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║ FIM — todos JSONs salvos em:                                         ║`);
  console.log(`║ ${OUT}`);
  console.log(`╚══════════════════════════════════════════════════════════════════════╝`);
})();
