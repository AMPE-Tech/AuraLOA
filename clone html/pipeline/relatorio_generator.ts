/**
 * relatorio_generator.ts
 * Geração do relatório final de due diligence — HTML dark + PDF formal.
 * Design: AuraTECH v11 (tokens canônicos extraídos em 30/03/2026).
 * Saída: relatório para a Dra. Márcia Mirtes (defensora).
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import type { ProcessoMetadata } from "./tjsp_auth.js";
import type { CheckpointData } from "./documento_downloader.js";
import type { ResultadoCadeiaCustodia } from "./cadeia_custodia.js";
import type { ResultadoConformidade } from "./conformidade_cpp.js";
import type { ResultadoRadarDefesa } from "./radar_defesa.js";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(__filename);
const PDFDocument = require("pdfkit");

export interface RelatorioConfig {
  numeroCNJ: string;
  cliente: string;
  defensora: string;
  dataAnalise: string;
  dirSaida: string;
}

// ── Helpers de apresentação ────────────────────────────────────────────────

function pillCategoria(cat: string): string {
  const mapa: Record<string, { cls: string; label: string }> = {
    NULIDADE_ABSOLUTA:    { cls: "pill-risk",  label: "Nulidade Absoluta" },
    NULIDADE_RELATIVA:    { cls: "pill-warn",  label: "Nulidade Relativa" },
    PROVA_ILICITA:        { cls: "pill-purp",  label: "Prova Ilícita" },
    CERCEAMENTO_DEFESA:   { cls: "pill-info",  label: "Cerceamento Defesa" },
    INCONSTITUCIONALIDADE:{ cls: "pill-purp",  label: "Inconstitucionalidade" },
    PRESCRICAO:           { cls: "pill-ok",    label: "Prescrição" },
    ARGUMENTOS_MERITO:    { cls: "pill-info",  label: "Mérito" },
    MITIGACAO_PENA:       { cls: "pill-ok",    label: "Mitigação Pena" },
  };
  const info = mapa[cat] ?? { cls: "pill-muted", label: cat };
  return `<span class="pill ${info.cls}">${info.label}</span>`;
}

function pillGravidade(g: string): string {
  if (g === "CRITICA" || g === "URGENTE") return `<span class="pill pill-risk">${g}</span>`;
  if (g === "ALTA") return `<span class="pill pill-warn">${g}</span>`;
  if (g === "MEDIA") return `<span class="pill pill-info">${g}</span>`;
  return `<span class="pill pill-muted">${g}</span>`;
}

function gauge(label: string, value: number, max: number, color: string, sublabel: string): string {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return `
  <div class="gauge-card">
    <div class="gc-label">${label.toUpperCase()}</div>
    <div class="gc-scale"><span>0</span><span>${max}</span></div>
    <div class="gc-track">
      <div class="gc-fill" style="width:${pct}%;background:${color};"></div>
      <div class="gc-needle" style="left:${pct}%;background:${color};"></div>
    </div>
    <div class="gc-value" style="color:${color};">${value}<span style="font-size:12px;font-weight:400;color:var(--text3);">/${max}</span></div>
    <div class="gc-sub">${sublabel}</div>
  </div>`;
}

function findingCard(
  iconLabel: string,
  iconClass: string,
  title: string,
  body: string,
  extra = "",
): string {
  return `
  <div class="finding">
    <div class="f-icon ${iconClass}">${iconLabel}</div>
    <div style="flex:1;">
      <div class="f-title">${title}</div>
      <div class="f-body">${body}</div>
      ${extra}
    </div>
  </div>`;
}

function secaoSubsidios(
  subsidios: ResultadoRadarDefesa["subsidiosCriticos"],
  titulo: string,
  iconClass: string,
  iconLetter: string,
): string {
  if (subsidios.length === 0) return "";
  return `
  <div class="sh" style="margin-top:32px;">
    <div class="sh-eye">${titulo.toUpperCase()} — ${subsidios.length} IDENTIFICADOS</div>
  </div>
  ${subsidios.map((s) => `
  <div class="card" style="margin-bottom:12px;">
    <div class="finding" style="padding:0;border:none;">
      <div class="f-icon ${iconClass}">${iconLetter}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <span class="f-title">${s.titulo}</span>
          ${pillCategoria(s.categoria)}
        </div>
        <div class="f-body" style="margin-bottom:10px;">${s.descricao}</div>
        <div style="background:var(--bg4);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:8px;">
          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;color:var(--text3);margin-bottom:5px;">FUNDAMENTO LEGAL</div>
          ${s.fundamentoLegal.map((f) => `<div style="color:var(--cyan);font-size:11px;">• ${f}</div>`).join("")}
        </div>
        ${s.jurisprudencia.length > 0 ? `
        <div style="background:var(--bg4);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:8px;">
          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;color:var(--text3);margin-bottom:5px;">JURISPRUDÊNCIA</div>
          ${s.jurisprudencia.map((j) => `<div style="color:var(--violet);font-size:11px;">• ${j}</div>`).join("")}
        </div>` : ""}
        <div style="background:rgba(34,211,238,.04);border:1px solid rgba(34,211,238,.1);border-radius:var(--radius-sm);padding:10px 14px;">
          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;color:var(--text3);margin-bottom:5px;">ESTRATÉGIA DEFENSIVA</div>
          <div style="color:var(--text2);font-size:11px;">${s.estrategia}</div>
        </div>
      </div>
    </div>
  </div>
  `).join("")}`;
}

// ── CSS v11 canônico ───────────────────────────────────────────────────────

const CSS_V11 = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ─── TOKENS AuraTECH v11 ─── */
:root {
  --bg:        #0f1623;
  --bg2:       #162032;
  --bg3:       #1a2840;
  --bg4:       #0d1420;
  --border:    rgba(255,255,255,0.07);
  --border2:   rgba(255,255,255,0.12);
  --text:      #f1f5f9;
  --text2:     #94a3b8;
  --text3:     #64748b;
  --cyan:      #22d3ee;
  --cyan2:     #06b6d4;
  --violet:    #a78bfa;
  --violet2:   #7c3aed;
  --green:     #34d399;
  --green2:    #10b981;
  --amber:     #fbbf24;
  --red:       #f87171;
  --red2:      #ef4444;
  --brand:     linear-gradient(135deg,#06b6d4,#7c3aed);
  --radius:    12px;
  --radius-sm: 7px;
  --radius-pill: 999px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{font-size:14px;}
body{font-family:'Open Sans',system-ui,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;line-height:1.6;font-size:13px;}

/* TOPBAR */
.topbar{position:sticky;top:0;z-index:100;background:rgba(15,22,35,0.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 32px;display:flex;align-items:center;justify-content:space-between;height:60px;}
.logo{display:flex;align-items:center;gap:10px;}
.logo-icon{width:36px;height:36px;border-radius:8px;background:var(--brand);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.logo-icon svg{width:18px;height:18px;color:white;}
.logo-name{font-size:13px;font-weight:600;color:var(--text);letter-spacing:-.01em;}
.logo-tag{font-size:10px;color:var(--text3);}
.topbar-right{display:flex;align-items:center;gap:12px;}
.topbar-badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:var(--radius-pill);font-size:10px;font-weight:700;letter-spacing:.04em;background:rgba(248,113,113,.12);color:var(--red);border:1px solid rgba(248,113,113,.22);}
.topbar-cnj{font-size:11px;color:var(--text3);font-family:Menlo,'Courier New',monospace;}

/* NAV */
.nav{background:var(--bg4);border-bottom:1px solid var(--border);padding:0 32px;display:flex;overflow-x:auto;scrollbar-width:none;position:sticky;top:60px;z-index:99;}
.nav::-webkit-scrollbar{display:none;}
.nav-btn{padding:12px 14px;font-size:11px;font-weight:400;color:var(--text3);background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-family:'Open Sans',system-ui,sans-serif;white-space:nowrap;transition:all .15s;}
.nav-btn:hover{color:var(--text2);}
.nav-btn.on{color:var(--cyan);font-weight:600;border-bottom-color:var(--cyan);}

/* PAGE */
.page{max-width:1100px;margin:0 auto;padding:28px 32px 60px;}
.sec{display:none;}
.sec.on{display:block;animation:fadeIn .25s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}

/* COVER */
.cover{padding:36px 0 32px;border-bottom:1px solid var(--border);margin-bottom:32px;}
.cover-eye{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:500;letter-spacing:.1em;color:var(--text3);margin-bottom:20px;}
.cover-eye-line{width:24px;height:2px;border-radius:1px;background:var(--brand);}
.cover-title{font-size:30px;font-weight:700;color:#F8F9FF;line-height:1.2;letter-spacing:-.02em;margin-bottom:8px;}
.cover-title .line1{display:block;color:#F8F9FF;}
.cover-title .line2{display:block;color:#CBD5E1;font-weight:300;font-size:26px;letter-spacing:-.015em;margin-top:2px;}
.cover-sub{font-size:11px;color:var(--text2);margin-bottom:28px;line-height:1.6;}
.cover-meta{display:flex;flex-wrap:wrap;gap:20px;padding-top:18px;border-top:1px solid var(--border);align-items:center;}
.cmi-label{font-size:10px;letter-spacing:.08em;color:var(--text3);margin-bottom:4px;}
.cmi-value{font-size:11px;font-weight:500;color:var(--text);line-height:1.4;}
.cmi-value.mono{font-family:Menlo,'Courier New',monospace;font-size:10px;color:var(--cyan);}
.cover-badges{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;}

/* PILLS */
.pill{display:inline-flex;align-items:center;padding:3px 10px;border-radius:var(--radius-pill);font-size:10px;font-weight:600;letter-spacing:.04em;white-space:nowrap;}
.pill-ok   {background:rgba(52,211,153,.15);color:var(--green);border:1px solid rgba(52,211,153,.25);}
.pill-warn {background:rgba(251,191,36,.12);color:var(--amber);border:1px solid rgba(251,191,36,.22);}
.pill-risk {background:rgba(248,113,113,.12);color:var(--red);border:1px solid rgba(248,113,113,.22);}
.pill-info {background:rgba(34,211,238,.12);color:var(--cyan);border:1px solid rgba(34,211,238,.22);}
.pill-purp {background:rgba(167,139,250,.12);color:var(--violet);border:1px solid rgba(167,139,250,.22);}
.pill-muted{background:rgba(255,255,255,.06);color:var(--text3);border:1px solid var(--border);}

/* KPI */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px;}
.kpi-grid-3{grid-template-columns:repeat(3,1fr);}
.kpi-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;position:relative;overflow:hidden;transition:border-color .15s;}
.kpi-card:hover{border-color:var(--border2);}
.kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}
.kpi-card.cyan::before{background:var(--cyan);}
.kpi-card.green::before{background:var(--green);}
.kpi-card.violet::before{background:var(--violet);}
.kpi-card.amber::before{background:var(--amber);}
.kpi-card.red::before{background:var(--red);}
.kc-label{font-size:10px;font-weight:500;letter-spacing:.09em;color:var(--text3);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;}
.kc-value{font-size:22px;font-weight:700;color:var(--text);line-height:1;margin-bottom:4px;}
.kc-value.cyan{color:var(--cyan);}
.kc-value.green{color:var(--green);}
.kc-value.violet{color:var(--violet);}
.kc-value.amber{color:var(--amber);}
.kc-value.red{color:var(--red);}
.kc-sub{font-size:10px;color:var(--text3);line-height:1.4;}

/* SECTION HEADING */
.sh{margin-bottom:18px;}
.sh-eye{font-size:10px;font-weight:500;letter-spacing:.09em;color:var(--text3);margin-bottom:5px;}
.sh-title{font-size:14px;font-weight:600;color:var(--text);letter-spacing:-.01em;line-height:1.4;margin-bottom:6px;}
.sh-body{font-size:11px;color:var(--text2);line-height:1.65;max-width:680px;}
.divider{border:none;border-top:1px solid var(--border);margin:36px 0;}

/* CARDS */
.card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;}
.card+.card{margin-top:12px;}

/* GAUGES */
.gauges{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:32px;}
.gauge-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;}
.gc-label{font-size:10px;font-weight:500;letter-spacing:.07em;color:var(--text3);margin-bottom:10px;}
.gc-scale{display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-bottom:5px;}
.gc-track{height:5px;border-radius:3px;background:rgba(255,255,255,.08);position:relative;margin-bottom:12px;}
.gc-fill{height:100%;border-radius:3px;}
.gc-needle{width:11px;height:11px;border-radius:50%;border:2px solid var(--bg);position:absolute;top:-3px;transform:translateX(-50%);}
.gc-value{font-size:15px;font-weight:700;margin-bottom:4px;line-height:1.2;}
.gc-sub{font-size:10px;color:var(--text2);line-height:1.5;}

/* PIPELINE */
.pipeline{display:flex;border-radius:var(--radius);border:1px solid var(--border);overflow:hidden;margin-bottom:32px;}
.pipe-step{flex:1;padding:11px 6px;text-align:center;background:var(--bg2);border-right:1px solid var(--border);transition:background .15s;}
.pipe-step:last-child{border-right:none;}
.pipe-step.done{background:rgba(34,211,238,.08);}
.pipe-num{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;margin:0 auto 6px;background:rgba(255,255,255,.06);color:var(--text3);}
.pipe-step.done .pipe-num{background:rgba(34,211,238,.2);color:var(--cyan);}
.pipe-lbl{font-size:10px;color:var(--text3);line-height:1.3;}
.pipe-step.done .pipe-lbl{color:var(--text2);}

/* PARTES */
.partes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;}
.parte{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:13px 16px;}
.parte-role{font-size:10px;letter-spacing:.08em;color:var(--text3);font-weight:500;margin-bottom:5px;}
.parte-name{font-size:12px;font-weight:600;color:var(--text);line-height:1.35;}

