import { query } from "../server/db";
import * as fs from "fs";
import * as path from "path";

const rowsAll = await query<any>(
  `SELECT a.*, ld.lote_id
   FROM v2_analises a
   LEFT JOIN v2_lote_docs ld ON ld.analise_id = a.id
   WHERE a.file_original_name ILIKE '%Agrovale%'
   ORDER BY a.extracted_at DESC NULLS LAST, a.created_at DESC`
);

if (!rowsAll.length) {
  console.error("Nenhuma análise Agrovale encontrada");
  process.exit(1);
}

// Filtrar versões incompletas: precisa ter pelo menos CNJ + número de ofício
const rows = rowsAll.filter(r => r.numero_cnj && r.numero_oficio);
const skipped = rowsAll.length - rows.length;

console.log(`▶ ${rowsAll.length} análises encontradas · ${rows.length} completas · ${skipped} ocultadas (sem CNJ/ofício)`);

const fmtBR = (n: number | string | null | undefined) => {
  if (n == null) return "—";
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(v)) return String(n);
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtDate = (s: string | Date | null | undefined) => {
  if (!s) return "—";
  const dt = s instanceof Date ? s : new Date(s);
  if (isNaN(dt.getTime())) return String(s);
  return dt.toLocaleDateString("pt-BR");
};
const fmtDateTime = (s: string | Date | null | undefined) => {
  if (!s) return "—";
  const dt = s instanceof Date ? s : new Date(s);
  if (isNaN(dt.getTime())) return String(s);
  return dt.toLocaleString("pt-BR");
};
const esc = (s: any) => String(s ?? "").replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!));

