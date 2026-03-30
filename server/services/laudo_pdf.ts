import PDFDocument from "pdfkit";
import type { EstoqueResult } from "../../shared/loa_types";

const COR_PRIMARIA = "#1a3a5c";
const COR_SECUNDARIA = "#2e6da4";
const COR_DESTAQUE = "#e8f0fa";
const COR_TEXTO = "#1a1a1a";
const COR_CINZA = "#666666";
const COR_LINHA = "#cccccc";
const COR_VERDE = "#1a7a3c";
const COR_LARANJA = "#b35a00";
const COR_VERMELHO = "#9b1c1c";

function fmtBRL(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function statusColor(status: string): string {
  if (status === "OK") return COR_VERDE;
  if (status === "PARCIAL") return COR_LARANJA;
  return COR_VERMELHO;
}

export function gerarLaudoPDF(resultado: EstoqueResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 60, bottom: 60, left: 50, right: 50 },
    bufferPages: true,
    info: {
      Title: `Laudo Técnico — Estoque de Precatórios ${resultado.ano_exercicio}`,
      Author: "AuraLOA — Sistema de Análise de Precatórios",
      Subject: `Estoque de Precatórios e RPVs — Exercício ${resultado.ano_exercicio}`,
      Creator: "AuraLOA",
    },
  });

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);

  const pageW = doc.page.width - 100;

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  doc.rect(50, 40, pageW, 70).fill(COR_PRIMARIA);

  doc.fillColor("#ffffff").fontSize(20).font("Helvetica-Bold")
    .text("AURALOA", 65, 55, { width: pageW - 20 });

  doc.fontSize(9).font("Helvetica")
    .text("Sistema de Análise de Precatórios e Orçamento Público", 65, 78);

  doc.fontSize(8).font("Helvetica")
    .text(`Gerado em: ${fmtDate(resultado.generated_at_iso)}`, 65, 93, { align: "right", width: pageW - 20 });

  doc.moveDown(4);

  // ── Título do Laudo ─────────────────────────────────────────────────────────
  doc.fillColor(COR_PRIMARIA).fontSize(16).font("Helvetica-Bold")
    .text("LAUDO TÉCNICO", { align: "center" });

  doc.fontSize(13).font("Helvetica")
    .text(`Estoque de Precatórios e RPVs — Exercício ${resultado.ano_exercicio}`, { align: "center" });

  doc.moveDown(0.5);

  // Linha separadora
  doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor(COR_SECUNDARIA).lineWidth(2).stroke();
  doc.moveDown(0.8);

  // ── Identificação do Documento ─────────────────────────────────────────────
  secaoTitulo(doc, pageW, "1. IDENTIFICAÇÃO DO DOCUMENTO");

  const camposId = [
    ["ID do Processo", resultado.process_id_uuid],
    ["Exercício", String(resultado.ano_exercicio)],
    ["Status Geral", resultado.status_geral],
    ["Gerado em", fmtDate(resultado.generated_at_iso)],
    ["Versão do Schema", resultado.schema_version],
    ["Provider(s)", resultado.providers_used.join(", ")],
  ];

  for (const [label, valor] of camposId) {
    const y = doc.y;
    doc.fillColor(COR_CINZA).fontSize(9).font("Helvetica-Bold")
      .text(label + ":", 50, y, { width: 130, continued: false });
    const cor = label === "Status Geral" ? statusColor(valor) : COR_TEXTO;
    doc.fillColor(cor).fontSize(9).font("Helvetica")
      .text(valor, 185, y, { width: pageW - 135 });
    doc.moveDown(0.3);
  }

  doc.moveDown(0.5);

  // ── Resumo Geral ────────────────────────────────────────────────────────────
  secaoTitulo(doc, pageW, "2. RESUMO GERAL");

  const totais = [
    { label: "Total de Processos", valor: resultado.summary.total_processos.toLocaleString("pt-BR") },
    { label: "Precatórios", valor: resultado.summary.total_precatorios.toLocaleString("pt-BR") },
    { label: "RPVs", valor: resultado.summary.total_rpvs.toLocaleString("pt-BR") },
    { label: "Tribunais Consultados", valor: resultado.tribunais_consultados.length.toLocaleString("pt-BR") },
  ];

  const cardW = (pageW - 15) / 4;
  const cardX = 50;
  const cardY = doc.y;

  totais.forEach((item, i) => {
    const x = cardX + i * (cardW + 5);
    doc.rect(x, cardY, cardW, 52).fill(COR_DESTAQUE);
    doc.rect(x, cardY, cardW, 4).fill(COR_SECUNDARIA);
    doc.fillColor(COR_SECUNDARIA).fontSize(18).font("Helvetica-Bold")
      .text(item.valor, x, cardY + 12, { width: cardW, align: "center" });
    doc.fillColor(COR_CINZA).fontSize(7.5).font("Helvetica")
      .text(item.label, x, cardY + 36, { width: cardW, align: "center" });
  });

  doc.y = cardY + 62;
  doc.moveDown(0.5);

  // ── Por Tribunal ────────────────────────────────────────────────────────────
  secaoTitulo(doc, pageW, "3. DETALHAMENTO POR TRIBUNAL");

  // Cabeçalho da tabela
  tabelaCabecalho(doc, pageW, [
    { label: "Tribunal", width: 0.38 },
    { label: "Alias", width: 0.08 },
    { label: "Total", width: 0.1 },
    { label: "Precatórios", width: 0.12 },
    { label: "RPVs", width: 0.1 },
    { label: "Provider", width: 0.1 },
    { label: "Status", width: 0.12 },
  ]);

  for (let idx = 0; idx < resultado.summary.por_tribunal.length; idx++) {
    const t = resultado.summary.por_tribunal[idx];
    const rowY = doc.y;
    if (rowY > doc.page.height - 100) {
      doc.addPage();
      tabelaCabecalho(doc, pageW, [
        { label: "Tribunal", width: 0.38 },
        { label: "Alias", width: 0.08 },
        { label: "Total", width: 0.1 },
        { label: "Precatórios", width: 0.12 },
        { label: "RPVs", width: 0.1 },
        { label: "Provider", width: 0.1 },
        { label: "Status", width: 0.12 },
      ]);
    }

    const bg = idx % 2 === 0 ? "#ffffff" : COR_DESTAQUE;
    const cols = [
      { val: t.tribunal, width: 0.38, align: "left" as const },
      { val: t.tribunal_alias.toUpperCase(), width: 0.08, align: "center" as const },
      { val: t.total_processos.toLocaleString("pt-BR"), width: 0.1, align: "right" as const },
      { val: t.precatorios.toLocaleString("pt-BR"), width: 0.12, align: "right" as const },
      { val: t.rpvs.toLocaleString("pt-BR"), width: 0.1, align: "right" as const },
      { val: t.provider, width: 0.1, align: "center" as const },
      { val: t.status, width: 0.12, align: "center" as const, color: statusColor(t.status) },
    ];

    tabelaLinha(doc, pageW, cols, bg, rowY);
  }

  doc.moveDown(0.8);

  // ── Dotação Orçamentária ────────────────────────────────────────────────────
  if (resultado.dotacao_orcamentaria && resultado.dotacao_orcamentaria.length > 0) {
    if (doc.y > doc.page.height - 200) doc.addPage();

    secaoTitulo(doc, pageW, "4. DOTAÇÃO ORÇAMENTÁRIA");

    tabelaCabecalho(doc, pageW, [
      { label: "Cód. Ação", width: 0.1 },
      { label: "Descrição", width: 0.44 },
      { label: "Dotação Inicial", width: 0.15 },
      { label: "Dotação Atual", width: 0.15 },
      { label: "Status", width: 0.16 },
    ]);

    for (let idx = 0; idx < resultado.dotacao_orcamentaria.length; idx++) {
    const d = resultado.dotacao_orcamentaria[idx];
      const rowY = doc.y;
      if (rowY > doc.page.height - 100) {
        doc.addPage();
        tabelaCabecalho(doc, pageW, [
          { label: "Cód. Ação", width: 0.1 },
          { label: "Descrição", width: 0.44 },
          { label: "Dotação Inicial", width: 0.15 },
          { label: "Dotação Atual", width: 0.15 },
          { label: "Status", width: 0.16 },
        ]);
      }

      const bg = idx % 2 === 0 ? "#ffffff" : COR_DESTAQUE;
      tabelaLinha(doc, pageW, [
        { val: d.codigo_acao, width: 0.1, align: "center" as const },
        { val: d.descricao_acao, width: 0.44, align: "left" as const },
        { val: fmtBRL(d.dotacao_inicial), width: 0.15, align: "right" as const },
        { val: fmtBRL(d.dotacao_atual), width: 0.15, align: "right" as const },
        { val: d.status, width: 0.16, align: "center" as const, color: statusColor(d.status) },
      ], bg, rowY);
    }

    doc.moveDown(0.8);
  }

  // ── Integridade e Evidências ────────────────────────────────────────────────
  if (doc.y > doc.page.height - 180) doc.addPage();

  const secNum = resultado.dotacao_orcamentaria?.length ? "5" : "4";
  secaoTitulo(doc, pageW, `${secNum}. INTEGRIDADE E CADEIA DE CUSTÓDIA`);

  doc.fillColor(COR_TEXTO).fontSize(9).font("Helvetica")
    .text(
      "Os hashes SHA-256 abaixo garantem a integridade dos dados coletados. " +
      "Qualquer alteração nos arquivos de evidência invalida o hash correspondente.",
      { width: pageW }
    );
  doc.moveDown(0.5);

  const hashEntries = Object.entries(resultado.hashes);
  for (const [key, hash] of hashEntries) {
    const y = doc.y;
    doc.fillColor(COR_CINZA).fontSize(8).font("Helvetica-Bold")
      .text(key + ":", 50, y, { width: 100 });
    doc.fillColor(COR_TEXTO).fontSize(7.5).font("Courier")
      .text(hash, 155, y, { width: pageW - 105 });
    doc.moveDown(0.4);
  }

  doc.moveDown(0.3);
  doc.fillColor(COR_CINZA).fontSize(8).font("Helvetica")
    .text(`Total de evidências coletadas: ${resultado.evidencias_count}`, { width: pageW });
  doc.text(`Caminho do Evidence Pack: ${resultado.evidence_pack_path}`, { width: pageW });

  // ── Fontes ──────────────────────────────────────────────────────────────────
  if (resultado.sources && resultado.sources.length > 0) {
    doc.moveDown(0.8);
    const secNumF = Number(secNum) + 1;
    secaoTitulo(doc, pageW, `${secNumF}. FONTES CONSULTADAS`);

    for (const src of resultado.sources) {
      doc.fillColor(COR_TEXTO).fontSize(9).font("Helvetica-Bold")
        .text(`• ${src.name}`, { width: pageW, continued: false });
      doc.fillColor(COR_CINZA).fontSize(8).font("Helvetica")
        .text(`  Tipo: ${src.type} | URL: ${src.url}`, { width: pageW });
      doc.moveDown(0.3);
    }
  }

  // ── Rodapé em todas as páginas ──────────────────────────────────────────────
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    const footerY = doc.page.height - 45;
    doc.moveTo(50, footerY).lineTo(50 + pageW, footerY)
      .strokeColor(COR_LINHA).lineWidth(0.5).stroke();
    doc.fillColor(COR_CINZA).fontSize(7.5).font("Helvetica")
      .text(
        `AuraLOA — Laudo Técnico de Estoque de Precatórios | Exercício ${resultado.ano_exercicio} | ${fmtDate(resultado.generated_at_iso)}`,
        50, footerY + 6, { width: pageW - 40, align: "left" }
      );
    doc.text(`Página ${i + 1} de ${pages.count}`, 50, footerY + 6, {
      width: pageW,
      align: "right",
    });
  }

  doc.end();
  }); // fim da Promise
}

