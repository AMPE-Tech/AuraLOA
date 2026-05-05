/**
 * cadeia_custodia.ts
 * Verifica a integridade e continuidade da cadeia de custódia do processo.
 * Analisa: sequência de peças, lacunas numéricas, assinaturas digitais,
 * datas de juntada, consistência de hash SHA-256, e conformidade com
 * a Resolução CNJ 185/2013 e Lei 11.419/2006.
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import type { DocumentoBaixado, CheckpointData } from "./documento_downloader.js";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(__filename);
const pdfParse = require("pdf-parse");

export interface AnaliseDocumento {
  numero: number;
  descricao: string;
  sha256Verificado: boolean;
  sha256Arquivo: string;
  sha256Original: string;
  temAssinaturaDigital: boolean;
  temCarimboTempo: boolean;
  temCodigoVerificador: boolean;
  temUrlVerificacao: boolean;
  dataJuntadaExtraida: string | null;
  dataJuntadaRegistrada: string | null;
  consistenciaDatas: boolean;
  numeroCNJInterno: string | null;
  paginasReais: number;
  textoExtraido: string; // primeiros 2000 chars
  anomalias: string[];
}

export interface LacunaNumeracao {
  de: number;
  ate: number;
  quantidade: number;
}

export interface ResultadoCadeiaCustodia {
  // Integridade geral
  integridadeGeral: "PRESERVADA" | "COMPROMETIDA" | "PARCIAL";
  scoreIntegridade: number; // 0-100
  totalDocumentos: number;
  documentosComAssinatura: number;
  documentosSemAssinatura: number;
  documentosComErroHash: number;

  // Sequência e lacunas
  sequenciaContínua: boolean;
  lacunas: LacunaNumeracao[];
  totalLacunas: number;

  // Análise por documento
  analises: AnaliseDocumento[];

  // Achados críticos
  achados: {
    tipo: "CRITICO" | "ALERTA" | "INFORMACAO";
    descricao: string;
    documentos: number[];
    fundamentoLegal: string;
  }[];

  // SHA-256 do relatório de custódia
  sha256Relatorio: string;
  geradoEm: string;
}

async function extrairTextoPDF(caminho: string): Promise<{ texto: string; paginas: number }> {
  try {
    const buffer = fs.readFileSync(caminho);
    const data = await pdfParse(buffer, { max: 0 }); // max=0 = todas as páginas
    return {
      texto: data.text || "",
      paginas: data.numpages || 0,
    };
  } catch {
    return { texto: "", paginas: 0 };
  }
}

function verificarAssinaturaDigital(texto: string): boolean {
  return [
    /assinado\s+(eletronicamente|digitalmente)/i,
    /Lei\s+11\.419\/2006/i,
    /DOCUMENTO\s+ASSINADO\s+DIGITALMENTE/i,
    /Assinatura\s+Digital/i,
    /Certificado\s+Digital/i,
    /ICP-Brasil/i,
    /A3\s+emitido\s+por/i,
  ].some((p) => p.test(texto));
}

function verificarCarimboTempo(texto: string): boolean {
  return [
    /carimbo\s+do\s+tempo/i,
    /timestamp/i,
    /TSA\s+\d/i,
    /RFC\s+3161/i,
  ].some((p) => p.test(texto));
}

function verificarCodigoVerificador(texto: string): string | null {
  const padroes = [
    /código\s+verificador[:\s]+([A-Z0-9]{5,20})/i,
    /código\s+CRC[:\s]+([A-F0-9]{8})/i,
    /\butQ([A-Za-z0-9]{6,12})\b/,
    /verificador[:\s]+(\d{5,10})/i,
  ];
  for (const p of padroes) {
    const m = p.exec(texto);
    if (m) return m[1];
  }
  return null;
}

function verificarUrlVerificacao(texto: string): boolean {
  return /https?:\/\/[a-z0-9.-]+\.jus\.br\/[^\s"<>]{10,}/i.test(texto);
}

function extrairDataDoTexto(texto: string): string | null {
  const padroes = [
    /Juntado\s+em[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /Data\s+de\s+Juntada[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /Em\s+(\d{2}\/\d{2}\/\d{4}),?\s+às/i,
    /São\s+Paulo,\s+(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i,
  ];
  for (const p of padroes) {
    const m = p.exec(texto);
    if (m) return m[1];
  }
  return null;
}

function extrairCNJDoTexto(texto: string): string | null {
  const m = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/.exec(texto);
  return m ? m[1] : null;
}

function verificarHashArquivo(caminho: string, sha256Original: string): { ok: boolean; sha256Real: string } {
  try {
    const buffer = fs.readFileSync(caminho);
    const sha256Real = createHash("sha256").update(buffer).digest("hex");
    return { ok: sha256Real === sha256Original, sha256Real };
  } catch {
    return { ok: false, sha256Real: "" };
  }
}

function detectarLacunas(numeros: number[]): LacunaNumeracao[] {
  const sorted = [...numeros].sort((a, b) => a - b);
  const lacunas: LacunaNumeracao[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > 1) {
      lacunas.push({
        de: sorted[i - 1] + 1,
        ate: sorted[i] - 1,
        quantidade: gap - 1,
      });
    }
  }
  return lacunas;
}

export async function analisarCadeiaCustodia(
  checkpoint: CheckpointData,
  logFn: (msg: string) => void = console.log,
): Promise<ResultadoCadeiaCustodia> {
  const geradoEm = new Date().toISOString();
  logFn(`[CadeiaCustodia] Iniciando análise de ${checkpoint.documentos.length} documentos...`);

  const documentosBaixados = checkpoint.documentos.filter((d) => !d.erro && d.arquivoLocal);
  const analises: AnaliseDocumento[] = [];
  let documentosComAssinatura = 0;
  let documentosSemAssinatura = 0;
  let documentosComErroHash = 0;

  for (let i = 0; i < documentosBaixados.length; i++) {
    const doc = documentosBaixados[i];
    logFn(`[CadeiaCustodia] Analisando ${i + 1}/${documentosBaixados.length}: ${doc.descricao.substring(0, 50)}`);

    const anomalias: string[] = [];

    // Verificar hash SHA-256
    const { ok: hashOk, sha256Real } = verificarHashArquivo(doc.arquivoLocal, doc.sha256);
    if (!hashOk && doc.sha256) {
      anomalias.push("Hash SHA-256 divergente do registrado no download — arquivo pode ter sido alterado");
      documentosComErroHash++;
    }

    // Extrair texto do PDF
    const { texto, paginas } = await extrairTextoPDF(doc.arquivoLocal);
    const textoResumido = texto.substring(0, 2000);

    // Verificações de autenticidade
    const temAssinatura = verificarAssinaturaDigital(texto);
    const temCarimbo = verificarCarimboTempo(texto);
    const codigoVerificador = verificarCodigoVerificador(texto);
    const temUrl = verificarUrlVerificacao(texto);

    if (!temAssinatura) {
      anomalias.push("Assinatura digital não detectada (Lei 11.419/2006 — art. 1º, §2º)");
      documentosSemAssinatura++;
    } else {
      documentosComAssinatura++;
    }

    // Verificar datas
    const dataExtraida = extrairDataDoTexto(texto);
    const consistenciaDatas = !dataExtraida || !doc.dataJuntada
      ? true // não há dados suficientes para comparar
      : dataExtraida === doc.dataJuntada;

    if (dataExtraida && doc.dataJuntada && !consistenciaDatas) {
      anomalias.push(`Inconsistência de datas: juntada registrada ${doc.dataJuntada} vs. data no documento ${dataExtraida}`);
    }

    // CNJ interno
    const cnj = extrairCNJDoTexto(texto);
    if (cnj && !texto.includes(checkpoint.numeroCNJ.replace(/-/, ""))) {
      if (cnj !== checkpoint.numeroCNJ) {
        anomalias.push(`CNJ no documento (${cnj}) difere do processo principal (${checkpoint.numeroCNJ})`);
      }
    }

    analises.push({
      numero: doc.numero,
      descricao: doc.descricao,
      sha256Verificado: hashOk,
      sha256Arquivo: sha256Real,
      sha256Original: doc.sha256,
      temAssinaturaDigital: temAssinatura,
      temCarimboTempo: temCarimbo,
      temCodigoVerificador: !!codigoVerificador,
      temUrlVerificacao: temUrl,
      dataJuntadaExtraida: dataExtraida,
      dataJuntadaRegistrada: doc.dataJuntada,
      consistenciaDatas,
      numeroCNJInterno: cnj,
      paginasReais: paginas,
      textoExtraido: textoResumido,
      anomalias,
    });
  }

  // Detectar lacunas na numeração
  const numerosPresentes = checkpoint.documentos.filter((d) => !d.erro).map((d) => d.numero);
  const lacunas = detectarLacunas(numerosPresentes);

  // Calcular score de integridade
  let scoreIntegridade = 100;
  if (documentosComErroHash > 0) scoreIntegridade -= Math.min(40, documentosComErroHash * 10);
  if (lacunas.length > 0) scoreIntegridade -= Math.min(20, lacunas.reduce((s, l) => s + l.quantidade, 0) * 2);
  const taxaSemAssinatura = documentosSemAssinatura / Math.max(analises.length, 1);
  scoreIntegridade -= Math.round(taxaSemAssinatura * 30);
  scoreIntegridade = Math.max(0, Math.min(100, scoreIntegridade));

  const integridadeGeral: ResultadoCadeiaCustodia["integridadeGeral"] =
    scoreIntegridade >= 80 ? "PRESERVADA" : scoreIntegridade >= 50 ? "PARCIAL" : "COMPROMETIDA";

  // Montar achados
  const achados: ResultadoCadeiaCustodia["achados"] = [];

  if (lacunas.length > 0) {
    achados.push({
      tipo: "CRITICO",
      descricao: `Detectadas ${lacunas.length} lacunas na numeração das peças processuais (total de ${lacunas.reduce((s, l) => s + l.quantidade, 0)} peças ausentes). Possível supressão de documentos.`,
      documentos: [],
      fundamentoLegal: "CPC art. 789; CPP art. 261; Resolução CNJ 185/2013 art. 14 — integridade do processo eletrônico",
    });
  }

  if (documentosComErroHash > 0) {
    const docsComErro = analises.filter((a) => !a.sha256Verificado).map((a) => a.numero);
    achados.push({
      tipo: "CRITICO",
      descricao: `${documentosComErroHash} documento(s) com hash SHA-256 divergente do registrado. Integridade do conteúdo comprometida.`,
      documentos: docsComErro,
      fundamentoLegal: "Lei 11.419/2006 art. 11, §3º — garantia de integridade de documentos eletrônicos",
    });
  }

  const docsInconsistentes = analises.filter((a) => a.anomalias.some((x) => x.includes("data"))).map((a) => a.numero);
  if (docsInconsistentes.length > 0) {
    achados.push({
      tipo: "ALERTA",
      descricao: `${docsInconsistentes.length} documento(s) com inconsistência entre data de juntada registrada e data no conteúdo do PDF.`,
      documentos: docsInconsistentes,
      fundamentoLegal: "CPP art. 564, III — nulidade por inobservância das formalidades processuais",
    });
  }

  const docsSemAssinatura = analises.filter((a) => !a.temAssinaturaDigital).map((a) => a.numero);
  if (docsSemAssinatura.length > 0) {
    achados.push({
      tipo: documentosSemAssinatura > analises.length * 0.3 ? "CRITICO" : "ALERTA",
      descricao: `${documentosSemAssinatura} documento(s) sem assinatura digital detectável. Validade jurídica pode estar comprometida.`,
      documentos: docsSemAssinatura,
      fundamentoLegal: "Lei 11.419/2006 art. 1º, §2º, III — requisito de assinatura eletrônica qualificada",
    });
  }

  const sha256Relatorio = createHash("sha256")
    .update(JSON.stringify({ analises: analises.map((a) => a.sha256Original), geradoEm }))
    .digest("hex");

  logFn(`[CadeiaCustodia] Análise concluída — Score: ${scoreIntegridade}/100 (${integridadeGeral})`);
  logFn(`[CadeiaCustodia] Lacunas: ${lacunas.length} | Erros hash: ${documentosComErroHash} | Sem assinatura: ${documentosSemAssinatura}`);

  return {
    integridadeGeral,
    scoreIntegridade,
    totalDocumentos: checkpoint.documentos.length,
    documentosComAssinatura,
    documentosSemAssinatura,
    documentosComErroHash,
    sequenciaContínua: lacunas.length === 0,
    lacunas,
    totalLacunas: lacunas.reduce((s, l) => s + l.quantidade, 0),
    analises,
    achados,
    sha256Relatorio,
    geradoEm,
  };
}
