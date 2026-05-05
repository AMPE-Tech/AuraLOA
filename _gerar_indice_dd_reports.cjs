const fs = require('fs');
const path = require('path');

// Pasta confidencial fora do OneDrive
const DIR = 'C:/AuraLOA-Confidencial/dd-reports';
const OUT = path.join(DIR, 'INDICE.html');

const SKIP_NAMES = new Set(['INDICE.html', 'agrovale_INDICE.html']);
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html') && !SKIP_NAMES.has(f));

const RE = /^dd_(?<trib>[a-zA-Z0-9]+)_(?<prec>.+?)_(?<ts>\d{13})\.html$/;

// Extrai valor/credor/devedor do HTML — suporta os 2 formatos do projeto
function extrairCampos(filepath) {
  let html;
  try { html = fs.readFileSync(filepath, 'utf8'); } catch (e) { return {}; }

  const out = { valor: '', credor: '', devedor: '' };

  // Formato B (cards): <div class="card-label">LABEL</div><div class="card-value...">VALUE</div>
  const cardRe = /<div class="card-label">([^<]+)<\/div>\s*<div class="card-value[^"]*"[^>]*>([^<]+)</gi;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const label = m[1].trim().toLowerCase();
    const val = m[2].trim();
    if (!out.valor && /^valor (requisitado|loa|principal)/i.test(label)) out.valor = val;
    if (!out.devedor && /devedor/i.test(label) && !/uo devedora/i.test(label)) out.devedor = val;
    if (!out.credor && /^credor/i.test(label)) out.credor = val;
  }

  // Formato A (field-row): <div class="field-key">LABEL</div\>... mas tem typo \\div em vários
  // Regex tolerante ao </div> ou <\div>
  const fieldRe = /<div class="field-key">([^<]+)<[\/\\]div>\s*<div class="field-val[^"]*"[^>]*>([^<]+)</gi;
  while ((m = fieldRe.exec(html)) !== null) {
    const label = m[1].trim().toLowerCase();
    const val = m[2].trim();
    if (!out.valor && /valor.*loa/i.test(label)) out.valor = val;
    if (!out.devedor && /uo devedora/i.test(label)) out.devedor = val;
    if (!out.credor && /^credor/i.test(label)) out.credor = val;
  }

  // Credor: buscar no <h1> se ainda não tem
  if (!out.credor) {
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1) {
      const t = h1[1].trim();
      if (t && !/auraloa|relatório|índice|dashboard/i.test(t)) out.credor = t;
    }
  }

  // CNJ formatado/cru e link nativo do tribunal (se houver)
  out.cnj = '';
  out.linkProcesso = '';
  // 1) URL de verificação direto do HTML (agrovale_v*)
  const urlMatch = html.match(/href="(https?:\/\/[^"]*(?:pje|esaj|tjsp|trf\d|jus\.br)[^"]*)"/i);
  if (urlMatch) out.linkProcesso = urlMatch[1];
  // 2) CNJ extraído do HTML
  const cnjMatch = html.match(/(\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4})/);
  if (cnjMatch) out.cnj = cnjMatch[1];

  // Contatos: advogados + sócios (nome + OAB)
  out.contatos = [];
  // Padrão Agrovale (list-item-title + list-item-meta com OAB)
  const advRe = /<div class="list-item-title">([^<]+)<\/div>\s*<div class="list-item-meta">([^<]*OAB[^<]+)</gi;
  let am;
  while ((am = advRe.exec(html)) !== null) {
    const nome = am[1].trim();
    const meta = am[2].trim();
    out.contatos.push({ nome, meta });
  }
  // Padrão genérico (qualquer texto com OAB próximo a nome)
  if (!out.contatos.length) {
    const oabRe = /OAB\s*\/?\s*([A-Z]{2})\s*[:\-]?\s*(\d+)/gi;
    let om;
    const seen = new Set();
    while ((om = oabRe.exec(html)) !== null) {
      const key = `${om[1]}-${om[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.contatos.push({ nome: '', meta: `OAB/${om[1]} ${om[2]}` });
      if (out.contatos.length >= 5) break;
    }
  }

  return out;
}

// Formata CNJ do nome do arquivo (20 dígitos crus → padrão CNJ NNNNNNN-DD.AAAA.J.TR.OOOO)
function formatarCNJ(prec) {
  const digits = String(prec).replace(/\D/g, '');
  if (digits.length !== 20) return prec;
  return `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16,20)}`;
}

// Constrói links de busca em 4 sistemas a partir do CNJ formatado
function buildLinks(cnj) {
  const enc = encodeURIComponent(cnj);
  return {
    escavador: `https://www.escavador.com/processos/cnj/${enc}`,
    jusbrasil: `https://www.jusbrasil.com.br/consulta?q=${enc}`,
    datajud: `https://www.cnj.jus.br/sistemas/datajud/?numeroProcesso=${enc}`,
    siop: `https://www.google.com/search?q=%22${enc}%22+site%3Asiop.planejamento.gov.br+OR+site%3Asenado.leg.br`,
  };
}
function linkEscavador(cnj) { return buildLinks(cnj).escavador; }