/* INFO TABLE */
.info-tbl{width:100%;border-collapse:collapse;}
.info-tbl td{padding:9px 0;border-bottom:1px solid var(--border);font-size:11px;vertical-align:top;line-height:1.6;}
.info-tbl tr:last-child td{border-bottom:none;}
.info-tbl .lbl{color:var(--text3);font-size:10px;width:34%;padding-right:16px;letter-spacing:.04em;}
.info-tbl .mono{font-family:Menlo,'Courier New',monospace;font-size:11px;color:var(--cyan);}

/* FINDINGS */
.finding{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--border);}
.finding:last-child{border-bottom:none;}
.f-icon{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px;}
.fi-c{background:rgba(248,113,113,.15);color:var(--red);}
.fi-a{background:rgba(251,191,36,.12);color:var(--amber);}
.fi-m{background:rgba(34,211,238,.12);color:var(--cyan);}
.fi-v{background:rgba(167,139,250,.12);color:var(--violet);}
.fi-g{background:rgba(52,211,153,.12);color:var(--green);}
.f-title{font-size:12px;font-weight:600;color:var(--text);margin-bottom:3px;line-height:1.35;}
.f-body{font-size:11px;color:var(--text2);line-height:1.6;}

/* ACTION TABLE */
.action-tbl{width:100%;border-collapse:collapse;font-size:12px;}
.action-tbl th{text-align:left;padding:8px 12px;font-size:10px;letter-spacing:.07em;color:var(--text3);font-weight:600;border-bottom:1px solid var(--border);background:rgba(255,255,255,.03);}
.action-tbl td{padding:9px 12px;border-bottom:1px solid var(--border);vertical-align:top;color:var(--text2);line-height:1.55;font-size:11px;}
.action-tbl tr:last-child td{border-bottom:none;}
.action-tbl tbody tr:hover td{background:rgba(255,255,255,.02);}
.row-ok td{border-left:2px solid var(--green2);}
.row-critico td{border-left:2px solid var(--red2);}
.row-alerta td{border-left:2px solid var(--amber);}

