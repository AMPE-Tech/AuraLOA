// IMPORTANTE: todos os sinais detectados são CANDIDATOS HEURÍSTICOS.
// Nenhum sinal aqui deve ser tratado como verdade confirmada sem validação adicional.
// A classificação é probabilística, baseada em padrões de URL/filename/metadados.

import type { PdfIntakeResult } from "../adapters/pdf_intake_adapter";

export type PdfDocumentType =
  | "precatorio_lista_oficial"
  | "oficio_requisitorio"
  | "decisao_judicial"
  | "documento_processual_generico"
  | "desconhecido";

export type PdfSignalType =
  | "numero_cnj_candidato"
  | "numero_precatorio_candidato"
  | "valor_candidato"
  | "nome_credor_candidato"
  | "nome_advogado_candidato"
  | "mencao_cessao"
  | "mencao_pagamento"
  | "mencao_oficio_requisitorio"
  | "mencao_lista_precatorios"
  | "tribunal_identificado";

export interface PdfSignalDetected {
  signal: PdfSignalType;
  source: "url" | "filename" | "metadata";
  value_candidato: string;
  confidence: number;
  nota: string;
}

export interface PdfClassificationResult {
  document_type: PdfDocumentType;
  tribunal_alias: string | null;
  confidence_score: number;
  signals_detected: PdfSignalDetected[];
  classification_note: string;
  classified_at: string;
}

// Padrões heurísticos por tipo documental (aplicados sobre URL e filename em lowercase).
const TYPE_PATTERNS: Record<PdfDocumentType, RegExp[]> = {
  precatorio_lista_oficial: [
    /lista.+precatorio/i,
    /precatorio.+lista/i,
    /relacao.+precatorio/i,
    /precatorio.+orcamento/i,
    /orcamento.+precatorio/i,
    /precatorios-federal/i,
    /precatorios-trf/i,
    /quadro.+precatorio/i,
  ],
  oficio_requisitorio: [
    /oficio.+requisitorio/i,
    /oficio_requisitorio/i,
    /oficio-req/i,
    /req_oficio/i,
  ],
  decisao_judicial: [
    /decisao/i,
    /acordao/i,
    /sentenca/i,
    /transito.+julgado/i,
  ],
  documento_processual_generico: [
    /processo/i,
    /processual/i,
    /peticao/i,
    /recurso/i,
    /manifestacao/i,
  ],
  desconhecido: [],
};

// Mapa de alias de tribunais para detecção via URL/filename.
const TRIBUNAL_PATTERNS: Array<{ alias: string; patterns: RegExp[] }> = [
  { alias: "trf1", patterns: [/trf1/i, /trf-1/i] },
  { alias: "trf2", patterns: [/trf2/i, /trf-2/i] },
  { alias: "trf3", patterns: [/trf3/i, /trf-3/i] },
  { alias: "trf4", patterns: [/trf4/i, /trf-4/i] },
  { alias: "trf5", patterns: [/trf5/i, /trf-5/i] },
  { alias: "trf6", patterns: [/trf6/i, /trf-6/i] },
  { alias: "tjsp", patterns: [/tjsp/i, /tj-sp/i, /tjsp\.jus/i] },
  { alias: "stj",  patterns: [/\bstj\b/i] },
  { alias: "stf",  patterns: [/\bstf\b/i] },
];

function detectTribunal(text: string): string | null {
  for (const { alias, patterns } of TRIBUNAL_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return alias;
  }
  return null;
}

function classifyDocumentType(text: string): { type: PdfDocumentType; matched_patterns: string[] } {
  for (const [dtype, patterns] of Object.entries(TYPE_PATTERNS) as [PdfDocumentType, RegExp[]][]) {
    if (dtype === "desconhecido") continue;
    const matched = patterns.filter((p) => p.test(text));
    if (matched.length > 0) {
      return { type: dtype, matched_patterns: matched.map((p) => p.toString()) };
    }
  }
  return { type: "desconhecido", matched_patterns: [] };
}