const items = files.map(f => {
  const fp = path.join(DIR, f);
  const stat = fs.statSync(fp);
  const campos = extrairCampos(fp);
  const m = f.match(RE);
  if (m) {
    const item = {
      file: f, ...campos,
      tribunal: m.groups.trib.toUpperCase(),
      precatorio: m.groups.prec,
      timestamp: parseInt(m.groups.ts),
      date: new Date(parseInt(m.groups.ts)),
      size: stat.size,
    };
    // Determina CNJ formatado a partir do nome do arquivo
    if (!item.cnj) {
      const raw = m.groups.prec;
      const normalizado = raw.replace(/_/g, '.');
      if (/^\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}$/.test(normalizado)) {
        item.cnj = normalizado;
      } else {
        const cnjFormat = formatarCNJ(raw);
        if (cnjFormat !== raw) item.cnj = cnjFormat;
      }
    }
    if (item.cnj) {
      item.links = buildLinks(item.cnj);
      if (!item.linkProcesso) item.linkProcesso = item.links.escavador;
    }
    return item;
  }
  const ag = f.match(/^agrovale_v(\d+)_/i);
  if (ag) {
    return {
      file: f, ...campos,
      tribunal: 'TRF1',
      precatorio: `Agrovale (versão ${ag[1]})`,
      timestamp: stat.mtimeMs,
      date: stat.mtime,
      size: stat.size,
    };
  }
  return {
    file: f, ...campos,
    tribunal: 'OUTRO',
    precatorio: f.replace(/\.html$/, ''),
    timestamp: stat.mtimeMs,
    date: stat.mtime,
    size: stat.size,
  };
});

