/**
 * _run_dd_top10_20m.cjs — Lote DD 10 precatórios LOA 2026 (20-30M, sem SUFRAMA/DNIT/UFBA)
 * Gera CSV resumo com foco em: disponibilidade (pago/pendente) + contatos do credor.
 * Arquivo temporário — pode ser apagado depois da rodada.
 */

const fs = require("fs");
const path = require("path");

const CASOS = [
  { num: "1661378120254010000", uo: "EFU",   valor: 29_770_000, tipo: "FUNDEF" },
  { num: "6125805920244010000", uo: "EFU",   valor: 29_060_000, tipo: "Contribuições Previdenciárias" },
  { num: "1228341720254010000", uo: "EFU",   valor: 27_920_000, tipo: "Reajuste SUS" },
  { num: "1463558820254010000", uo: "EFU",   valor: 27_830_000, tipo: "FUNDEF" },
  { num: "569062220254019000",  uo: "INCRA", valor: 27_210_000, tipo: "Reintegração de Posse" },
  { num: "1653712820254010000", uo: "EFU",   valor: 27_090_000, tipo: "Reajuste SUS" },
  { num: "938598220254019000",  uo: "EFU",   valor: 26_810_000, tipo: "Entidades sem Fins Lucrativos" },
  { num: "1602338020254010000", uo: "EFU",   valor: 26_600_000, tipo: "FUNDEF" },
  { num: "1666808420254010000", uo: "INCRA", valor: 26_400_000, tipo: "Desapropriação" },
  { num: "1683168520254010000", uo: "EFU",   valor: 25_680_000, tipo: "FUNDEF" },
];

const BASE = "http://127.0.0.1:5000";
const OUT_DIR = path.resolve("Saida/dd_batch_20M_30M_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function formatNum(n) { return (Number(n) || 0).toLocaleString("pt-BR"); }
function csvField(s) { if (s == null) return ""; const str = String(s).replace(/"/g, '""'); return /[,;"\n]/.test(str) ? `"${str}"` : str; }

async function rodarCaso(caso, idx) {
  const inicio = Date.now();
  console.log(`\n[${idx+1}/${CASOS.length}] ▶ ${caso.num} · ${caso.uo} · R$ ${formatNum(caso.valor)} · ${caso.tipo}`);

  const resp = await fetch(`${BASE}/api/duediligence/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numero_precatorio: caso.num, tribunal: "TRF1", valor: 0, ano: 2026 }),
  });
  const r = await resp.json();
  const dur = Math.round((Date.now() - inicio) / 1000);

  // Extração dos campos que importam pro Marcos
  const statusPgto = r.status_pagamento || "DESCONHECIDO";
  const cnjOrig = r.cnj_originario || "";
  const cnjExec = r.cnj_execucao || "";
  const score = r.score_final || 0;
  const statusFinal = r.status_final || "";

  // Disponibilidade no portal
  const portal = r.fase5c_portal?.dados || {};
  const portalAcao = portal.acao || "—";
  const portalPago = portal.pago ?? null;
  const portalEmp  = portal.empenhado ?? null;

  // Robô PJe — confirmou processo?
  const pje = r.fase4b_robo_pje?.dados || {};
  const pjeEncontrado = pje.encontrado ?? false;
  const pjeMovs = pje.movimentacoes ?? 0;
  const pjeStatusPgto = pje.status_pagamento || "";

  // Credor
  const credor = r.credor_verificado || {};
  const credorNome = credor.razao_social || "";
  const credorCnpj = credor.cnpj || "";
  const credorSituacao = credor.situacao || "";
  const credorMunicipio = credor.municipio || "";
  const credorUf = credor.uf || "";

  // Contatos (fase 6B)
  const contatos = r.fase6b_contatos?.dados || {};
  const totalPessoas = contatos.total_pessoas || 0;
  const comContato = contatos.pessoas_com_contato || 0;

  // Relatório HTML
  const relUrl = r.relatorio_url || "";

  const resumo = {
    num: caso.num, uo: caso.uo, valor: caso.valor, tipo: caso.tipo,
    score, statusFinal, statusPgto,
    cnjOrig, cnjExec,
    portalAcao, portalEmp, portalPago,
    pjeEncontrado, pjeMovs, pjeStatusPgto,
    credorNome, credorCnpj, credorSituacao, credorMunicipio, credorUf,
    totalPessoas, comContato,
    relUrl,
    durSeg: dur,
  };

  console.log(`   ✓ ${dur}s · score=${score}(${statusFinal}) · PJe=${pjeEncontrado?"✓":"✗"}(${pjeMovs}movs) · Portal=${portalPago??"—"} · credor=${credorNome||"N/A"}`);

  return resumo;
}

(async () => {
  const resultados = [];
  const t0 = Date.now();
  for (let i = 0; i < CASOS.length; i++) {
    try {
      const r = await rodarCaso(CASOS[i], i);
      resultados.push(r);
    } catch (e) {
      console.error(`   ✗ ERRO: ${e.message}`);
      resultados.push({ num: CASOS[i].num, uo: CASOS[i].uo, valor: CASOS[i].valor, erro: e.message });
    }
  }
  const durTotal = Math.round((Date.now() - t0) / 1000);

  // CSV
  const header = ["num","uo","valor","tipo","score","statusFinal","statusPgto","cnjOrig","cnjExec","portalAcao","portalEmp","portalPago","pjeEncontrado","pjeMovs","pjeStatusPgto","credorNome","credorCnpj","credorSituacao","credorMunicipio","credorUf","totalPessoas","comContato","relUrl","durSeg","erro"];
  const linhas = [header.join(",")];
  for (const r of resultados) {
    linhas.push(header.map(h => csvField(r[h])).join(","));
  }
  const csvPath = path.join(OUT_DIR, "resumo_top10.csv");
  fs.writeFileSync(csvPath, linhas.join("\n"), "utf-8");

  // JSON bruto (pra auditoria)
  fs.writeFileSync(path.join(OUT_DIR, "resumo_top10.json"), JSON.stringify(resultados, null, 2), "utf-8");

  console.log(`\n══ FIM ══ ${durTotal}s total`);
  console.log(`CSV:  ${csvPath}`);
  console.log(`JSON: ${path.join(OUT_DIR, "resumo_top10.json")}`);

  // Resumo final
  console.log(`\n── STATUS POR CASO ──`);
  for (const r of resultados) {
    if (r.erro) { console.log(`❌ ${r.num} · ${r.uo} · ERRO: ${r.erro}`); continue; }
    const disp = r.pjeEncontrado && r.pjeStatusPgto === "PENDENTE" ? "🟢 disponível" : r.pjeStatusPgto === "PAGO" ? "🔴 já pago" : "⚠️  verificar";
    console.log(`${disp.padEnd(18)} ${r.num} · ${r.uo.padEnd(8)} · R$ ${formatNum(r.valor).padStart(12)} · score ${String(r.score).padStart(3)}/${r.statusFinal.padEnd(9)} · credor: ${r.credorNome || "N/A"}`);
  }
})();
