/**
 * _caso_SUS_1653712.cjs
 * Precatório 1653712820254010000 · R$ 27,09M · 7 anos · EFU · Reajuste Tabela SUS
 * Ajuizamento: 19/02/2018 · Tipo de causa: Reajuste SUS
 *
 * Estratégia otimizada (baseada no caso A):
 *  T1: DataJud TRF1 — assunto "Reajuste" + ajuizamento 2017-2018 + filtro valor
 *  T2: DataJud TRF1 — assunto "SUS" + ajuizamento 2017-2018 → listar partes
 *  T3: PJe 1g Consulta Pública — pegar CNJs candidatos e consultar visualmente
 *  T4: Cruzar — processo cuja parte autora tem CNPJ de hospital/clínica + valor próximo
 */

const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");
const path = require("path");

const CASO = {
  loaNum: "1653712820254010000",
  valorLoa: 27_090_000,
  dataAjuizamento: "2018-02-19",
  tipo: "Reajuste da Tabela do SUS",
};

const OUT = path.resolve("Saida/caso_SUS_" + CASO.loaNum + "_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

function datajud(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: "api-publica.datajud.cnj.jus.br",
      path: "/api_publica_trf1/_search",
      method: "POST",
      headers: { "Authorization": "APIKey " + DATAJUD_KEY, "Content-Type": "application/json", "Content-Length": body.length },
    }, (res) => { let b = ""; res.on("data", c => b += c); res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); });
    req.on("error", reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.write(body); req.end();
  });
}

(async () => {
  console.log(`╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║ CASO SUS · ${CASO.loaNum}`);
  console.log(`║ R$ ${(CASO.valorLoa/1e6).toFixed(2)}M · ${CASO.tipo} · ajuizado ${CASO.dataAjuizamento}`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);

  // ── T1: DataJud — assunto "Reajuste" em 2017-2018, TRF1 ──────────
  console.log("\n[T1] DataJud TRF1 — assuntos.nome='Reajuste' + ajuizamento 2017-2018");
  try {
    const r = await datajud({
      query: {
        bool: {
          must: [
            { match: { "assuntos.nome": "Reajuste" } },
            { range: { dataAjuizamento: { gte: "2017-01-01", lte: "2018-12-31" } } },
          ],
        },
      },
      size: 30,
      _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "orgaoJulgador"],
    });
    const total = r.hits?.total?.value || 0;
    const hits = r.hits?.hits || [];
    console.log(`     total hits: ${total} · mostrando até 30`);
    hits.forEach((h, i) => {
      const s = h._source;
      const assuntos = (s.assuntos || []).map(a => a.nome).join(" | ").substring(0, 60);
      console.log(`     #${i+1} ${s.numeroProcesso} · ${s.classe?.nome} · aju=${(s.dataAjuizamento||'').slice(0,10)} · ${assuntos}`);
    });
    fs.writeFileSync(path.join(OUT, "t1_datajud_reajuste.json"), JSON.stringify(hits, null, 2));
  } catch (e) { console.log(`     erro: ${e.message}`); }

  // ── T2: DataJud — assunto contendo "SUS" + ajuizamento 2018 ──────
  console.log("\n[T2] DataJud TRF1 — assuntos contendo 'SUS' + ajuizamento 2018");
  try {
    const r = await datajud({
      query: {
        bool: {
          must: [
            { match: { "assuntos.nome": "SUS" } },
            { range: { dataAjuizamento: { gte: "2017-12-01", lte: "2018-04-30" } } },
          ],
        },
      },
      size: 50,
      _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "orgaoJulgador"],
    });
    const total = r.hits?.total?.value || 0;
    const hits = r.hits?.hits || [];
    console.log(`     total hits: ${total}`);
    hits.slice(0, 10).forEach((h, i) => {
      const s = h._source;
      const assuntos = (s.assuntos || []).map(a => a.nome).join(" | ").substring(0, 60);
      console.log(`     #${i+1} ${s.numeroProcesso} · ${s.classe?.nome} · aju=${(s.dataAjuizamento||'').slice(0,10)} · ${assuntos}`);
    });
    fs.writeFileSync(path.join(OUT, "t2_datajud_sus.json"), JSON.stringify(hits, null, 2));
  } catch (e) { console.log(`     erro: ${e.message}`); }

  // ── T3: DataJud — "Tabela" + "SUS" + 2018 (mais estrito) ─────────
  console.log("\n[T3] DataJud TRF1 — 'Tabela' + 'SUS' mais estrito, ajuizamento 2018");
  try {
    const r = await datajud({
      query: {
        bool: {
          must: [
            { match: { "assuntos.nome": "Tabela SUS" } },
          ],
        },
      },
      size: 50,
      _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "orgaoJulgador"],
    });
    const total = r.hits?.total?.value || 0;
    const hits = r.hits?.hits || [];
    console.log(`     total hits: ${total}`);
    hits.slice(0, 10).forEach((h, i) => {
      const s = h._source;
      const ajuiz = (s.dataAjuizamento||'').slice(0,10);
      // Só mostrar se for próximo de 2018
      if (!ajuiz.startsWith("2017") && !ajuiz.startsWith("2018")) return;
      const assuntos = (s.assuntos || []).map(a => a.nome).join(" | ").substring(0, 70);
      console.log(`     #${i+1} ${s.numeroProcesso} · ${s.classe?.nome} · aju=${ajuiz} · ${assuntos}`);
    });
    fs.writeFileSync(path.join(OUT, "t3_datajud_tabela_sus.json"), JSON.stringify(hits, null, 2));
  } catch (e) { console.log(`     erro: ${e.message}`); }

  // ── T4: consultar DataJud com partes incluso ─────────────────────
  console.log("\n[T4] Re-consultar T3 com partes incluso — pra identificar credor");
  try {
    const r = await datajud({
      query: {
        bool: {
          must: [
            { match: { "assuntos.nome": "Tabela SUS" } },
            { range: { dataAjuizamento: { gte: "2018-01-01", lte: "2018-04-30" } } },
          ],
        },
      },
      size: 30,
      _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "orgaoJulgador", "partes"],
    });
    const hits = r.hits?.hits || [];
    console.log(`     ${hits.length} processos Tabela SUS 2018`);
    hits.forEach((h, i) => {
      const s = h._source;
      const partes = (s.partes || []).map(p => ({
        nome: p.pessoa?.nome || "",
        docs: (p.pessoa?.documento || []).map(d => `${d.tipo || ""}:${d.numero || ""}`).join("/"),
      }));
      console.log(`     #${i+1} ${s.numeroProcesso} · ${s.classe?.nome}`);
      partes.slice(0, 4).forEach(p => console.log(`        parte: ${p.nome} ${p.docs ? "["+p.docs+"]" : ""}`));
    });
    fs.writeFileSync(path.join(OUT, "t4_partes_completas.json"), JSON.stringify(hits, null, 2));
  } catch (e) { console.log(`     erro: ${e.message}`); }

  console.log(`\n══ FIM ══ Saídas em ${OUT}`);
})();