function detectSignals(
  url: string | null,
  filename: string,
  tribunal_alias: string | null,
): PdfSignalDetected[] {
  const signals: PdfSignalDetected[] = [];
  const searchText = `${url ?? ""} ${filename}`.toLowerCase();

  if (/precatorio/.test(searchText)) {
    signals.push({
      signal: "numero_precatorio_candidato",
      source: url ? "url" : "filename",
      value_candidato: "(padrão 'precatorio' detectado na referência)",
      confidence: 0.3,
      nota: "HEURÍSTICO — presença da palavra 'precatorio' na referência. Não confirmado.",
    });
  }

  if (/cessao|cessão|cession/.test(searchText)) {
    signals.push({
      signal: "mencao_cessao",
      source: url ? "url" : "filename",
      value_candidato: "(padrão 'cessao' detectado)",
      confidence: 0.35,
      nota: "HEURÍSTICO — menção a cessão detectada na referência.",
    });
  }

  if (/pagamento|pago|quitac/.test(searchText)) {
    signals.push({
      signal: "mencao_pagamento",
      source: url ? "url" : "filename",
      value_candidato: "(padrão de pagamento detectado)",
      confidence: 0.35,
      nota: "HEURÍSTICO — menção a pagamento detectada na referência.",
    });
  }

  if (/oficio.{0,20}req|req.{0,20}oficio/.test(searchText)) {
    signals.push({
      signal: "mencao_oficio_requisitorio",
      source: url ? "url" : "filename",
      value_candidato: "(padrão ofício requisitório detectado)",
      confidence: 0.4,
      nota: "HEURÍSTICO — padrão de ofício requisitório detectado na referência.",
    });
  }

  if (/lista.{0,20}precatorio|precatorio.{0,20}lista/.test(searchText)) {
    signals.push({
      signal: "mencao_lista_precatorios",
      source: url ? "url" : "filename",
      value_candidato: "(padrão lista de precatórios detectado)",
      confidence: 0.5,
      nota: "HEURÍSTICO — padrão de lista de precatórios detectado na referência.",
    });
  }

  if (tribunal_alias) {
    signals.push({
      signal: "tribunal_identificado",
      source: url ? "url" : "filename",
      value_candidato: tribunal_alias,
      confidence: 0.75,
      nota: "Tribunal identificado por padrão de texto na referência.",
    });
  }

  return signals;
}

export function classifyPdfDocument(intake: PdfIntakeResult): PdfClassificationResult {
  const classified_at = new Date().toISOString();
  const searchText = `${intake.reference_url ?? ""} ${intake.file_name}`;

  // Tribunal: contexto do intake tem precedência; fallback para detecção textual.
  const tribunal_from_metadata = intake.metadata?.tribunal as string | undefined;
  const tribunal_alias =
    tribunal_from_metadata ??
    detectTribunal(searchText) ??
    null;

  // Tipo documental por heurística sobre URL/filename.
  const { type: document_type, matched_patterns } = classifyDocumentType(searchText);

  // Sinais candidatos.
  const signals_detected = detectSignals(intake.reference_url, intake.file_name, tribunal_alias);

  // Score de confiança:
  // - base: depende do tipo detectado e quantidade de sinais
  // - intake_mode reference_only penaliza moderadamente
  const type_base: Record<PdfDocumentType, number> = {
    precatorio_lista_oficial:   0.55,
    oficio_requisitorio:        0.50,
    decisao_judicial:           0.45,
    documento_processual_generico: 0.35,
    desconhecido:               0.10,
  };

  const base = type_base[document_type];
  const signal_bonus = Math.min(signals_detected.length * 0.05, 0.20);
  const mode_penalty = intake.intake_mode === "reference_only" ? 0.15 : 0;
  const confidence_score = Math.max(0, Math.min(1, base + signal_bonus - mode_penalty));

  const classification_note =
    document_type === "desconhecido"
      ? "Não foi possível determinar o tipo documental pela referência disponível. " +
        "Necessário acesso ao conteúdo do PDF para classificação mais precisa."
      : `Classificação heurística baseada em padrões de URL/filename. ` +
        `Padrões detectados: [${matched_patterns.join(", ")}]. ` +
        `Intake por referência controlada — confiança moderada. ` +
        `Todos os sinais são candidatos, não confirmados.`;

  return {
    document_type,
    tribunal_alias,
    confidence_score: parseFloat(confidence_score.toFixed(3)),
    signals_detected,
    classification_note,
    classified_at,
  };
}
