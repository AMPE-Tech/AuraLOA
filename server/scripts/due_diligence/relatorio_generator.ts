/**
 * relatorio_generator.ts
 * Geração do relatório final de due diligence — HTML dark + PDF formal.
 * Usa o design system AuraTECH (tokens aprovados em 30/03/2026).
 * Saída: relatório completo para a Dra. Márcia Mirtes (defensora).
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
  cliente: string; // nome do réu (pode ser anonimizado)
  defensora: string;
  dataAnalise: string;
  dirSaida: string;
}

function corGravidade(gravidade: string): string {
  const mapa: Record<string, string> = {
    CRITICA: "#ef4444",
    URGENTE: "#ef4444",
    ALTA: "#f97316",
    ALTA2: "#f97316",
    MEDIA: "#eab308",
    BAIXA: "#22c55e",
  };
  return mapa[gravidade] || "#94a3b8";
}

function badgeCategoria(cat: string): string {
  const mapa: Record<string, string> = {
    NULIDADE_ABSOLUTA: { bg: "#7f1d1d", text: "#fca5a5", label: "Nulidade Absoluta" } as any,
    NULIDADE_RELATIVA: { bg: "#7c2d12", text: "#fdba74", label: "Nulidade Relativa" } as any,
    PROVA_ILICITA: { bg: "#581c87", text: "#d8b4fe", label: "Prova Ilícita" } as any,
    CERCEAMENTO_DEFESA: { bg: "#1e3a5f", text: "#93c5fd", label: "Cerceamento de Defesa" } as any,
    INCONSTITUCIONALIDADE: { bg: "#4c1d95", text: "#c4b5fd", label: "Inconstitucionalidade" } as any,
    PRESCRICAO: { bg: "#064e3b", text: "#6ee7b7", label: "Prescrição" } as any,
    ARGUMENTOS_MERITO: { bg: "#1e3a8a", text: "#93c5fd", label: "Mérito" } as any,
    MITIGACAO_PENA: { bg: "#14532d", text: "#86efac", label: "Mitigação de Pena" } as any,
  };
  const info = mapa[cat] as any;
  if (!info) return `<span class="badge">${cat}</span>`;
  return `<span style="background:${info.bg};color:${info.text};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${info.label}</span>`;
}

function secaoSubsidios(subsidios: ResultadoRadarDefesa["subsidiosCriticos"], titulo: string, cor: string): string {
  if (subsidios.length === 0) return "";
  return `
    <div class="section">
      <h2 style="color:${cor};border-bottom:2px solid ${cor};padding-bottom:8px;">${titulo} (${subsidios.length})</h2>
      ${subsidios.map((s, i) => `
        <div class="card" style="border-left:4px solid ${cor};margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="color:${cor};font-weight:700;font-size:15px;">${i + 1}. ${s.titulo}</span>
            ${badgeCategoria(s.categoria)}
          </div>
          <p style="color:#cbd5e1;margin-bottom:8px;">${s.descricao}</p>
          <div style="background:#0d1117;border-radius:6px;padding:12px;margin-bottom:8px;">
            <div style="color:#64748b;font-size:12px;margin-bottom:4px;">FUNDAMENTO LEGAL</div>
            ${s.fundamentoLegal.map((f) => `<div style="color:#22d3ee;font-size:13px;">• ${f}</div>`).join("")}
          </div>
          ${s.jurisprudencia.length > 0 ? `
          <div style="background:#0d1117;border-radius:6px;padding:12px;margin-bottom:8px;">
            <div style="color:#64748b;font-size:12px;margin-bottom:4px;">JURISPRUDÊNCIA</div>
            ${s.jurisprudencia.map((j) => `<div style="color:#a5b4fc;font-size:12px;margin-bottom:4px;">• ${j}</div>`).join("")}
          </div>` : ""}
          <div style="background:#162032;border-radius:6px;padding:12px;">
            <div style="color:#64748b;font-size:12px;margin-bottom:4px;">ESTRATÉGIA DEFENSIVA</div>
            <div style="color:#e2e8f0;font-size:13px;">${s.estrategia}</div>
          </div>
        </div>
      `).join("")}
    </div>`;
}

export function gerarRelatorioHTML(
  config: RelatorioConfig,
  metadata: ProcessoMetadata,
  checkpoint: CheckpointData,
  custodia: ResultadoCadeiaCustodia,
  conformidade: ResultadoConformidade,
  radar: ResultadoRadarDefesa,
): string {
  const dataFormatada = new Date(config.dataAnalise).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const sha256Relatorio = createHash("sha256")
    .update(JSON.stringify({ numeroCNJ: config.numeroCNJ, dataAnalise: config.dataAnalise, sha256Custodia: custodia.sha256Relatorio }))
    .digest("hex");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Due Diligence Criminal — ${config.numeroCNJ}</title>
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --card: #1c2333;
      --border: rgba(255,255,255,0.07);
      --primary: #06b6d4;
      --secondary: #7c3aed;
      --text: #e2e8f0;
      --muted: #64748b;
      --red: #ef4444;
      --orange: #f97316;
      --yellow: #eab308;
      --green: #22c55e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
    .header { background: linear-gradient(135deg, #0d1117 0%, #161b22 100%); border-bottom: 1px solid var(--border); padding: 32px 0; margin-bottom: 32px; }
    .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .logo-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #06b6d4, #7c3aed); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .logo-text { font-size: 22px; font-weight: 700; background: linear-gradient(135deg, #06b6d4, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h1 { font-size: 26px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
    h2 { font-size: 18px; font-weight: 600; color: var(--primary); margin-bottom: 16px; }
    h3 { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
    .badge-processo { background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.3); color: #06b6d4; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; display: inline-block; }
    .section { margin-bottom: 40px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 16px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; text-align: center; }
    .kpi-valor { font-size: 28px; font-weight: 700; }
    .kpi-label { font-size: 12px; color: var(--muted); margin-top: 4px; }
    .tag-critico { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .tag-alerta { background: rgba(249,115,22,0.15); color: #f97316; border: 1px solid rgba(249,115,22,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .tag-ok { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table th { background: rgba(255,255,255,0.05); color: var(--muted); font-weight: 600; padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }
    .table td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: top; }
    .table tr:hover td { background: rgba(255,255,255,0.02); }
    .regra-ok { border-left: 3px solid #22c55e; }
    .regra-nao { border-left: 3px solid #ef4444; }
    .recomendacoes ol { padding-left: 20px; }
    .recomendacoes li { margin-bottom: 12px; color: var(--text); }
    .resumo-executivo { background: linear-gradient(135deg, rgba(6,182,212,0.05), rgba(124,58,237,0.05)); border: 1px solid rgba(6,182,212,0.2); border-radius: 10px; padding: 24px; white-space: pre-wrap; line-height: 1.8; }
    .hash-box { background: #0d1117; border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; color: var(--muted); word-break: break-all; }
    .footer { border-top: 1px solid var(--border); margin-top: 48px; padding-top: 24px; text-align: center; color: var(--muted); font-size: 12px; }
    @media print { body { background: white; color: black; } .card { border: 1px solid #ddd; } }
  </style>
</head>
<body>
<div class="header">
  <div class="container">
    <div class="logo">
      <div class="logo-icon">⚖️</div>
      <span class="logo-text">AuraTECH — Due Diligence Criminal</span>
    </div>
    <h1>Relatório de Due Diligence Judicial</h1>
    <div style="display:flex;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap;">
      <span class="badge-processo">${config.numeroCNJ}</span>
      <span style="color:var(--muted)">TJSP • Processo Criminal • Segredo de Justiça</span>
      <span style="color:var(--muted)">${dataFormatada}</span>
    </div>
    <div style="margin-top:12px;color:var(--muted);font-size:13px;">
      Elaborado para: <strong style="color:var(--text)">${config.defensora}</strong> &nbsp;|&nbsp;
      Documento confidencial — uso exclusivo da defesa
    </div>
  </div>
</div>

<div class="container">

  <!-- SEÇÃO 1: RESUMO EXECUTIVO -->
  <div class="section">
    <h2>1. Resumo Executivo</h2>
    <div class="resumo-executivo">${radar.resumoExecutivo}</div>
  </div>

  <!-- SEÇÃO 2: INDICADORES GERAIS -->
  <div class="section">
    <h2>2. Painel de Indicadores</h2>
    <div class="grid-3">
      <div class="kpi">
        <div class="kpi-valor" style="color:${custodia.integridadeGeral === "PRESERVADA" ? "#22c55e" : custodia.integridadeGeral === "PARCIAL" ? "#eab308" : "#ef4444"}">${custodia.scoreIntegridade}/100</div>
        <div class="kpi-label">Integridade da Cadeia de Custódia</div>
        <div style="margin-top:6px;" class="${custodia.integridadeGeral === "PRESERVADA" ? "tag-ok" : custodia.integridadeGeral === "PARCIAL" ? "tag-alerta" : "tag-critico"}">${custodia.integridadeGeral}</div>
      </div>
      <div class="kpi">
        <div class="kpi-valor" style="color:${conformidade.scoreConformidade >= 80 ? "#22c55e" : conformidade.scoreConformidade >= 50 ? "#eab308" : "#ef4444"}">${conformidade.scoreConformidade}/100</div>
        <div class="kpi-label">Score de Conformidade Legal</div>
        <div style="margin-top:6px;" class="${conformidade.nulidadesAbsolutas > 0 ? "tag-critico" : conformidade.nulidadesRelativas > 0 ? "tag-alerta" : "tag-ok"}">${conformidade.nulidadesAbsolutas} nulidades abs.</div>
      </div>
      <div class="kpi">
        <div class="kpi-valor" style="color:#ef4444">${radar.subsidiosCriticos.length + radar.subsidiosAlta.length}</div>
        <div class="kpi-label">Subsídios Prioritários Identificados</div>
        <div style="margin-top:6px;" class="tag-critico">${radar.subsidiosCriticos.length} urgentes</div>
      </div>
    </div>
    <div class="grid-3">
      <div class="kpi">
        <div class="kpi-valor" style="color:#06b6d4">${checkpoint.totalPecas}</div>
        <div class="kpi-label">Total de Peças Processuais</div>
      </div>
      <div class="kpi">
        <div class="kpi-valor" style="color:${custodia.totalLacunas > 0 ? "#ef4444" : "#22c55e"}">${custodia.totalLacunas}</div>
        <div class="kpi-label">Lacunas na Numeração</div>
        ${custodia.totalLacunas > 0 ? '<div class="tag-critico" style="margin-top:6px;">ATENÇÃO</div>' : '<div class="tag-ok" style="margin-top:6px;">OK</div>'}
      </div>
      <div class="kpi">
        <div class="kpi-valor" style="color:#7c3aed">${radar.totalDocumentosAnalisados}</div>
        <div class="kpi-label">Documentos com Análise IA</div>
      </div>
    </div>
  </div>

  <!-- SEÇÃO 3: RECOMENDAÇÕES ESTRATÉGICAS -->
  <div class="section recomendacoes">
    <h2>3. Recomendações Estratégicas</h2>
    <div class="card">
      <ol>
        ${radar.recomendacoesEstrategicas.map((r) => `<li>${r}</li>`).join("")}
      </ol>
    </div>
  </div>

  <!-- SEÇÃO 4: SUBSÍDIOS URGENTES -->
  ${secaoSubsidios(radar.subsidiosCriticos, "4. Subsídios URGENTES — Ação Imediata", "#ef4444")}

  <!-- SEÇÃO 5: SUBSÍDIOS ALTA PRIORIDADE -->
  ${secaoSubsidios(radar.subsidiosAlta, "5. Subsídios Alta Prioridade", "#f97316")}

  <!-- SEÇÃO 6: CADEIA DE CUSTÓDIA -->
  <div class="section">
    <h2>6. Análise da Cadeia de Custódia</h2>
    <div class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div>
          <div style="color:var(--muted);font-size:12px;">INTEGRIDADE GERAL</div>
          <div style="font-size:18px;font-weight:700;color:${custodia.integridadeGeral === "PRESERVADA" ? "#22c55e" : "#ef4444"}">${custodia.integridadeGeral}</div>
        </div>
        <div>
          <div style="color:var(--muted);font-size:12px;">DOCUMENTOS SEM ASSINATURA DIGITAL</div>
          <div style="font-size:18px;font-weight:700;color:${custodia.documentosSemAssinatura > 0 ? "#f97316" : "#22c55e"}">${custodia.documentosSemAssinatura}</div>
        </div>
      </div>

      ${custodia.lacunas.length > 0 ? `
      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:12px;margin-bottom:12px;">
        <strong style="color:#ef4444;">⚠️ LACUNAS DETECTADAS NA NUMERAÇÃO</strong>
        <div style="margin-top:8px;">
          ${custodia.lacunas.map((l) => `<div style="color:#fca5a5;font-size:13px;">• Peças ${l.de} a ${l.ate} ausentes (${l.quantidade} peças)</div>`).join("")}
        </div>
      </div>` : ""}

      ${custodia.achados.length > 0 ? `
      <h3>Achados de Custódia</h3>
      ${custodia.achados.map((a) => `
        <div class="card" style="border-left:4px solid ${a.tipo === "CRITICO" ? "#ef4444" : a.tipo === "ALERTA" ? "#f97316" : "#06b6d4"};margin-bottom:8px;">
          <div class="${a.tipo === "CRITICO" ? "tag-critico" : "tag-alerta"}" style="margin-bottom:8px;">${a.tipo}</div>
          <div style="margin-bottom:6px;">${a.descricao}</div>
          <div style="color:#64748b;font-size:12px;">${a.fundamentoLegal}</div>
        </div>
      `).join("")}` : ""}
    </div>
  </div>

  <!-- SEÇÃO 7: CONFORMIDADE LEGAL — 42 REGRAS -->
  <div class="section">
    <h2>7. Conformidade Legal — ${conformidade.totalRegras} Regras CPP/CF</h2>
    <div style="margin-bottom:16px;color:var(--muted);">
      ✅ ${conformidade.conformes} conformes &nbsp;|&nbsp;
      ⚠️ ${conformidade.nulidadesRelativas} nulidades relativas &nbsp;|&nbsp;
      🚨 ${conformidade.nulidadesAbsolutas} nulidades absolutas &nbsp;|&nbsp;
      ❌ ${conformidade.irregularidades} irregularidades
    </div>
    <table class="table">
      <thead>
        <tr>
          <th width="80">Regra</th>
          <th>Título</th>
          <th width="130">Categoria</th>
          <th width="80">Status</th>
        </tr>
      </thead>
      <tbody>
        ${conformidade.regras.map((r) => `
          <tr class="${r.conformidade ? "regra-ok" : "regra-nao"}">
            <td style="font-family:monospace;color:#64748b;">${r.id}</td>
            <td>
              <div style="font-weight:500;margin-bottom:2px;">${r.titulo}</div>
              <div style="color:#64748b;font-size:12px;">${r.observacao.substring(0, 120)}${r.observacao.length > 120 ? "..." : ""}</div>
            </td>
            <td><span style="font-size:11px;color:#94a3b8;">${r.categoria.replace(/_/g, " ")}</span></td>
            <td>${r.conformidade ? '<span class="tag-ok">OK</span>' : `<span class="${r.gravidade === "CRITICA" ? "tag-critico" : "tag-alerta"}">${r.gravidade}</span>`}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>

  <!-- SEÇÃO 8: INVENTÁRIO DE DOCUMENTOS -->
  <div class="section">
    <h2>8. Inventário de Documentos — Cadeia de Custódia SHA-256</h2>
    <table class="table">
      <thead>
        <tr>
          <th width="60">#</th>
          <th>Descrição</th>
          <th width="100">Data Juntada</th>
          <th width="60">Págs.</th>
          <th width="80">Assin.</th>
          <th width="200">SHA-256 (16 chars)</th>
          <th width="60">Status</th>
        </tr>
      </thead>
      <tbody>
        ${custodia.analises.slice(0, 200).map((a) => `
          <tr>
            <td style="color:#64748b;">${a.numero}</td>
            <td style="font-size:12px;">${a.descricao.substring(0, 60)}</td>
            <td style="font-size:12px;color:#64748b;">${a.dataJuntadaRegistrada || "—"}</td>
            <td>${a.paginasReais || "—"}</td>
            <td>${a.temAssinaturaDigital ? '<span class="tag-ok">✓</span>' : '<span class="tag-alerta">✗</span>'}</td>
            <td style="font-family:monospace;font-size:11px;color:#64748b;">${a.sha256Original ? a.sha256Original.substring(0, 16) + "..." : "—"}</td>
            <td>${a.anomalias.length > 0 ? '<span class="tag-alerta">⚠</span>' : '<span class="tag-ok">✓</span>'}</td>
          </tr>
        `).join("")}
        ${custodia.analises.length > 200 ? `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:12px;">... e mais ${custodia.analises.length - 200} documentos — ver inventario_documentos.csv</td></tr>` : ""}
      </tbody>
    </table>
  </div>

  <!-- SEÇÃO 9: SUBSÍDIOS MÉDIA PRIORIDADE -->
  ${radar.subsidiosMedia.length > 0 ? secaoSubsidios(radar.subsidiosMedia.slice(0, 10), "9. Subsídios Média Prioridade", "#eab308") : ""}

  <!-- RODAPÉ / AUTENTICIDADE -->
  <div class="section">
    <h2>10. Autenticidade e Cadeia de Custódia do Relatório</h2>
    <div class="card">
      <div style="margin-bottom:12px;">
        <div style="color:#64748b;font-size:12px;margin-bottom:4px;">SHA-256 DESTE RELATÓRIO</div>
        <div class="hash-box">${sha256Relatorio}</div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="color:#64748b;font-size:12px;margin-bottom:4px;">SHA-256 DA ANÁLISE DE CUSTÓDIA</div>
        <div class="hash-box">${custodia.sha256Relatorio}</div>
      </div>
      <div style="color:#64748b;font-size:12px;">
        Relatório gerado em ${new Date(config.dataAnalise).toLocaleString("pt-BR")} por AuraTECH Due Diligence Engine v1.0<br>
        Para verificação de integridade, recalcule o SHA-256 deste arquivo e compare com o hash acima.
      </div>
    </div>
  </div>

</div>

<div class="footer">
  <div class="container">
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
      <span style="background:#06b6d4;color:white;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:700;">AuraTECH</span>
      <span>Due Diligence Engine — Confidencial — Uso exclusivo da defesa — Processo ${config.numeroCNJ}</span>
    </div>
    <div>© ${new Date().getFullYear()} AuraTECH. Documento protegido por sigilo profissional (CF/88 art. 5º, XIV; EOAB art. 7º, II).</div>
  </div>
</div>
</body>
</html>`;

  return html;
}

export function salvarRelatorioHTML(html: string, dirSaida: string, numeroCNJ: string): string {
  const slug = numeroCNJ.replace(/[^0-9]/g, "").substring(0, 10);
  const nomeArquivo = `due_diligence_${slug}_${new Date().toISOString().substring(0, 10)}.html`;
  const caminho = path.join(dirSaida, nomeArquivo);
  fs.writeFileSync(caminho, html, "utf-8");
  return caminho;
}

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

    // Função helper para linha divisória
    const linha = () => {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e2e8f0").stroke();
      doc.moveDown(0.5);
    };

    // ─── CAPA ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 200).fill("#0d1117");
    doc
      .fillColor("#06b6d4")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("AuraTECH — Due Diligence Criminal", 50, 60);
    doc
      .fillColor("white")
      .fontSize(16)
      .text("Relatório de Análise Judicial", 50, 95);
    doc
      .fillColor("#94a3b8")
      .fontSize(11)
      .text(`Processo: ${config.numeroCNJ}`, 50, 125)
      .text(`TJSP • Criminal • Segredo de Justiça`, 50, 142)
      .text(`Data: ${new Date(config.dataAnalise).toLocaleDateString("pt-BR")}`, 50, 159)
      .text(`Para: ${config.defensora}`, 50, 176);

    doc.fillColor(COR_TEXTO);
    doc.y = 220;

    // ─── INDICADORES ─────────────────────────────────────────────────────────
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_PRIMARY).text("PAINEL DE INDICADORES", 50);
    doc.moveDown(0.5);
    linha();

    const kpis = [
      { label: "Integridade Custódia", valor: `${custodia.scoreIntegridade}/100`, status: custodia.integridadeGeral },
      { label: "Conformidade Legal", valor: `${conformidade.scoreConformidade}/100`, status: `${conformidade.nulidadesAbsolutas} nulidades abs.` },
      { label: "Subsídios Urgentes", valor: String(radar.subsidiosCriticos.length), status: "Ver seção 3" },
      { label: "Total de Peças", valor: String(metadata.totalPecas), status: `${custodia.totalLacunas} lacunas` },
    ];

    for (const kpi of kpis) {
      doc
        .font("Helvetica-Bold").fontSize(11).fillColor(COR_TEXTO).text(`${kpi.label}: `, { continued: true })
        .font("Helvetica").fillColor(COR_MUTED).text(`${kpi.valor} (${kpi.status})`);
      doc.moveDown(0.3);
    }
    doc.moveDown(1);

    // ─── RESUMO EXECUTIVO ─────────────────────────────────────────────────────
    doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_PRIMARY).text("1. RESUMO EXECUTIVO", 50);
    doc.moveDown(0.5);
    linha();
    doc.fontSize(10).font("Helvetica").fillColor(COR_TEXTO).text(radar.resumoExecutivo, { align: "justify" });
    doc.moveDown(1);

    // ─── RECOMENDAÇÕES ────────────────────────────────────────────────────────
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_PRIMARY).text("2. RECOMENDAÇÕES ESTRATÉGICAS", 50);
    doc.moveDown(0.5);
    linha();
    for (const rec of radar.recomendacoesEstrategicas.slice(0, 10)) {
      doc.fontSize(10).font("Helvetica").fillColor(COR_TEXTO).text(`• ${rec}`, { indent: 10, align: "justify" });
      doc.moveDown(0.4);
    }
    doc.moveDown(1);

    // ─── SUBSÍDIOS URGENTES ───────────────────────────────────────────────────
    if (radar.subsidiosCriticos.length > 0) {
      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_RED).text("3. SUBSÍDIOS URGENTES", 50);
      doc.moveDown(0.5);
      linha();
      for (const s of radar.subsidiosCriticos.slice(0, 10)) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor(COR_TEXTO).text(s.titulo);
        doc.fontSize(10).font("Helvetica").fillColor(COR_MUTED).text(s.categoria.replace(/_/g, " "));
        doc.fontSize(10).font("Helvetica").fillColor(COR_TEXTO).text(s.descricao, { align: "justify" });
        doc.fontSize(9).font("Helvetica").fillColor(COR_PRIMARY).text(`Fundamento: ${s.fundamentoLegal.join("; ")}`);
        if (s.jurisprudencia.length > 0) {
          doc.fillColor(COR_MUTED).text(`Jurisprudência: ${s.jurisprudencia[0]}`);
        }
        doc.fontSize(10).font("Helvetica-Bold").fillColor(COR_ORANGE).text(`Estratégia: `, { continued: true })
          .font("Helvetica").fillColor(COR_TEXTO).text(s.estrategia, { align: "justify" });
        doc.moveDown(0.8);
        if (doc.y > 700) doc.addPage();
      }
    }

    // ─── CONFORMIDADE LEGAL ───────────────────────────────────────────────────
    doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_PRIMARY).text("4. CONFORMIDADE LEGAL — 42 REGRAS CPP/CF", 50);
    doc.moveDown(0.5);
    linha();
    doc.fontSize(10).font("Helvetica").fillColor(COR_MUTED)
      .text(`Total: ${conformidade.totalRegras} | Conformes: ${conformidade.conformes} | Nulidades Abs.: ${conformidade.nulidadesAbsolutas} | Nulidades Rel.: ${conformidade.nulidadesRelativas}`);
    doc.moveDown(0.5);

    for (const regra of conformidade.regras.filter((r) => !r.conformidade)) {
      if (doc.y > 700) doc.addPage();
      doc.fontSize(10).font("Helvetica-Bold")
        .fillColor(regra.gravidade === "CRITICA" ? COR_RED : COR_ORANGE)
        .text(`[${regra.id}] ${regra.titulo}`);
      doc.fontSize(9).font("Helvetica").fillColor(COR_TEXTO).text(regra.observacao, { align: "justify" });
      doc.fontSize(9).fillColor(COR_MUTED).text(`Fundamento: ${regra.fundamentoLegal}`);
      doc.moveDown(0.5);
    }

    // ─── CADEIA DE CUSTÓDIA ───────────────────────────────────────────────────
    doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").fillColor(COR_PRIMARY).text("5. CADEIA DE CUSTÓDIA — SHA-256", 50);
    doc.moveDown(0.5);
    linha();
    doc.fontSize(10).font("Helvetica").fillColor(COR_MUTED)
      .text(`SHA-256 deste relatório: ${createHash("sha256").update(JSON.stringify({ n: config.numeroCNJ, d: config.dataAnalise })).digest("hex")}`);
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(COR_MUTED).text(`SHA-256 análise custódia: ${custodia.sha256Relatorio}`);
    doc.moveDown(0.5);

    for (const analise of custodia.analises.slice(0, 50)) {
      if (doc.y > 720) doc.addPage();
      const status = analise.anomalias.length > 0 ? "⚠" : "✓";
      doc.fontSize(9).font("Helvetica").fillColor(analise.anomalias.length > 0 ? COR_ORANGE : COR_MUTED)
        .text(`${status} #${analise.numero} | ${analise.descricao.substring(0, 50)} | ${analise.paginasReais}p | ${analise.sha256Original.substring(0, 16)}...`);
    }
    if (custodia.analises.length > 50) {
      doc.moveDown(0.5).fillColor(COR_MUTED).text(`... e mais ${custodia.analises.length - 50} documentos. Ver inventario_documentos.csv para listagem completa.`);
    }

    // ─── RODAPÉ ───────────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor(COR_MUTED)
        .text(
          `AuraTECH Due Diligence | ${config.numeroCNJ} | Confidencial — Uso exclusivo da defesa | Pág. ${i + 1}/${range.count}`,
          50, 780, { align: "center", width: 495 },
        );
    }

    doc.end();
    stream.on("finish", () => resolve(caminho));
    stream.on("error", reject);
  });
}