function gerarHtml(d: any, idx: number, total: number): { html: string; flags: string[] } {
  const arr = (f: string) => Array.isArray(d[f]) ? d[f] : [];
  const obj = (f: string) => d[f] || {};

  const meta = obj("metadados_requisicao");
  const benef = arr("beneficiarios_detalhados");
  const advs = arr("advogados");
  const classifs = arr("classificacao_credito");
  const docs = arr("documentos_identificados");
  const procs = arr("processos_identificados");
  const observ = arr("observacoes_gerais");

  const flags: string[] = [];
  const valorReq = parseFloat(meta.valor_total_requisitado || d.valor_rs || "0");
  if (valorReq > 800_000_000) flags.push(`Valor requisitado R$ ${fmtBR(valorReq)} parece inflado (memória do projeto cita R$ ~671M reais). Revisar somatório dos ofícios.`);
  const cnpjsBenef = benef.map((b: any) => b.cnpj).filter(Boolean);
  const dups = cnpjsBenef.filter((c: string, i: number) => cnpjsBenef.indexOf(c) !== i);
  if (dups.length) flags.push(`Beneficiários com CNPJ duplicado: ${[...new Set(dups)].join(", ")}. Possível duplicação na extração (FIDC GJ 4870 aparece como cessionário e principal).`);
  const totalNull = benef.filter((b: any) => b.total == null).length;
  if (totalNull > 0) flags.push(`${totalNull} beneficiário(s) com campo total=null.`);

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Due Diligence — Agrovale v${idx} · TRF1 · AuraLOA</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0d1117;--surface:#162032;--surface2:#1c2a3f;--border:#1e3a5f;--cyan:#22d3ee;--violet:#a78bfa;--green:#34d399;--amber:#fbbf24;--red:#f87171;--text:#e2e8f0;--text2:#94a3b8;--text3:#64748b}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
.banner{background:linear-gradient(90deg,#7c3aed 0%,#22d3ee 50%,#7c3aed 100%);background-size:200% 100%;animation:shimmer 4s ease infinite;text-align:center;padding:6px 0;font-size:10px;font-weight:700;letter-spacing:3px;color:#fff;text-transform:uppercase}
@keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.version-bar{background:var(--surface2);border-bottom:1px solid var(--border);padding:10px 40px;font-size:12px;color:var(--text2);text-align:center}
.version-bar strong{color:var(--cyan)}
.version-bar a{color:var(--violet);margin:0 8px}
.container{max-width:1200px;margin:0 auto;padding:32px 40px 80px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid var(--border)}
.logo{font-size:22px;font-weight:800;background:linear-gradient(135deg,var(--cyan),var(--violet));-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.5px}
.meta{font-size:12px;color:var(--text3);text-align:right}
h1{font-size:28px;font-weight:800;margin-bottom:8px;color:#fff;line-height:1.2}
.subtitle{color:var(--text2);font-size:14px;margin-bottom:24px}
.flags{background:rgba(248,113,113,.08);border-left:3px solid var(--red);padding:14px 18px;border-radius:6px;margin-bottom:24px}
.flags-title{font-weight:700;color:var(--red);font-size:12px;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px}
.flags ul{list-style:none;padding:0}
.flags li{font-size:13px;color:#fca5a5;padding:4px 0}
.flags li::before{content:"⚠ ";margin-right:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:32px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px}
.card-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);margin-bottom:8px}
.card-value{font-size:16px;font-weight:600;color:#fff}
.card-value.big{font-size:22px;background:linear-gradient(135deg,var(--cyan),var(--violet));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.section{margin-bottom:32px}
.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--cyan);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.section-title::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--cyan)}
table{width:100%;border-collapse:collapse;background:var(--surface);border-radius:10px;overflow:hidden;font-size:13px}
th{text-align:left;padding:12px 16px;background:var(--surface2);color:var(--text3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid var(--border)}
td{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.02)}
.tag{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.tag-principal{background:rgba(34,211,238,.12);color:var(--cyan);border:1px solid rgba(34,211,238,.3)}
.tag-cessionario{background:rgba(167,139,250,.12);color:var(--violet);border:1px solid rgba(167,139,250,.3)}
.tag-fidc{background:rgba(251,191,36,.12);color:var(--amber);border:1px solid rgba(251,191,36,.3)}
.list-item{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 18px;margin-bottom:8px}
.list-item-title{font-weight:600;color:#fff;margin-bottom:4px}
.list-item-meta{font-size:12px;color:var(--text3)}
a{color:var(--cyan);text-decoration:none}
a:hover{text-decoration:underline}
.numeric{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.muted{color:var(--text3);font-style:italic}
.footer{margin-top:48px;padding-top:24px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);text-align:center}
</style></head><body>
<div class="banner">CONFIDENCIAL · Due Diligence · AuraLOA</div>
<div class="version-bar">
  Versão <strong>${idx}</strong> de <strong>${total}</strong> · Extraído em <strong>${fmtDateTime(d.extracted_at)}</strong> ·
  <a href="agrovale_INDICE.html">📋 Voltar ao índice de versões</a>
</div>
<div class="container">
  <div class="header">
    <div>
      <div class="logo">AuraLOA</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">Plataforma de Due Diligence de Precatórios</div>
    </div>
    <div class="meta">
      Gerado em ${new Date().toLocaleString("pt-BR")}<br>
      validation_id: <code style="color:var(--cyan)">${esc(d.validation_id)}</code><br>
      lote_id: <code style="color:var(--violet)">${esc(d.lote_id || "—")}</code>
    </div>
  </div>

  <h1>${esc(d.credor_nome || "Agrovale")}</h1>
  <div class="subtitle">${esc(d.tipo)} · ${esc(d.tribunal)} · ${esc(d.orgao_julgador || "")}</div>

  ${flags.length ? `<div class="flags">
    <div class="flags-title">Pontos de Revisão Detectados Automaticamente</div>
    <ul>${flags.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
  </div>` : ""}

  <div class="grid">
    <div class="card"><div class="card-label">CNJ Originário</div><div class="card-value">${esc(d.numero_cnj || "—")}</div></div>
    <div class="card"><div class="card-label">Nº Ofício</div><div class="card-value">${esc(d.numero_oficio || "—")}</div></div>
    <div class="card"><div class="card-label">Valor Requisitado</div><div class="card-value big">R$ ${fmtBR(meta.valor_total_requisitado || d.valor_rs)}</div></div>
    <div class="card"><div class="card-label">Trânsito em Julgado</div><div class="card-value">${fmtDate(d.data_transito)}</div></div>
    <div class="card"><div class="card-label">Devedor</div><div class="card-value">${esc(d.devedor || "—")}</div></div>
    <div class="card"><div class="card-label">Status Processual</div><div class="card-value">${esc(d.status_processual || "—")}</div></div>
    <div class="card"><div class="card-label">Credor / CNPJ</div><div class="card-value" style="font-size:13px">${esc(d.credor_cpf_cnpj || "—")}</div></div>
    <div class="card"><div class="card-label">Espécie</div><div class="card-value">${esc(meta.especie || "—")}</div></div>
  </div>

  <div class="section">
    <div class="section-title">Composição Financeira</div>
    <div class="grid">
      <div class="card"><div class="card-label">Valor Principal</div><div class="card-value">R$ ${fmtBR(meta.valor_total_principal)}</div></div>
      <div class="card"><div class="card-label">Juros</div><div class="card-value">R$ ${fmtBR(meta.valor_total_juros)}</div></div>
      <div class="card"><div class="card-label">% Juros Mora</div><div class="card-value">${esc(meta.percentual_juros_mora || "—")}</div></div>
      <div class="card"><div class="card-label">Beneficiários / Cessionários</div><div class="card-value">${esc(meta.quantidade_beneficiarios || "—")} / ${esc(meta.quantidade_cessionarios || "—")}</div></div>
    </div>
  </div>

  ${benef.length ? `<div class="section">
    <div class="section-title">Beneficiários e Cessionários (${benef.length})</div>
    <table>
      <thead><tr><th>#</th><th>Nome</th><th>Tipo</th><th>CNPJ</th><th class="numeric">Principal (R$)</th><th class="numeric">Juros (R$)</th><th class="numeric">Total (R$)</th></tr></thead>
      <tbody>
      ${benef.map((b: any, i: number) => {
        const isFidc = /FIDC|FUNDO DE INVESTIMENTO/i.test(b.nome || "");
        const tipoCls = b.principal === true || b.tipo === "principal" ? "tag-principal" : (isFidc ? "tag-fidc" : "tag-cessionario");
        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${esc(b.nome)}</strong></td>
          <td><span class="tag ${tipoCls}">${esc(b.tipo || (b.principal ? "principal" : "cessionário"))}</span></td>
          <td style="font-size:12px;color:var(--text2)">${esc(b.cnpj || "—")}</td>
          <td class="numeric">${b.principal_valor != null ? fmtBR(b.principal_valor) : (typeof b.principal === "number" ? fmtBR(b.principal) : "—")}</td>
          <td class="numeric">${fmtBR(b.juros_selic ?? b.juros)}</td>
          <td class="numeric">${b.total != null ? fmtBR(b.total) : '<span class="muted">null</span>'}</td>
        </tr>`;
      }).join("")}
      </tbody>
    </table>
  </div>` : ""}

  ${classifs.length ? `<div class="section">
    <div class="section-title">Classificação do Crédito (${classifs.length})</div>
    ${classifs.map((c: any) => `<div class="list-item">
      <div class="list-item-title">Ofício ${esc(c.oficio)} — ${esc(c.natureza_credito)}</div>
      <div class="list-item-meta">${esc(c.natureza_obrigacao_codigo || "")} · ${esc(c.natureza_obrigacao_descricao || "")}</div>
    </div>`).join("")}
  </div>` : ""}

  ${advs.length ? `<div class="section">
    <div class="section-title">Advogados (${advs.length})</div>
    ${advs.map((a: any) => `<div class="list-item">
      <div class="list-item-title">${esc(a.nome)}</div>
      <div class="list-item-meta">OAB/${esc(a.oab_seccional)} ${esc(a.oab_numero)} · CPF ${esc(a.cpf || "—")}</div>
    </div>`).join("")}
  </div>` : ""}

  ${procs.length ? `<div class="section">
    <div class="section-title">Processos Identificados (${procs.length})</div>
    ${procs.map((p: any) => `<div class="list-item">
      <div class="list-item-title">${esc(p.numero_cnj || p.numero || "—")}</div>
      <div class="list-item-meta">${esc(p.tribunal || "")} · ${esc(p.orgao_julgador || "")}</div>
    </div>`).join("")}
  </div>` : ""}

  ${docs.length ? `<div class="section">
    <div class="section-title">Documentos Identificados (${docs.length})</div>
    ${docs.map((doc: any) => `<div class="list-item">
      <div class="list-item-title">${esc(doc.tipo || doc.numero || "Documento")}</div>
      <div class="list-item-meta">${esc(doc.numero || "")} ${doc.data ? "· " + fmtDate(doc.data) : ""} ${doc.descricao ? "· " + esc(doc.descricao) : ""}</div>
    </div>`).join("")}
  </div>` : ""}

  ${observ.length ? `<div class="section">
    <div class="section-title">Observações Gerais (${observ.length})</div>
    <ul style="padding-left:20px;color:var(--text2)">
      ${observ.map((o: any) => `<li style="margin-bottom:6px;font-size:13px">${esc(typeof o === "string" ? o : (o.texto || JSON.stringify(o)))}</li>`).join("")}
    </ul>
  </div>` : ""}

  ${d.url_verificacao_tribunal ? `<div class="section">
    <div class="section-title">Verificação no Tribunal</div>
    <div class="card">
      <div class="card-label">URL de Verificação</div>
      <div style="margin-top:6px;word-break:break-all"><a href="${esc(d.url_verificacao_tribunal)}" target="_blank">${esc(d.url_verificacao_tribunal)}</a></div>
      ${d.codigo_verificador ? `<div style="margin-top:10px"><span class="card-label">Código:</span> <code style="color:var(--violet)">${esc(d.codigo_verificador)}</code></div>` : ""}
    </div>
  </div>` : ""}

  <div class="footer">
    Pipeline AuraLOA V2 · Extração: ${esc(d.extraction_method)} · ${d.paginas} páginas · ${d.chars_extraidos} caracteres<br>
    Tokens: in=${d.extraction_tokens_input} out=${d.extraction_tokens_output} · Custo: US$ ${esc(d.extraction_cost_usd)} · ${esc(d.extracted_at)}<br>
    Documento de origem: <code>${esc(d.file_original_name)}</code>
  </div>
</div>
</body></html>`;

  return { html, flags };
}

const outDir = path.join(import.meta.dirname, "..", "client", "public", "dd-reports");
const generated: Array<{ idx: number; file: string; d: any; flags: string[] }> = [];

for (let i = 0; i < rows.length; i++) {
  const idx = i + 1;
  const d = rows[i];
  const { html, flags } = gerarHtml(d, idx, rows.length);
  const fname = `agrovale_v${idx}_${d.validation_id}.html`;
  fs.writeFileSync(path.join(outDir, fname), html, "utf8");
  generated.push({ idx, file: fname, d, flags });
  console.log(`  [v${idx}] ${fname} · ${d.extraction_method} · ${flags.length} flags · ${fmtDateTime(d.extracted_at)}`);
}

// Índice das versões
const indiceHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Agrovale — Todas as Versões · AuraLOA</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
body{font-family:'Inter',sans-serif;background:#0d1117;color:#e2e8f0;padding:2rem;max-width:1300px;margin:0 auto}
h1{font-size:1.8rem;background:linear-gradient(135deg,#22d3ee,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.5rem}
.subtitle{color:#94a3b8;margin-bottom:2rem}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;padding:.7rem 1rem;background:#1c2a3f;color:#64748b;font-size:.7rem;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1e3a5f}
td{padding:.7rem 1rem;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}
tr:hover{background:rgba(255,255,255,.02)}
a{color:#22d3ee;text-decoration:none;font-weight:600}
a:hover{text-decoration:underline}
.tag{display:inline-block;padding:.2rem .6rem;border-radius:999px;font-size:.65rem;font-weight:600;text-transform:uppercase}
.tag-haiku{background:rgba(34,211,238,.1);color:#22d3ee;border:1px solid rgba(34,211,238,.2)}
.tag-vision{background:rgba(167,139,250,.1);color:#a78bfa;border:1px solid rgba(167,139,250,.2)}
.tag-flag{background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.3);margin-right:4px}
.numeric{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
</style></head><body>
<h1>Agrovale — Todas as versões processadas</h1>
<p class="subtitle">${rows.length} análises encontradas no banco V2 · Gerado em ${new Date().toLocaleString("pt-BR")}</p>
<table>
<thead><tr><th>v</th><th>Extraído em</th><th>Método</th><th class="numeric">Páginas</th><th>Valor R$</th><th>Beneficiários</th><th>Flags</th><th>validation_id</th><th>Relatório</th></tr></thead>
<tbody>
${generated.map(g => {
  const meta = g.d.metadados_requisicao || {};
  const benef = Array.isArray(g.d.beneficiarios_detalhados) ? g.d.beneficiarios_detalhados : [];
  const valor = parseFloat(meta.valor_total_requisitado || g.d.valor_rs || "0");
  const tagMeth = /haiku/i.test(g.d.extraction_method || "") ? "tag-haiku" : "tag-vision";
  return `<tr>
    <td><strong>${g.idx}</strong></td>
    <td>${fmtDateTime(g.d.extracted_at)}</td>
    <td><span class="tag ${tagMeth}">${esc(g.d.extraction_method || "—")}</span></td>
    <td class="numeric">${g.d.paginas || "—"}</td>
    <td class="numeric">${valor ? "R$ " + fmtBR(valor) : "—"}</td>
    <td class="numeric">${benef.length}</td>
    <td>${g.flags.length ? `<span class="tag tag-flag">${g.flags.length} flag${g.flags.length > 1 ? "s" : ""}</span>` : "<span style='color:#34d399'>OK</span>"}</td>
    <td style="font-size:11px;color:#64748b"><code>${esc(g.d.validation_id)}</code></td>
    <td><a href="${g.file}" target="_blank">Abrir →</a></td>
  </tr>`;
}).join("")}
</tbody>
</table>
<p style="color:#64748b;font-size:.75rem;margin-top:2rem">Cada versão é uma execução independente do pipeline V2 sobre o mesmo PDF de origem (Oficios Requisitorios Agrovale LOA 2023_Gilson.pdf). Variações entre versões refletem evolução do prompt/modelo.</p>
</body></html>`;

fs.writeFileSync(path.join(outDir, "agrovale_INDICE.html"), indiceHtml, "utf8");
console.log(`\n✅ Índice gerado: agrovale_INDICE.html`);
console.log(`📂 Pasta: ${outDir}`);
process.exit(0);
