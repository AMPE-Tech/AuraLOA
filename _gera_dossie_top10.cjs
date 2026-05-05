/**
 * _gera_dossie_top10.cjs — Gera dossiê HTML dos 10 precatórios ≥ R$ 20M
 * Dados vindos do arquivo conciliado LOA+SIOP.
 * Saída pronta pro sócio ligar hoje: dados + links de consulta.
 */

const fs = require("fs");
const path = require("path");

const FILE = path.resolve("data/conciliado_loa_siop/LOA_SIOP_2026_conciliado_20260422.csv");
const OUT_DIR = path.resolve("Saida/dossie_top10_20M_" + new Date().toISOString().slice(0,10).replace(/-/g,""));
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Parser
function parseCsvLine(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { q = !q; continue; }
    if (c === ";" && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map(v => v.trim());
}
function num(s) { if (!s) return 0; return parseFloat(String(s).replace(/\./g,"").replace(",",".")) || 0; }
function brl(n) { return "R$ " + (n||0).toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
function escapeHtml(s) { return String(s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]); }
function fmtData(s) {
  if (!s) return "—";
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

// Ler + filtrar
const linhas = fs.readFileSync(FILE, "utf-8").split(/\r?\n/).filter(l => l.trim());
const header = parseCsvLine(linhas[0]);
const recs = linhas.slice(1).map(parseCsvLine).map(cols => {
  const obj = {};
  header.forEach((h, i) => obj[h.replace(/^﻿/, "")] = cols[i] || "");
  return obj;
});

const top10 = recs
  .filter(r => r.Ano === "2026"
    && r.status_conciliacao === "CONCILIADO"
    && num(r.Valor_RS) >= 20_000_000
    && !/SUFRAMA|DNIT|UFBA/.test(r.UO_Devedora_Nome || ""))
  .sort((a, b) => num(b.Valor_RS) - num(a.Valor_RS))
  .slice(0, 10);

console.log(`Top 10 selecionados: ${top10.length}`);

// ── CSV resumido ──────────────────────────────────────────────────
const headerCsv = [
  "ordem","numero_precatorio","uo_devedora","valor_rs","valor_atualizado_ipca",
  "tipo_causa","data_ajuizamento","anos_decorridos","class_tempo","faixa_valor",
  "chave_siop","fundef","natureza_despesa","orgao_cadastrador",
  "url_portal_precatorios_trf1","url_datajud_consulta","url_consulta_processual_trf1"
];
const csvLines = [headerCsv.join(";")];
top10.forEach((r, i) => {
  const row = {
    ordem: i + 1,
    numero_precatorio: r.Precatorio,
    uo_devedora: `${r.UO_Devedora_Codigo} — ${r.UO_Devedora_Nome}`,
    valor_rs: brl(num(r.Valor_RS)),
    valor_atualizado_ipca: brl(num(r["Valor Atualizado"])),
    tipo_causa: r.Tipo_Causa,
    data_ajuizamento: fmtData(r["Data de Ajuizamento da Ação Originária"]),
    anos_decorridos: r.Anos_Decorridos,
    class_tempo: r.Class_Tempo,
    faixa_valor: r.FaixaValor,
    chave_siop: r.Chave,
    fundef: r.Fundef,
    natureza_despesa: r["Natureza de Despesa"],
    orgao_cadastrador: r.UO_Cadastradora_Nome,
    url_portal_precatorios_trf1: `https://precatorios.trf1.jus.br/Publico/ConsultaPrecatorio.aspx?numeroPrecatorio=${r.Precatorio}`,
    url_datajud_consulta: `https://www.cnj.jus.br/consultas-processuais-publicas-datajud/`,
    url_consulta_processual_trf1: `https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1`,
  };
  csvLines.push(headerCsv.map(k => {
    const v = row[k] == null ? "" : String(row[k]).replace(/"/g, '""');
    return /[,;"\n]/.test(v) ? `"${v}"` : v;
  }).join(";"));
});
fs.writeFileSync(path.join(OUT_DIR, "top10_dossie.csv"), csvLines.join("\n"), "utf-8");

// ── HTML bonito ───────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Top 10 Precatórios ≥ R$ 20M · LOA 2026 · Dossiê AuraLOA</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Inter,Segoe UI,sans-serif;background:#0a0e17;color:#e2e8f0;padding:2rem;line-height:1.6}
  h1{background:linear-gradient(135deg,#22d3ee,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2rem;margin-bottom:.5rem}
  .sub{color:#64748b;margin-bottom:2rem;font-size:13px}
  .case{background:#111827;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;page-break-inside:avoid}
  .case h2{font-size:18px;color:#22d3ee;margin-bottom:12px;display:flex;align-items:center;gap:12px}
  .case h2 .badge{background:rgba(167,139,250,.15);color:#a78bfa;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:.05em}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
  .kv{background:rgba(15,22,35,.8);border:1px solid rgba(255,255,255,.05);border-radius:8px;padding:10px 12px}
  .kv .k{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px}
  .kv .v{font-size:13px;color:#e2e8f0;font-weight:600}
  .kv .v.big{color:#22d3ee;font-size:16px}
  .kv .v.alert{color:#f87171}
  .kv .v.gold{color:#fbbf24}
  .kv .v.green{color:#34d399}
  .links{margin-top:14px;display:flex;flex-wrap:wrap;gap:8px}
  .links a{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:6px;background:rgba(34,211,238,.1);color:#22d3ee;text-decoration:none;font-size:11px;font-weight:600;border:1px solid rgba(34,211,238,.2)}
  .links a:hover{background:rgba(34,211,238,.2)}
  .pending{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);color:#f87171;padding:8px 14px;border-radius:6px;font-size:12px;margin-top:10px}
  .tip{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);color:#fbbf24;padding:10px 14px;border-radius:6px;font-size:12px;margin-top:10px;font-weight:500}
  .footer{margin-top:2rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,.05);font-size:11px;color:#64748b;text-align:center}
  @media print {
    body{background:white;color:#111;padding:1rem}
    .case{background:white;border:1px solid #ddd;page-break-inside:avoid}
    .case h2{color:#111}
    .kv{background:#f5f5f5}
    .kv .v{color:#111}
  }
</style></head><body>
<h1>Top 10 Precatórios ≥ R$ 20M · LOA 2026</h1>
<div class="sub">
  Gerado em ${new Date().toLocaleString("pt-BR")} · Fonte: LOA + SIOP conciliados (98% match) · Exclui SUFRAMA, DNIT, UFBA (já em reunião)<br>
  <strong>Uso:</strong> prospecção de compra de direito creditório. Precatórios NÃO PAGOS, aguardando fila 2026.
</div>

${top10.map((r, i) => {
  const valorRs = num(r.Valor_RS);
  const valorAtu = num(r["Valor Atualizado"]);
  const anos = parseInt(r.Anos_Decorridos) || 0;
  const anosCor = anos >= 20 ? "alert" : anos >= 10 ? "gold" : "green";
  const indice = parseFloat((r.IndiceAtualizacao || "1").replace(",", ".")) || 1;
  const correcaoPct = ((indice - 1) * 100).toFixed(2);
  return `
<div class="case">
  <h2>#${i+1} · ${escapeHtml(r.Precatorio)} <span class="badge">${escapeHtml(r.UO_Devedora_Nome)}</span></h2>
  <div class="grid">
    <div class="kv"><div class="k">Valor LOA 2026</div><div class="v big">${brl(valorRs)}</div></div>
    <div class="kv"><div class="k">Valor Atualizado (IPCA)</div><div class="v big">${brl(valorAtu)}</div></div>
    <div class="kv"><div class="k">Correção IPCA</div><div class="v">+${correcaoPct}%</div></div>
    <div class="kv"><div class="k">Anos Decorridos ⏳</div><div class="v ${anosCor}">${anos} anos</div></div>
    <div class="kv"><div class="k">Data Ajuizamento Original</div><div class="v">${escapeHtml(fmtData(r["Data de Ajuizamento da Ação Originária"]))}</div></div>
    <div class="kv"><div class="k">Class. Tempo (SIOP)</div><div class="v ${anosCor}">${escapeHtml(r.Class_Tempo)}</div></div>
    <div class="kv" style="grid-column:span 3"><div class="k">Tipo de Causa</div><div class="v">${escapeHtml(r["Tipo de Causa"] || r.Tipo_Causa)}</div></div>
    <div class="kv"><div class="k">UO Devedora (SIAFI)</div><div class="v">${escapeHtml(r.UO_Devedora_Codigo)} · ${escapeHtml(r.UO_Devedora_Nome)}</div></div>
    <div class="kv"><div class="k">Órgão Cadastrador</div><div class="v">${escapeHtml(r.UO_Cadastradora_Nome)}</div></div>
    <div class="kv"><div class="k">Chave SIOP</div><div class="v">${escapeHtml(r.Chave)}</div></div>
    <div class="kv"><div class="k">Data Autuação (ofício)</div><div class="v">${escapeHtml(fmtData(r["Data da Autuação"]))}</div></div>
    <div class="kv"><div class="k">FaixaValor SIOP</div><div class="v">${escapeHtml(r.FaixaValor)}</div></div>
    <div class="kv"><div class="k">Fundef</div><div class="v">${escapeHtml(r.Fundef)}</div></div>
  </div>
  <div class="tip">💡 Alvo: credor com ${anos} anos de espera${anos >= 20 ? " — provavelmente idoso ou herdeiros, alta urgência de liquidez" : anos >= 10 ? " — credor cansado da fila, deságio negociável" : ""}.</div>
  <div class="pending">⚠️ <strong>Pendente:</strong> Nº CNJ originário, nome do credor, advogado e contato. Portal TRF1 está bloqueado por Cloudflare nas consultas automatizadas. <strong>Caminho manual pro sócio:</strong></div>
  <div class="links">
    <a href="${r.url_portal_precatorios_trf1 || `https://precatorios.trf1.jus.br/Publico/ConsultaPrecatorio.aspx?numeroPrecatorio=${r.Precatorio}`}" target="_blank">🏛 Portal Precatórios TRF1 (informe Nº ${r.Precatorio})</a>
    <a href="https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1" target="_blank">🔍 TRF1 Consulta por CPF/CNPJ</a>
    <a href="https://www.cnj.jus.br/consultas-processuais-publicas-datajud/" target="_blank">📡 DataJud CNJ</a>
  </div>
</div>
`;
}).join("")}

<div class="footer">AuraLOA · Dossiê gerado a partir de LOA 2026 (Ministério do Planejamento, 42.174 precatórios) + SIOP 2026 (164.012 registros) conciliados em 22/04/2026 · 98% de match por UO+valor+tipo</div>
</body></html>`;

fs.writeFileSync(path.join(OUT_DIR, "top10_dossie.html"), html, "utf-8");

// ── Markdown legível ───────────────────────────────────────────────
const md = [`# Top 10 Precatórios ≥ R$ 20M · LOA 2026`, `Gerado em ${new Date().toLocaleString("pt-BR")}`, ""];
top10.forEach((r, i) => {
  const anos = parseInt(r.Anos_Decorridos) || 0;
  md.push(`## #${i+1} · ${r.Precatorio} · ${r.UO_Devedora_Nome}`);
  md.push(``);
  md.push(`| Campo | Valor |`);
  md.push(`|-------|-------|`);
  md.push(`| Valor LOA 2026 | **${brl(num(r.Valor_RS))}** |`);
  md.push(`| Valor Atualizado IPCA | **${brl(num(r["Valor Atualizado"]))}** |`);
  md.push(`| Anos Decorridos | **${anos} anos** |`);
  md.push(`| Data Ajuizamento | ${fmtData(r["Data de Ajuizamento da Ação Originária"])} |`);
  md.push(`| Tipo de Causa | ${r["Tipo de Causa"] || r.Tipo_Causa} |`);
  md.push(`| UO Devedora | ${r.UO_Devedora_Codigo} · ${r.UO_Devedora_Nome} |`);
  md.push(`| Chave SIOP | ${r.Chave} |`);
  md.push(`| Class. Tempo | ${r.Class_Tempo} |`);
  md.push(``);
  md.push(`**Consulta manual (pra achar credor/advogado):**`);
  md.push(`- [Portal Precatórios TRF1](https://precatorios.trf1.jus.br/Publico/ConsultaPrecatorio.aspx?numeroPrecatorio=${r.Precatorio}) (informe o número ${r.Precatorio})`);
  md.push(`- [TRF1 Consulta por CPF/CNPJ](https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1)`);
  md.push(``);
});
fs.writeFileSync(path.join(OUT_DIR, "top10_dossie.md"), md.join("\n"));

console.log(`\n✓ Arquivos gerados em: ${OUT_DIR}`);
console.log(`  - top10_dossie.html  (abrir no browser, imprimir)`);
console.log(`  - top10_dossie.csv   (editável, pra equipe preencher CNJ/credor/contato)`);
console.log(`  - top10_dossie.md    (legível, compartilhar por texto)`);