// ── Helpers de layout ─────────────────────────────────────────────────────────

function secaoTitulo(doc: PDFKit.PDFDocument, pageW: number, titulo: string) {
  const y = doc.y;
  doc.rect(50, y, pageW, 20).fill(COR_SECUNDARIA);
  doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
    .text(titulo, 57, y + 5, { width: pageW - 14 });
  doc.y = y + 26;
}

function tabelaCabecalho(
  doc: PDFKit.PDFDocument,
  pageW: number,
  cols: { label: string; width: number }[],
) {
  const y = doc.y;
  doc.rect(50, y, pageW, 18).fill(COR_PRIMARIA);
  let x = 50;
  for (const col of cols) {
    const w = pageW * col.width;
    doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold")
      .text(col.label, x + 3, y + 4, { width: w - 6, align: "center" });
    x += w;
  }
  doc.y = y + 18;
}

function tabelaLinha(
  doc: PDFKit.PDFDocument,
  pageW: number,
  cols: { val: string; width: number; align: "left" | "center" | "right"; color?: string }[],
  bg: string,
  rowY: number,
) {
  // Calcular altura necessária para o texto mais longo
  let maxLines = 1;
  for (const col of cols) {
    const w = pageW * col.width - 6;
    doc.fontSize(8);
    const textH = doc.heightOfString(col.val, { width: w });
    const lines = Math.ceil(textH / 10);
    if (lines > maxLines) maxLines = lines;
  }
  const rowH = Math.max(18, maxLines * 10 + 6);

  doc.rect(50, rowY, pageW, rowH).fill(bg);

  // Linhas divisórias verticais
  let lx = 50;
  for (const col of cols) {
    lx += pageW * col.width;
    doc.moveTo(lx, rowY).lineTo(lx, rowY + rowH)
      .strokeColor(COR_LINHA).lineWidth(0.3).stroke();
  }
  doc.moveTo(50, rowY + rowH).lineTo(50 + pageW, rowY + rowH)
    .strokeColor(COR_LINHA).lineWidth(0.3).stroke();

  let x = 50;
  for (const col of cols) {
    const w = pageW * col.width;
    doc.fillColor(col.color || COR_TEXTO).fontSize(8).font("Helvetica")
      .text(col.val, x + 3, rowY + 4, { width: w - 6, align: col.align });
    x += w;
  }

  doc.y = rowY + rowH;
}