/* NARRATIVE */
.narrative{font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:16px;}
.narrative strong{color:var(--text);font-weight:600;}

/* SHA BOX */
.sha-box{margin-top:16px;background:rgba(34,211,238,.05);border:1px solid rgba(34,211,238,.15);border-radius:var(--radius);padding:14px 18px;font-family:Menlo,'Courier New',monospace;font-size:11px;color:var(--text3);line-height:1.75;}
.sha-label{font-size:10px;font-weight:500;letter-spacing:.07em;color:var(--cyan);margin-bottom:7px;font-family:'Open Sans',system-ui,sans-serif;}
.sha-box strong{color:var(--green);}

/* FOOTER */
.site-footer{margin-top:40px;padding:18px 0 24px;border-top:1px solid var(--border);}
.sf-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;}
.sf-left{display:flex;align-items:center;gap:10px;}
.sf-logo-icon{width:22px;height:22px;min-width:22px;border-radius:5px;background:var(--brand);display:flex;align-items:center;justify-content:center;}
.sf-logo-icon svg{width:11px;height:11px;}
.sf-logo-name{font-size:11px;font-weight:600;color:var(--text2);letter-spacing:-.01em;}
.sf-meta{font-size:10px;color:var(--text3);line-height:1.6;}
.sf-sha{font-family:Menlo,'Courier New',monospace;font-size:10px;color:var(--text3);}