const groups = new Map();
for (const it of items) {
  const key = `${it.tribunal}::${it.precatorio}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(it);
}
for (const arr of groups.values()) arr.sort((a, b) => b.timestamp - a.timestamp);

const sortedKeys = [...groups.keys()].sort();

const fmtSize = b => b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + 'MB' : Math.round(b / 1024) + 'KB';
const fmtDate = d => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const esc = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
const tagClass = t => ({
  TRF1: 'tag-trf1', TRF3: 'tag-trf3', TRF3AREGIO: 'tag-trf3',
  TJSP: 'tag-tjsp', PRELIMINAR: 'tag-prelim',
}[t] || 'tag-other');
const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const fmtContatos = arr => {
  if (!arr || !arr.length) return '<span class="muted">—</span>';
  const first = arr.slice(0, 2).map(c => `<div class="contato"><strong>${esc(trunc(c.nome, 32))}</strong>${c.meta ? `<br><span class="contato-meta">${esc(trunc(c.meta, 36))}</span>` : ''}</div>`).join('');
  const more = arr.length > 2 ? `<div class="contato-more">+${arr.length - 2} mais</div>` : '';
  return first + more;
};
const tooltipContatos = arr => arr.map(c => `${c.nome}${c.meta ? ' — ' + c.meta : ''}`).join(' | ');

let rows = '';
let n = 0;
for (const key of sortedKeys) {
  const versions = groups.get(key);
  const latest = versions[0];
  n++;
  const trib = latest.tribunal;
  const prec = latest.precatorio;
  rows += `<tr class="latest">
    <td>${n}</td>
    <td><span class="tag ${tagClass(trib)}">${esc(trib)}</span></td>
    <td>${esc(prec)}</td>
    <td class="valor">${esc(latest.valor) || '<span class="muted">—</span>'}</td>
    <td title="${esc(latest.credor)}">${esc(trunc(latest.credor, 40)) || '<span class="muted">—</span>'}</td>
    <td title="${esc(latest.devedor)}">${esc(trunc(latest.devedor, 40)) || '<span class="muted">—</span>'}</td>
    <td title="${esc(tooltipContatos(latest.contatos))}">${fmtContatos(latest.contatos)}</td>
    <td class="links-cell">${latest.links ? `
      <a href="${esc(latest.links.datajud)}" target="_blank" class="src src-dj" title="DataJud / CNJ — ${esc(latest.cnj)}">DJ</a>
      <a href="${esc(latest.links.escavador)}" target="_blank" class="src src-esc" title="Escavador — ${esc(latest.cnj)}">ESC</a>
      <a href="${esc(latest.links.jusbrasil)}" target="_blank" class="src src-jb" title="JusBrasil — ${esc(latest.cnj)}">JB</a>
      <a href="${esc(latest.links.siop)}" target="_blank" class="src src-siop" title="SIOP / Senado — ${esc(latest.cnj)}">SIOP</a>` : '<span class="muted">—</span>'}</td>
    <td><a href="${esc(latest.file)}" target="_blank">${esc(trunc(latest.file, 50))}</a></td>
    <td>${fmtDate(latest.date)}</td>
    <td>${versions.length > 1 ? `<span class="ver-count">${versions.length}v</span>` : ''}</td>
  </tr>\n`;
  for (let i = 1; i < versions.length; i++) {
    const v = versions[i];
    rows += `<tr class="older">
      <td></td><td></td>
      <td class="muted">↳ versão antiga</td>
      <td class="valor">${esc(v.valor) || '<span class="muted">—</span>'}</td>
      <td title="${esc(v.credor)}">${esc(trunc(v.credor, 40)) || '<span class="muted">—</span>'}</td>
      <td title="${esc(v.devedor)}">${esc(trunc(v.devedor, 40)) || '<span class="muted">—</span>'}</td>
      <td title="${esc(tooltipContatos(v.contatos))}">${fmtContatos(v.contatos)}</td>
      <td></td>
      <td><a href="${esc(v.file)}" target="_blank">${esc(trunc(v.file, 50))}</a></td>
      <td>${fmtDate(v.date)}</td>
      <td></td>
    </tr>\n`;
  }
}

const total = items.length;
const grupos = sortedKeys.length;
const stamp = new Date().toLocaleString('pt-BR');

const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>AuraLOA — Índice DD Reports</title>
<style>
body{font-family:'Inter',sans-serif;background:#0d1117;color:#e2e8f0;padding:2rem;max-width:1600px;margin:0 auto}
h1{font-size:1.8rem;background:linear-gradient(135deg,#22d3ee,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.5rem}
.subtitle{color:#94a3b8;margin-bottom:2rem}
.stats{display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap}
.stat{background:#162032;border:1px solid #1e3a5f;border-radius:8px;padding:.8rem 1.2rem}
.stat-num{font-size:1.4rem;font-weight:700;color:#22d3ee}
.stat-label{font-size:.7rem;color:#64748b;text-transform:uppercase;letter-spacing:1px}
.controls{margin-bottom:1rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
input[type=search]{flex:1;min-width:240px;background:#162032;border:1px solid #1e3a5f;color:#e2e8f0;padding:.6rem 1rem;border-radius:6px;font-family:inherit;font-size:.9rem}
input[type=search]:focus{outline:none;border-color:#22d3ee}
.toggle{background:#1c2a3f;border:1px solid #1e3a5f;color:#94a3b8;padding:.5rem 1rem;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.8rem}
.toggle:hover{border-color:#22d3ee;color:#e2e8f0}
.toggle.active{background:#22d3ee;color:#0d1117;border-color:#22d3ee}
table{width:100%;border-collapse:collapse;font-size:.82rem}
th{text-align:left;padding:.7rem .9rem;background:#1c2a3f;color:#64748b;font-size:.68rem;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1e3a5f;position:sticky;top:0}
td{padding:.6rem .9rem;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}
tr.latest:hover{background:rgba(255,255,255,.02)}
tr.older{background:rgba(255,255,255,.01);font-size:.74rem;color:#64748b}
tr.older.hidden{display:none}
td.valor{color:#34d399;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums}
.muted{color:#64748b;font-style:italic;font-weight:400}
a{color:#22d3ee;text-decoration:none}
a:hover{text-decoration:underline}
.tag{display:inline-block;padding:.2rem .6rem;border-radius:999px;font-size:.65rem;font-weight:600;text-transform:uppercase}
.tag-trf1{background:rgba(34,211,238,.1);color:#22d3ee;border:1px solid rgba(34,211,238,.2)}
.tag-trf3{background:rgba(167,139,250,.1);color:#a78bfa;border:1px solid rgba(167,139,250,.2)}
.tag-tjsp{background:rgba(52,211,153,.1);color:#34d399;border:1px solid rgba(52,211,153,.2)}
.tag-prelim{background:rgba(251,191,36,.1);color:#fbbf24;border:1px solid rgba(251,191,36,.2)}
.tag-other{background:rgba(148,163,184,.1);color:#94a3b8;border:1px solid rgba(148,163,184,.2)}
.ver-count{display:inline-block;padding:.15rem .5rem;border-radius:4px;background:rgba(248,113,113,.1);color:#f87171;font-size:.65rem;font-weight:600}
.contato{font-size:.78rem;line-height:1.3;margin-bottom:3px}
.contato strong{color:#e2e8f0;font-weight:600}
.contato-meta{font-size:.7rem;color:#94a3b8;font-variant-numeric:tabular-nums}
.contato-more{font-size:.68rem;color:#64748b;font-style:italic}
.proc-link{display:inline-block;padding:.25rem .65rem;border-radius:6px;background:rgba(167,139,250,.1);color:#a78bfa;border:1px solid rgba(167,139,250,.25);font-size:.72rem;font-weight:600;white-space:nowrap}
.proc-link:hover{background:rgba(167,139,250,.18);text-decoration:none;border-color:#a78bfa}
.links-cell{white-space:nowrap}
.src{display:inline-block;padding:.18rem .42rem;border-radius:4px;font-size:.62rem;font-weight:700;letter-spacing:.5px;margin-right:3px;border:1px solid;text-decoration:none}
.src:hover{text-decoration:none;filter:brightness(1.3)}
.src-dj{background:rgba(34,211,238,.08);color:#22d3ee;border-color:rgba(34,211,238,.3)}
.src-esc{background:rgba(167,139,250,.08);color:#a78bfa;border-color:rgba(167,139,250,.3)}
.src-jb{background:rgba(52,211,153,.08);color:#34d399;border-color:rgba(52,211,153,.3)}
.src-siop{background:rgba(251,191,36,.08);color:#fbbf24;border-color:rgba(251,191,36,.3)}
.confbanner{background:linear-gradient(90deg,#7c3aed,#22d3ee,#7c3aed);background-size:200% 100%;animation:shimmer 4s ease infinite;text-align:center;padding:6px 0;font-size:10px;font-weight:700;letter-spacing:3px;color:#fff;text-transform:uppercase;margin:-2rem -2rem 1.5rem}
@keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
</style></head><body>
<div class="confbanner">CONFIDENCIAL · LGPD · DD REPORTS · USO INTERNO</div>
<h1>AuraLOA — Índice Completo DD Reports</h1>
<p class="subtitle">Todos os relatórios de Due Diligence · pasta confidencial fora do OneDrive · gerado em ${stamp}</p>
<div class="stats">
  <div class="stat"><div class="stat-num">${grupos}</div><div class="stat-label">Precatórios únicos</div></div>
  <div class="stat"><div class="stat-num">${total}</div><div class="stat-label">Arquivos no total</div></div>
  <div class="stat"><div class="stat-num">${total - grupos}</div><div class="stat-label">Versões antigas</div></div>
</div>
<div class="controls">
  <input type="search" id="q" placeholder="Filtrar por tribunal, precatório, credor, devedor, valor ou arquivo..." />
  <button class="toggle" id="toggleOld">Mostrar versões antigas</button>
</div>
<table>
<thead><tr><th>#</th><th>Tribunal</th><th>Precatório</th><th>Valor</th><th>Credor</th><th>Devedor</th><th>Contatos</th><th>Buscar em</th><th>Arquivo</th><th>Gerado em</th><th>Versões</th></tr></thead>
<tbody id="tb">
${rows}
</tbody></table>
<p style="color:#64748b;font-size:.75rem;margin-top:2rem">Mais recente de cada precatório aparece em destaque. "Versões antigas" mostram tentativas anteriores do pipeline. Valor/Credor/Devedor extraídos automaticamente do HTML — pode haver "—" quando o relatório antigo não trazia o campo.</p>
<script>
(function(){
  var rows = document.querySelectorAll('#tb tr');
  var older = document.querySelectorAll('#tb tr.older');
  older.forEach(function(r){ r.classList.add('hidden'); });
  document.getElementById('toggleOld').addEventListener('click', function(){
    var btn = this;
    btn.classList.toggle('active');
    older.forEach(function(r){ r.classList.toggle('hidden'); });
    btn.textContent = btn.classList.contains('active') ? 'Ocultar versões antigas' : 'Mostrar versões antigas';
  });
  document.getElementById('q').addEventListener('input', function(e){
    var q = e.target.value.toLowerCase().trim();
    rows.forEach(function(r){
      if (!q) { r.style.display = r.classList.contains('older') && !document.getElementById('toggleOld').classList.contains('active') ? 'none' : ''; return; }
      r.style.display = r.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
    });
  });
})();
</script>
</body></html>`;

fs.writeFileSync(OUT, html, 'utf8');
const comValor = items.filter(i => i.valor).length;
const comCredor = items.filter(i => i.credor).length;
const comDevedor = items.filter(i => i.devedor).length;
const comContatos = items.filter(i => i.contatos && i.contatos.length).length;
const comLink = items.filter(i => i.linkProcesso).length;
console.log(`OK · ${grupos} precatórios · ${total} arquivos`);
console.log(`Extração: ${comValor}/${total} valor · ${comCredor}/${total} credor · ${comDevedor}/${total} devedor · ${comContatos}/${total} contatos · ${comLink}/${total} link processo`);
console.log(`Saída: ${OUT}`);
