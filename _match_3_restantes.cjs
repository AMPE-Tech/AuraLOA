/**
 * _match_3_restantes.cjs — Descobrir CNJ dos 3 casos restantes (Imunidade/Previd/INCRA)
 * Usa DataJud TRF1 com range de data numérico correto.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const CASOS = [
  { loa: "1672653920254010000", valor: 32_110_000, ajuiz: "2016-02-16", termos: ["Imunidade Tributária", "Imunidade", "Entidades sem Fins Lucrativos"] },
  { loa: "3432298020244010000", valor: 20_420_000, ajuiz: "2012-07-17", termos: ["Contribuições Previdenciárias", "Contribuição Previdenciária", "Previdenciárias"] },
  { loa: "273212220254019000",  valor: 33_450_000, ajuiz: "2012-03-28", termos: ["Contribuição INCRA", "INCRA"] },
];

const OUT = path.resolve("Saida/match_3_restantes_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

function datajud(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: "api-publica.datajud.cnj.jus.br",
      path: "/api_publica_trf1/_search",
      method: "POST",
      headers: { "Authorization": "APIKey " + KEY, "Content-Type": "application/json", "Content-Length": body.length },
    }, (res) => { let b = ""; res.on("data", c => b += c); res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); });
    req.on("error", reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.write(body); req.end();
  });
}

function ajuizRange(dataStr, deltaDias) {
  const d = new Date(dataStr);
  const dMin = new Date(d); dMin.setDate(d.getDate() - deltaDias);
  const dMax = new Date(d); dMax.setDate(d.getDate() + deltaDias);
  const fmt = (dt) => `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,"0")}${String(dt.getDate()).padStart(2,"0")}000000`;
  return { gte: parseInt(fmt(dMin)), lte: parseInt(fmt(dMax)) };
}
function fmtCnj(raw) { const s = String(raw||"").padStart(20,"0"); return `${s.slice(0,7)}-${s.slice(7,9)}.${s.slice(9,13)}.${s.slice(13,14)}.${s.slice(14,16)}.${s.slice(16,20)}`; }
function fmtData(n) { const s = String(n||""); return s.length>=8 ? `${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}` : "?"; }

(async () => {
  const resultados = [];
  for (const caso of CASOS) {
    console.log(`\n╔════ ${caso.loa} · R$ ${(caso.valor/1e6).toFixed(2)}M · ajuiz ${caso.ajuiz} ════╗`);
    const { gte, lte } = ajuizRange(caso.ajuiz, 90); // janela ampla ±90 dias

    let melhor = null;
    for (const termo of caso.termos) {
      console.log(`\n  Termo: "${termo}"`);
      try {
        const r = await datajud({
          query: {
            bool: {
              must: [
                { match: { "assuntos.nome": termo } },
                { range: { dataAjuizamento: { gte, lte } } },
              ],
            },
          },
          size: 30,
          _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "orgaoJulgador"],
        });
        const hits = r.hits?.hits || [];
        console.log(`    total: ${r.hits?.total?.value} · mostrando top 5`);

        // priorizar "Cumprimento de Sentença contra a Fazenda Pública"
        const prior = (c) => /Cumprimento de Sentença contra a Fazenda/i.test(c) ? 3
                          : /Procedimento Comum/i.test(c) ? 2
                          : 1;
        const ord = hits.sort((a, b) => prior(b._source.classe?.nome||"") - prior(a._source.classe?.nome||""));
        ord.slice(0, 5).forEach((h, i) => {
          const s = h._source;
          const dataAj = fmtData(s.dataAjuizamento);
          console.log(`    #${i+1} ${fmtCnj(s.numeroProcesso)} · ${s.classe?.nome} · aju ${dataAj} · ${s.orgaoJulgador?.nome}`);
        });

        if (hits.length > 0 && !melhor) {
          melhor = { termo, hits: ord.slice(0, 5).map(h => ({
            cnj_raw: h._source.numeroProcesso,
            cnj_fmt: fmtCnj(h._source.numeroProcesso),
            classe: h._source.classe?.nome,
            assuntos: (h._source.assuntos||[]).map(a => a.nome).join(" | "),
            ajuiz: fmtData(h._source.dataAjuizamento),
            orgao: h._source.orgaoJulgador?.nome,
          })) };
        }
        await new Promise(r => setTimeout(r, 400));
      } catch (e) { console.log(`    erro: ${e.message}`); }
    }
    resultados.push({ caso, melhor });
  }

  fs.writeFileSync(path.join(OUT, "matches_3.json"), JSON.stringify(resultados, null, 2));
  console.log(`\n══ FIM · ${OUT}/matches_3.json`);
})();