/* PRINT */
@media print{
  .topbar,.nav{display:none;}
  body{background:#fff;color:#000;}
  .sec{display:block!important;}
  .card,.kpi-card,.gauge-card,.parte{background:#f8f8f8!important;border:1px solid #ddd!important;break-inside:avoid;}
  .kc-value,.f-title,.parte-name,.sh-title{color:#000!important;}
  .kc-sub,.f-body,.sh-body,.narrative,.gc-sub{color:#444!important;}
  .kc-value.cyan,.kc-value.green,.kc-value.violet,.cmi-value.mono,.info-tbl .mono{color:#0369a1!important;}
  .sha-box{background:#f0fdf4!important;border-color:#86efac!important;}
}
@media(max-width:700px){
  .page,.topbar,.nav{padding-left:16px;padding-right:16px;}
  .kpi-grid,.kpi-grid-3,.gauges,.partes{grid-template-columns:1fr;}
  .sf-row{flex-direction:column;align-items:flex-start;gap:8px;}
  .pipeline{flex-wrap:wrap;}
  .pipe-step{min-width:80px;}
  .cover-title{font-size:22px;}
}
</style>`;

// ── gerarRelatorioHTML ─────────────────────────────────────────────────────

export function gerarRelatorioHTML(
  config: RelatorioConfig,
  metadata: ProcessoMetadata,
  checkpoint: CheckpointData,
  custodia: ResultadoCadeiaCustodia,
  conformidade: ResultadoConformidade,
  radar: ResultadoRadarDefesa,
): string {
  const dataFormatada = new Date(config.dataAnalise).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const sha256Relatorio = createHash("sha256")
    .update(JSON.stringify({ numeroCNJ: config.numeroCNJ, dataAnalise: config.dataAnalise, sha256Custodia: custodia.sha256Relatorio }))
    .digest("hex");

  // Scores
  const scoreCustodia = custodia.scoreIntegridade;
  const scoreConf = conformidade.scoreConformidade;
  const corCustodia = scoreCustodia >= 80 ? "var(--green)" : scoreCustodia >= 60 ? "var(--amber)" : "var(--red)";
  const corConf = scoreConf >= 80 ? "var(--green)" : scoreConf >= 50 ? "var(--amber)" : "var(--red)";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AuraDUE · Due Diligence Criminal · ${config.numeroCNJ}</title>
${CSS_V11}
</head>
<body>

<!-- ── TOPBAR ── -->
<header class="topbar">
  <div class="logo">
    <div class="logo-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
        <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
        <path d="M7 21h10"/><path d="M12 3v18"/>
        <path d="M3 7h2c2 0 4-1 6-2 2 1 4 2 6 2h2"/>
      </svg>
    </div>
    <div>
      <div class="logo-name">AuraDUE</div>
      <div class="logo-tag">Motor de Due Diligence Criminal</div>
    </div>
  </div>
  <div class="topbar-right">
    <span class="topbar-cnj">${config.numeroCNJ}</span>
    <span class="topbar-badge">⚠ SEGREDO DE JUSTIÇA</span>
  </div>
</header>

<!-- ── NAV TABS ── -->
<nav class="nav">
  <button class="nav-btn on" onclick="show('visao')">Visão Geral</button>
  <button class="nav-btn" onclick="show('resumo')">Resumo Executivo</button>
  <button class="nav-btn" onclick="show('subsidios')">Subsídios (${radar.subsidiosCriticos.length + radar.subsidiosAlta.length + radar.subsidiosMedia.length})</button>
  <button class="nav-btn" onclick="show('custodia')">Cadeia de Custódia</button>
  <button class="nav-btn" onclick="show('conformidade')">Conformidade Legal</button>
  <button class="nav-btn" onclick="show('autenticidade')">Autenticidade</button>
</nav>

<div class="page">

<!-- ══ SEÇÃO: VISÃO GERAL ══ -->
<div id="sec-visao" class="sec on">

  <div class="cover">
    <div class="cover-eye">
      <div class="cover-eye-line"></div>
      DUE DILIGENCE CRIMINAL · TJSP · ${dataFormatada}
    </div>
    <div class="cover-title">
      <span class="line1">${metadata.classe || "Inquérito Policial"}</span>
      <span class="line2">${metadata.assunto || "Processo Criminal"}</span>
    </div>
    <div class="cover-sub">
      Elaborado para <strong style="color:var(--text)">${config.defensora}</strong> ·
      Documento confidencial — uso exclusivo da equipe de defesa ·
      Tribunal: TJSP · Vara: ${metadata.vara?.split("\n")[0]?.trim() || "—"}
    </div>
    <div class="cover-meta">
      <div>
        <div class="cmi-label">PROCESSO</div>
        <div class="cmi-value mono">${config.numeroCNJ}</div>
      </div>
      <div>
        <div class="cmi-label">DATA DA ANÁLISE</div>
        <div class="cmi-value">${dataFormatada}</div>
      </div>
      <div>
        <div class="cmi-label">PEÇAS PROCESSUAIS</div>
        <div class="cmi-value">${checkpoint.totalPecas.toLocaleString("pt-BR")}</div>
      </div>
      <div>
        <div class="cmi-label">DOCUMENTOS ANALISADOS (IA)</div>
        <div class="cmi-value">${radar.totalDocumentosAnalisados}</div>
      </div>
      <div class="cover-badges">
        ${custodia.integridadeGeral === "PRESERVADA" ? '<span class="pill pill-ok">Custódia OK</span>' : '<span class="pill pill-warn">Custódia Parcial</span>'}
        ${conformidade.nulidadesAbsolutas > 0 ? `<span class="pill pill-risk">${conformidade.nulidadesAbsolutas} Nulidades Abs.</span>` : '<span class="pill pill-ok">Sem Nulidades Abs.</span>'}
        ${radar.subsidiosCriticos.length > 0 ? `<span class="pill pill-risk">${radar.subsidiosCriticos.length} Subsídios Urgentes</span>` : ""}
      </div>
    </div>
  </div>

  <!-- KPI STRIP -->
  <div class="kpi-grid" style="margin-bottom:12px;">
    <div class="kpi-card cyan">
      <div class="kc-label">CUSTÓDIA</div>
      <div class="kc-value cyan">${scoreCustodia}<span style="font-size:12px;font-weight:400;color:var(--text3);">/100</span></div>
      <div class="kc-sub">${custodia.integridadeGeral}</div>
    </div>
    <div class="kpi-card ${scoreConf >= 80 ? "green" : scoreConf >= 50 ? "amber" : "red"}">
      <div class="kc-label">CONFORMIDADE LEGAL</div>
      <div class="kc-value ${scoreConf >= 80 ? "green" : scoreConf >= 50 ? "amber" : "red"}">${scoreConf}<span style="font-size:12px;font-weight:400;color:var(--text3);">/100</span></div>
      <div class="kc-sub">${conformidade.totalRegras} regras CPP/CF/CADH</div>
    </div>
    <div class="kpi-card red">
      <div class="kc-label">NULIDADES ABSOLUTAS</div>
      <div class="kc-value red">${conformidade.nulidadesAbsolutas}</div>
      <div class="kc-sub">${conformidade.nulidadesRelativas} relativas · ${conformidade.irregularidades} irregularidades</div>
    </div>
    <div class="kpi-card violet">
      <div class="kc-label">SUBSÍDIOS URGENTES</div>
      <div class="kc-value violet">${radar.subsidiosCriticos.length}</div>
      <div class="kc-sub">${radar.subsidiosAlta.length} alta prioridade · ${radar.subsidiosMedia.length} média</div>
    </div>
  </div>
  <div class="kpi-grid kpi-grid-3">
    <div class="kpi-card cyan">
      <div class="kc-label">TOTAL DE PEÇAS</div>
      <div class="kc-value cyan">${checkpoint.totalPecas.toLocaleString("pt-BR")}</div>
      <div class="kc-sub">Inventário completo disponível</div>
    </div>
    <div class="kpi-card ${custodia.totalLacunas > 0 ? "red" : "green"}">
      <div class="kc-label">LACUNAS DE NUMERAÇÃO</div>
      <div class="kc-value ${custodia.totalLacunas > 0 ? "red" : "green"}">${custodia.totalLacunas}</div>
      <div class="kc-sub">${custodia.totalLacunas > 0 ? "Possível supressão de documentos" : "Sequência contínua verificada"}</div>
    </div>
    <div class="kpi-card violet">
      <div class="kc-label">DOCS ANALISADOS IA</div>
      <div class="kc-value violet">${radar.totalDocumentosAnalisados}</div>
      <div class="kc-sub">Claude AI · Haiku + Sonnet</div>
    </div>
  </div>

  <!-- PIPELINE -->
  <div class="pipeline" style="margin-top:24px;">
    <div class="pipe-step done"><div class="pipe-num">1</div><div class="pipe-lbl">Autenticação<br>eSAJ</div></div>
    <div class="pipe-step done"><div class="pipe-num">2</div><div class="pipe-lbl">Download<br>Documentos</div></div>
    <div class="pipe-step done"><div class="pipe-num">3</div><div class="pipe-lbl">Cadeia de<br>Custódia</div></div>
    <div class="pipe-step done"><div class="pipe-num">4</div><div class="pipe-lbl">42 Regras<br>CPP/CF/CADH</div></div>
    <div class="pipe-step done"><div class="pipe-num">5</div><div class="pipe-lbl">Radar IA<br>Claude</div></div>
    <div class="pipe-step done"><div class="pipe-num">6</div><div class="pipe-lbl">Relatório<br>Final</div></div>
  </div>

  <!-- PARTES PROCESSUAIS -->
  ${metadata.partes && metadata.partes.length > 0 ? `
  <div class="sh">
    <div class="sh-eye">COMPOSIÇÃO PROCESSUAL</div>
    <div class="sh-title">Partes do Processo</div>
  </div>
  <div class="partes">
    ${metadata.partes.slice(0, 8).map((p) => `
    <div class="parte">
      <div class="parte-role">${p.polo.toUpperCase()}</div>
      <div class="parte-name">${p.nome.split("\n")[0].trim()}</div>
    </div>`).join("")}
  </div>` : ""}

  <!-- INFO PROCESSO -->
  <div class="card">
    <table class="info-tbl">
      <tr><td class="lbl">NÚMERO CNJ</td><td class="mono">${config.numeroCNJ}</td></tr>
      <tr><td class="lbl">TRIBUNAL</td><td>TJSP — Tribunal de Justiça de São Paulo</td></tr>
      ${metadata.vara ? `<tr><td class="lbl">VARA / UNIDADE</td><td>${metadata.vara.split("\n")[0].trim()}</td></tr>` : ""}
      ${metadata.classe ? `<tr><td class="lbl">CLASSE</td><td>${metadata.classe}</td></tr>` : ""}
      ${metadata.assunto ? `<tr><td class="lbl">ASSUNTO</td><td>${metadata.assunto}</td></tr>` : ""}
      ${metadata.dataDistribuicao ? `<tr><td class="lbl">DISTRIBUIÇÃO</td><td>${metadata.dataDistribuicao.split("\n")[0].trim()}</td></tr>` : ""}
      <tr><td class="lbl">DEFENSORA</td><td><strong>${config.defensora}</strong></td></tr>
      <tr><td class="lbl">DATA DA ANÁLISE</td><td>${dataFormatada}</td></tr>
    </table>
  </div>

</div><!-- /sec-visao -->

<!-- ══ SEÇÃO: RESUMO EXECUTIVO ══ -->
<div id="sec-resumo" class="sec">

  <div class="sh">
    <div class="sh-eye">ANÁLISE · CLAUDE SONNET</div>
    <div class="sh-title">Resumo Executivo</div>
    <div class="sh-body">Análise estratégica elaborada por IA para apoiar a equipe de defesa.</div>
  </div>

  <div class="card" style="margin-bottom:24px;">
    <div class="narrative" style="white-space:pre-wrap;">${radar.resumoExecutivo}</div>
  </div>

  ${radar.recomendacoesEstrategicas.length > 0 ? `
  <div class="sh" style="margin-top:32px;">
    <div class="sh-eye">PRIORIDADE</div>
    <div class="sh-title">Recomendações Estratégicas</div>
  </div>
  <div class="card">
    ${radar.recomendacoesEstrategicas.map((r, i) => findingCard(
      String(i + 1),
      i < 2 ? "fi-c" : i < 5 ? "fi-a" : "fi-m",
      `Recomendação ${i + 1}`,
      r,
    )).join("")}
  </div>` : ""}

</div><!-- /sec-resumo -->

<!-- ══ SEÇÃO: SUBSÍDIOS ══ -->
<div id="sec-subsidios" class="sec">

  <div class="sh">
    <div class="sh-eye">RADAR DE DEFESA · CLAUDE AI</div>
    <div class="sh-title">Subsídios para a Defesa</div>
    <div class="sh-body">${radar.subsidiosCriticos.length + radar.subsidiosAlta.length + radar.subsidiosMedia.length} subsídios identificados — ${radar.subsidiosCriticos.length} urgentes, ${radar.subsidiosAlta.length} alta prioridade, ${radar.subsidiosMedia.length} média prioridade.</div>
  </div>

  ${secaoSubsidios(radar.subsidiosCriticos, "Subsídios Urgentes", "fi-c", "U")}
  ${secaoSubsidios(radar.subsidiosAlta, "Subsídios Alta Prioridade", "fi-a", "A")}
  ${secaoSubsidios(radar.subsidiosMedia.slice(0, 10), "Subsídios Média Prioridade", "fi-m", "M")}

  ${radar.subsidiosCriticos.length + radar.subsidiosAlta.length + radar.subsidiosMedia.length === 0 ? `
  <div class="card" style="text-align:center;padding:40px;">
    <div style="font-size:32px;margin-bottom:12px;">🔍</div>
    <div class="sh-title">Nenhum subsídio identificado</div>
    <div class="sh-body">Execute novamente com ANTHROPIC_API_KEY configurada para habilitar o Radar de Defesa com Claude AI.</div>
  </div>` : ""}

</div><!-- /sec-subsidios -->

<!-- ══ SEÇÃO: CADEIA DE CUSTÓDIA ══ -->
<div id="sec-custodia" class="sec">

  <div class="sh">
    <div class="sh-eye">SHA-256 · LEI 11.419/2006</div>
    <div class="sh-title">Cadeia de Custódia Digital</div>
    <div class="sh-body">Verificação de integridade por hash criptográfico de cada documento processual.</div>
  </div>

  <div class="gauges">
    ${gauge("Score Integridade", custodia.scoreIntegridade, 100, corCustodia, custodia.integridadeGeral)}
    ${gauge("Sem Assinatura Digital", custodia.documentosSemAssinatura, Math.max(1, custodia.totalDocumentos), "var(--amber)", `${custodia.documentosSemAssinatura} de ${custodia.totalDocumentos} docs`)}
    ${gauge("Lacunas de Numeração", custodia.totalLacunas, Math.max(1, custodia.totalLacunas + 5), custodia.totalLacunas > 0 ? "var(--red)" : "var(--green)", custodia.totalLacunas === 0 ? "Nenhuma lacuna" : `${custodia.totalLacunas} lacuna(s) detectada(s)`)}
  </div>

  ${custodia.lacunas.length > 0 ? `
  <div class="card" style="border:1px solid rgba(248,113,113,.25);background:rgba(248,113,113,.04);margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span class="pill pill-risk">⚠ LACUNAS DETECTADAS</span>
    </div>
    ${custodia.lacunas.map((l) => `<div class="narrative">• Peças <strong>${l.de}</strong> a <strong>${l.ate}</strong> ausentes — ${l.quantidade} peça(s) faltante(s). Possível supressão de documentos (CPP art. 155).</div>`).join("")}
  </div>` : ""}

  ${custodia.achados.length > 0 ? `
  <div class="sh" style="margin-top:24px;">
    <div class="sh-eye">ACHADOS</div>
    <div class="sh-title">Anomalias Detectadas</div>
  </div>
  <div class="card">
    ${custodia.achados.map((a) => findingCard(
      a.tipo === "CRITICO" ? "!" : "⚠",
      a.tipo === "CRITICO" ? "fi-c" : "fi-a",
      a.descricao,
      a.fundamentoLegal,
    )).join("")}
  </div>` : ""}

  <!-- INVENTÁRIO -->
  <div class="sh" style="margin-top:28px;">
    <div class="sh-eye">INVENTÁRIO COMPLETO</div>
    <div class="sh-title">Documentos Analisados</div>
  </div>
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="action-tbl">
      <thead>
        <tr>
          <th width="50">#</th>
          <th>Descrição</th>
          <th width="110">Data Juntada</th>
          <th width="60">Págs.</th>
          <th width="70">Assin.</th>
          <th width="180">SHA-256</th>
          <th width="60">Status</th>
        </tr>
      </thead>
      <tbody>
        ${custodia.analises.slice(0, 200).map((a) => `
        <tr class="${a.anomalias.length > 0 ? "row-alerta" : "row-ok"}">
          <td style="color:var(--text3);font-family:Menlo,'Courier New',monospace;">${a.numero}</td>
          <td>${a.descricao.substring(0, 55)}${a.descricao.length > 55 ? "…" : ""}</td>
          <td style="color:var(--text3);">${a.dataJuntadaRegistrada || "—"}</td>
          <td style="color:var(--text3);">${a.paginasReais || "—"}</td>
          <td>${a.temAssinaturaDigital ? '<span class="pill pill-ok">✓</span>' : '<span class="pill pill-warn">✗</span>'}</td>
          <td style="font-family:Menlo,'Courier New',monospace;font-size:10px;color:var(--text3);">${a.sha256Original ? a.sha256Original.substring(0, 16) + "…" : "—"}</td>
          <td>${a.anomalias.length > 0 ? '<span class="pill pill-warn">⚠</span>' : '<span class="pill pill-ok">✓</span>'}</td>
        </tr>`).join("")}
        ${custodia.analises.length > 200 ? `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:12px;">… e mais ${custodia.analises.length - 200} documentos — ver inventario_documentos.csv</td></tr>` : ""}
      </tbody>
    </table>
  </div>

</div><!-- /sec-custodia -->

<!-- ══ SEÇÃO: CONFORMIDADE ══ -->
<div id="sec-conformidade" class="sec">

  <div class="sh">
    <div class="sh-eye">42 REGRAS · CPP / CF / CADH / PIDCP</div>
    <div class="sh-title">Análise de Conformidade Legal</div>
    <div class="sh-body">Verificação automática de ${conformidade.totalRegras} critérios jurídicos com fundamentação em STF/STJ.</div>
  </div>

  <div class="kpi-grid kpi-grid-3" style="margin-bottom:24px;">
    <div class="kpi-card green">
      <div class="kc-label">CONFORMES</div>
      <div class="kc-value green">${conformidade.conformes}</div>
      <div class="kc-sub">Sem infração detectada</div>
    </div>
    <div class="kpi-card red">
      <div class="kc-label">NULIDADES ABSOLUTAS</div>
      <div class="kc-value red">${conformidade.nulidadesAbsolutas}</div>
      <div class="kc-sub">Arguição obrigatória</div>
    </div>
    <div class="kpi-card amber">
      <div class="kc-label">NULIDADES RELATIVAS</div>
      <div class="kc-value amber">${conformidade.nulidadesRelativas}</div>
      <div class="kc-sub">${conformidade.irregularidades} irregularidades</div>
    </div>
  </div>

  <div class="card" style="padding:0;overflow:hidden;">
    <table class="action-tbl">
      <thead>
        <tr>
          <th width="90">Regra</th>
          <th>Título / Observação</th>
          <th width="150">Categoria</th>
          <th width="90">Status</th>
        </tr>
      </thead>
      <tbody>
        ${conformidade.regras.map((r) => `
        <tr class="${r.conformidade ? "row-ok" : r.gravidade === "CRITICA" ? "row-critico" : "row-alerta"}">
          <td style="font-family:Menlo,'Courier New',monospace;color:var(--text3);">${r.id}</td>
          <td>
            <div style="font-weight:600;color:var(--text);margin-bottom:2px;">${r.titulo}</div>
            <div style="color:var(--text3);font-size:10px;">${r.observacao.substring(0, 100)}${r.observacao.length > 100 ? "…" : ""}</div>
          </td>
          <td>${pillCategoria(r.categoria)}</td>
          <td>${r.conformidade ? '<span class="pill pill-ok">OK</span>' : pillGravidade(r.gravidade)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>

</div><!-- /sec-conformidade -->

<!-- ══ SEÇÃO: AUTENTICIDADE ══ -->
<div id="sec-autenticidade" class="sec">

  <div class="sh">
    <div class="sh-eye">INTEGRIDADE · SHA-256</div>
    <div class="sh-title">Autenticidade do Relatório</div>
    <div class="sh-body">Hashes criptográficos para verificação de integridade e não-repúdio do documento.</div>
  </div>

  <div class="card">
    <div class="sha-label">SHA-256 DESTE RELATÓRIO</div>
    <div class="sha-box"><strong>${sha256Relatorio}</strong></div>
    <div class="sha-label" style="margin-top:16px;">SHA-256 DA ANÁLISE DE CUSTÓDIA</div>
    <div class="sha-box"><strong>${custodia.sha256Relatorio}</strong></div>
    <div style="margin-top:16px;">
      <table class="info-tbl">
        <tr><td class="lbl">GERADO EM</td><td>${new Date(config.dataAnalise).toLocaleString("pt-BR")}</td></tr>
        <tr><td class="lbl">MOTOR</td><td>AuraTECH Due Diligence Engine v1.0</td></tr>
        <tr><td class="lbl">IA UTILIZADA</td><td>Claude Haiku 4.5 (análise docs) · Claude Sonnet 4.6 (resumo executivo)</td></tr>
        <tr><td class="lbl">ELABORADO PARA</td><td>${config.defensora}</td></tr>
        <tr><td class="lbl">SIGILO</td><td>Documento protegido — CF/88 art. 5º, XIV · EOAB art. 7º, II · CPP art. 20</td></tr>
      </table>
    </div>
  </div>

</div><!-- /sec-autenticidade -->

<!-- ── FOOTER ── -->
<footer class="site-footer">
  <div class="sf-row">
    <div class="sf-left">
      <div class="sf-logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
          <path d="M7 21h10"/><path d="M12 3v18"/>
          <path d="M3 7h2c2 0 4-1 6-2 2 1 4 2 6 2h2"/>
        </svg>
      </div>
      <span class="sf-logo-name">AuraDUE</span>
      <span class="sf-meta">© ${new Date().getFullYear()} AuraTECH · Documento confidencial · Uso exclusivo da defesa · ${config.numeroCNJ} · TJSP</span>
    </div>
    <div class="sf-sha">SHA: ${sha256Relatorio.substring(0, 16)}…</div>
  </div>
</footer>

</div><!-- /page -->

<script>
function show(id) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('sec-' + id).classList.add('on');
  event.target.classList.add('on');
}
</script>
</body>
</html>`;
}

// ── salvarRelatorioHTML ────────────────────────────────────────────────────

export function salvarRelatorioHTML(html: string, dirSaida: string, numeroCNJ: string): string {
  const slug = numeroCNJ.replace(/[^0-9]/g, "").substring(0, 10);
  const nomeArquivo = `due_diligence_${slug}_${new Date().toISOString().substring(0, 10)}.html`;
  const caminho = path.join(dirSaida, nomeArquivo);
  fs.writeFileSync(caminho, html, "utf-8");
  return caminho;
}

// ── gerarRelatorioPDF ─────────────────────────────────────────────────────

export async function gerarRelatorioPDF(
  config: RelatorioConfig,
  metadata: ProcessoMetadata,
  custodia: ResultadoCadeiaCustodia,
  conformidade: ResultadoConformidade,
  radar: ResultadoRadarDefesa,
  dirSaida: string,
): Promise<string> {
  const slug = config.numeroCNJ.replace(/[^0-9]/g, "").substring(0, 10);
  const nomeArquivo = `due_diligence_${slug}_${new Date().toISOString().substring(0, 10)}.pdf`;
  const caminho = path.join(dirSaida, nomeArquivo);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(caminho);
    doc.pipe(stream);

    const COR_PRIMARY = "#06b6d4";
    const COR_TEXTO = "#1e293b";
    const COR_MUTED = "#64748b";
    const COR_RED = "#ef4444";
    const COR_ORANGE = "#f97316";

    const linha = () => {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e2e8f0").stroke();
      doc.moveDown(0.5);
    };

    // CAPA
    doc.rect(0, 0, 595, 200).fill("#0f1623");
    doc.fillColor("#06b6d4").fontSize(22).font("Helvetica-Bold")
      .text("AuraDUE — Due Diligence Criminal", 50, 60);
    doc.fillColor("white").fontSize(16).text(metadata.classe || "Relatório de Análise Judicial", 50, 95);
    doc.fillColor("#94a3b8").fontSize(11)
      .text(`Processo: ${config.numeroCNJ}`, 50, 125)
      .text(`TJSP · Criminal · Segredo de Justiça`, 50, 142)
      .text(`Data: ${new Date(config.dataAnalise).toLocaleDateString("pt-BR")}`, 50, 159)
      .text(`Defensora: ${config.defensora}`, 50, 176);

    doc.fillColor(COR_TEXTO);
    doc.y = 220;

    // INDICADORES
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_PRIMARY).text("PAINEL DE INDICADORES", 50);
    doc.moveDown(0.5); linha();
    const kpis = [
      { label: "Integridade Custódia", valor: `${custodia.scoreIntegridade}/100`, status: custodia.integridadeGeral },
      { label: "Conformidade Legal", valor: `${conformidade.scoreConformidade}/100`, status: `${conformidade.nulidadesAbsolutas} nulidades abs.` },
      { label: "Subsídios Urgentes", valor: String(radar.subsidiosCriticos.length), status: "Ver seção 3" },
      { label: "Total de Peças", valor: String(metadata.totalPecas), status: `${custodia.totalLacunas} lacunas` },
    ];
    for (const kpi of kpis) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor(COR_TEXTO).text(`${kpi.label}: `, { continued: true })
        .font("Helvetica").fillColor(COR_MUTED).text(`${kpi.valor} (${kpi.status})`);
      doc.moveDown(0.3);
    }
    doc.moveDown(1);

    // RESUMO EXECUTIVO
    doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_PRIMARY).text("1. RESUMO EXECUTIVO", 50);
    doc.moveDown(0.5); linha();
    doc.fontSize(10).font("Helvetica").fillColor(COR_TEXTO).text(radar.resumoExecutivo, { align: "justify" });
    doc.moveDown(1);

    // RECOMENDAÇÕES
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_PRIMARY).text("2. RECOMENDAÇÕES ESTRATÉGICAS", 50);
    doc.moveDown(0.5); linha();
    for (const rec of radar.recomendacoesEstrategicas.slice(0, 10)) {
      doc.fontSize(10).font("Helvetica").fillColor(COR_TEXTO).text(`• ${rec}`, { indent: 10, align: "justify" });
      doc.moveDown(0.4);
    }
    doc.moveDown(1);

    // SUBSÍDIOS URGENTES
    if (radar.subsidiosCriticos.length > 0) {
      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_RED).text("3. SUBSÍDIOS URGENTES", 50);
      doc.moveDown(0.5); linha();
      for (const s of radar.subsidiosCriticos.slice(0, 10)) {
        if (doc.y > 680) doc.addPage();
        doc.fontSize(11).font("Helvetica-Bold").fillColor(COR_TEXTO).text(s.titulo);
        doc.fontSize(10).font("Helvetica").fillColor(COR_MUTED).text(s.categoria.replace(/_/g, " "));
        doc.fontSize(10).fillColor(COR_TEXTO).text(s.descricao, { align: "justify" });
        doc.fontSize(9).fillColor(COR_PRIMARY).text(`Fundamento: ${s.fundamentoLegal.join("; ")}`);
        if (s.jurisprudencia.length > 0) doc.fillColor(COR_MUTED).text(`Jurisprudência: ${s.jurisprudencia[0]}`);
        doc.fontSize(10).font("Helvetica-Bold").fillColor(COR_ORANGE).text(`Estratégia: `, { continued: true })
          .font("Helvetica").fillColor(COR_TEXTO).text(s.estrategia, { align: "justify" });
        doc.moveDown(0.8);
      }
    }

    // CONFORMIDADE
    doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_PRIMARY).text("4. CONFORMIDADE — 42 REGRAS CPP/CF", 50);
    doc.moveDown(0.5); linha();
    doc.fontSize(10).font("Helvetica").fillColor(COR_MUTED)
      .text(`Total: ${conformidade.totalRegras} | Conformes: ${conformidade.conformes} | Nulidades Abs.: ${conformidade.nulidadesAbsolutas} | Nulidades Rel.: ${conformidade.nulidadesRelativas}`);
    doc.moveDown(0.5);
    for (const regra of conformidade.regras.filter((r) => !r.conformidade)) {
      if (doc.y > 700) doc.addPage();
      doc.fontSize(10).font("Helvetica-Bold").fillColor(regra.gravidade === "CRITICA" ? COR_RED : COR_ORANGE).text(`[${regra.id}] ${regra.titulo}`);
      doc.fontSize(9).font("Helvetica").fillColor(COR_TEXTO).text(regra.observacao, { align: "justify" });
      doc.fontSize(9).fillColor(COR_MUTED).text(`Fundamento: ${regra.fundamentoLegal}`);
      doc.moveDown(0.5);
    }

    // CUSTÓDIA
    doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_PRIMARY).text("5. CADEIA DE CUSTÓDIA — SHA-256", 50);
    doc.moveDown(0.5); linha();
    const sha256R = createHash("sha256").update(JSON.stringify({ n: config.numeroCNJ, d: config.dataAnalise })).digest("hex");
    doc.fontSize(10).font("Helvetica").fillColor(COR_MUTED)
      .text(`SHA-256 relatório: ${sha256R}`)
      .text(`SHA-256 custódia: ${custodia.sha256Relatorio}`);
    doc.moveDown(0.5);
    for (const analise of custodia.analises.slice(0, 50)) {
      if (doc.y > 720) doc.addPage();
      const st = analise.anomalias.length > 0 ? "⚠" : "✓";
      doc.fontSize(9).font("Helvetica").fillColor(analise.anomalias.length > 0 ? COR_ORANGE : COR_MUTED)
        .text(`${st} #${analise.numero} | ${analise.descricao.substring(0, 50)} | ${analise.paginasReais}p | ${analise.sha256Original.substring(0, 16)}…`);
    }
    if (custodia.analises.length > 50) {
      doc.moveDown(0.5).fillColor(COR_MUTED).text(`… e mais ${custodia.analises.length - 50} docs. Ver inventario_documentos.csv.`);
    }

    // RODAPÉ EM TODAS AS PÁGINAS
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor(COR_MUTED)
        .text(`AuraDUE | ${config.numeroCNJ} | Confidencial — Uso exclusivo da defesa | Pág. ${i + 1}/${range.count}`,
          50, 780, { align: "center", width: 495 });
    }

    doc.end();
    stream.on("finish", () => resolve(caminho));
    stream.on("error", reject);
  });
}
