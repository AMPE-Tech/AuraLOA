/**
 * _match_4_casos.cjs — Descobre CNJ originário dos 4 precatórios candidatos
 * Método: DataJud TRF1 · busca por assunto + data ajuizamento (±60 dias)
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const CASOS = [
  { loa: "1653712820254010000", valor: 27_090_000, anos: 7,  ajuiz: "2018-02-19", assunto_termo: "Tabela SUS",             tipo: "Reajuste Tabela SUS" },
  { loa: "1672653920254010000", valor: 32_110_000, anos: 9,  ajuiz: "2016-02-16", assunto_termo: "Imunidade Tributária",   tipo: "Entidades sem Fins Lucrativos / Imunidade" },
  { loa: "3432298020244010000", valor: 20_420_000, anos: 11, ajuiz: "2012-07-17", assunto_termo: "Contribuições Previdenciárias", tipo: "Contribuições Previdenciárias" },
  { loa: "273212220254019000",  valor: 33_450_000, anos: 12, ajuiz: "2012-03-28", assunto_termo: "Contribuição INCRA",     tipo: "Contribuição INCRA" },
];

const OUT = path.resolve("Saida/match_4_casos_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
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

function ajuizNum(dataStr, deltaDias) {
  const d = new Date(dataStr);
  d.setDate(d.getDate() + deltaDias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return parseInt(`${y}${m}${dd}000000`);
}

function formataAjuiz(n) {
  const s = String(n||"");
  return s.length >= 8 ? s.slice(6,8) + "/" + s.slice(4,6) + "/" + s.slice(0,4) : "?";
}
function fmtCnj(raw) {
  if (!raw) return "";
  const s = String(raw).padStart(20, "0");
  return `${s.slice(0,7)}-${s.slice(7,9)}.${s.slice(9,13)}.${s.slice(13,14)}.${s.slice(14,16)}.${s.slice(16,20)}`;
}

(async () => {
  const resultados = [];
  for (const caso of CASOS) {
    console.log(`\n╔════ ${caso.loa} · R$ ${(caso.valor/1e6).toFixed(2)}M · ${caso.tipo} ════╗`);
    console.log(`Ajuizamento LOA: ${caso.ajuiz} · assunto: ${caso.assunto_termo}`);

    const gte = ajuizNum(caso.ajuiz, -60);
    const lte = ajuizNum(caso.ajuiz, 60);

    try {
      const r = await datajud({
        query: {
          bool: {
            must: [
              { match: { "assuntos.nome": caso.assunto_termo } },
              { range: { dataAjuizamento: { gte, lte } } },
            ],
          },
        },
        size: 20,
        _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "orgaoJulgador"],
      });
      const hits = r.hits?.hits || [];
      console.log(`  Hits total: ${r.hits?.total?.value} · mostrando ${hits.length}`);

      // Classe preferida: "Cumprimento de Sentença contra a Fazenda Pública" > "Procedimento Comum Cível" > outros
      const priorClasse = (c) => /Cumprimento de Sentença contra a Fazenda/i.test(c) ? 3
                              : /Procedimento Comum/i.test(c) ? 2
                              : /Cumprimento/i.test(c) ? 1 : 0;
      const ordenado = hits.sort((a, b) => {
        const pa = priorClasse(a._source.classe?.nome || "");
        const pb = priorClasse(b._source.classe?.nome || "");
        return pb - pa;
      });

      const top = ordenado.slice(0, 5);
      console.log(`\n  Top 5 candidatos (classe preferida primeiro):`);
      top.forEach((h, i) => {
        const s = h._source;
        console.log(`    #${i+1} ${fmtCnj(s.numeroProcesso)} · ${s.classe?.nome} · aju ${formataAjuiz(s.dataAjuizamento)} · órgão: ${s.orgaoJulgador?.nome}`);
      });

      resultados.push({
        caso,
        totalHits: r.hits?.total?.value,
        candidatos: top.map(h => ({
          cnj_raw: h._source.numeroProcesso,
          cnj_fmt: fmtCnj(h._source.numeroProcesso),
          classe: h._source.classe?.nome,
          assuntos: (h._source.assuntos || []).map(a => a.nome).join(" | "),
          ajuizamento: formataAjuiz(h._source.dataAjuizamento),
          orgao_julgador: h._source.orgaoJulgador?.nome,
        })),
      });
    } catch (e) {
      console.log(`  ERRO: ${e.message}`);
      resultados.push({ caso, erro: e.message });
    }
    await new Promise(r => setTimeout(r, 500));
  }

  fs.writeFileSync(path.join(OUT, "matches.json"), JSON.stringify(resultados, null, 2));
  console.log(`\n══ ${resultados.length} casos processados · resultados em ${OUT}/matches.json`);
})();
