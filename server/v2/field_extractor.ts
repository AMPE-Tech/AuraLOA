import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";

const anthropic = new Anthropic();
const MODEL = "claude-haiku-4-5-20251001";

const PRICE_INPUT_PER_MTOK = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;
const OCR_THRESHOLD_CHARS = 500;

// ── Tipos ─────────────────────────────────────────────────────────────────

export type NaturezaDocumento =
  | "oficio_requisitorio"
  | "oficio_precatorio"
  | "certidao_julgamento"
  | "certidao_transito"
  | "peticao_inicial"
  | "peticao_intermediaria"
  | "despacho"
  | "decisao_monocratica"
  | "decisao_interlocutoria"
  | "sentenca"
  | "acordao"
  | "auto_de_pagamento"
  | "auto_de_adjudicacao"
  | "edital"
  | "mandado"
  | "alvara"
  | "requisicao_pequeno_valor"
  | "outro"
  | null;

export interface ProcessoIdentificado {
  numero: string;
  formato: "cnj-20" | "interno-tribunal" | "outro";
  tipo: string;
  grau?: "1" | "2" | "superior" | null;
  tribunal?: string | null;
  observacao?: string;
}

export interface DocumentoIdentificado {
  tipo: string;
  valor: string;
  fonte?: string;
}

export interface Parte {
  nome: string;
  polo: "autor" | "reu" | "agravante" | "agravado" | "exequente" | "executado" | "embargante" | "embargado" | "credor" | "devedor" | "cessionario" | "terceiro" | "outro";
  cpf_cnpj: string | null;
  qualificacao?: string | null;
  observacao?: string;
}

export interface Autoridade {
  nome: string;
  funcao: "relator" | "presidente_sessao" | "desembargador" | "juiz" | "procurador" | "secretario" | "servidor" | "escrivao" | "outro";
  grau?: string | null;
  orgao?: string | null;
  observacao?: string;
}

export interface DataIdentificada {
  data: string;
  descricao: string;
}

export interface ExtractedFields {
  // Natureza do documento
  natureza_documento: NaturezaDocumento;

  // Números encontrados (múltiplos possíveis)
  processos_identificados: ProcessoIdentificado[];
  documentos_identificados: DocumentoIdentificado[];

  // Pessoas e autoridades
  partes: Parte[];
  autoridades: Autoridade[];

  // Datas
  datas_identificadas: DataIdentificada[];

  // Decisão/status
  decisao_resumo: string | null;
  status_processual: string | null;

  // Campos-chave "principais" (compatibilidade V1 + destaque)
  numero_cnj: string | null;
  numero_oficio: string | null;
  tribunal: string | null;
  tipo: "PRECATORIO" | "RPV" | null;
  credor_nome: string | null;
  credor_cpf_cnpj: string | null;
  devedor: string | null;
  valor_rs: number | null;
  data_transito: string | null;
  orgao_julgador: string | null;

  // Rodapé CNJ padrão Resolução 234/2016
  url_verificacao_tribunal: string | null;
  qrcode_tribunal: string | null;
  codigo_verificador: string | null;

  // Observações gerais do extrator
  observacoes_gerais: string[];
}

export interface ChecklistItem {
  verificado: boolean;
  encontrado: boolean;
  valor?: string;
  observacao?: string;
}

export interface ExtractionResult {
  fields: ExtractedFields;
  checklist: Record<string, ChecklistItem>;
  method: "pdf-haiku-ocr" | "text-haiku";
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  raw_response: string;
  raw_text_pdf: string;
}

// ── Prompt expandido ──────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Você é um extrator especializado em documentos do sistema judicial brasileiro (todos os tribunais: TRFs, STJ, STF, TST, TJs estaduais, Justiça do Trabalho, Justiça Militar, Justiça Eleitoral).

REGRA FUNDAMENTAL: No Brasil NÃO HÁ padronização estrita entre tribunais. Um mesmo precatório pode aparecer como "ofício requisitório", "certidão", "requisição de pequeno valor", "auto de pagamento", "despacho", "sentença", "acórdão" etc. Seu trabalho é:

1. Identificar a NATUREZA REAL do documento (não confiar em suposições do usuário).
2. Extrair TODOS os números de processo encontrados (pode haver múltiplos: ação originária, execução, recurso, agravo, precatório específico do tribunal).
3. Extrair TODAS as partes (não esqueça de "e outros (N)" que indica partes adicionais).
4. Extrair TODAS as autoridades envolvidas.
5. Extrair TODAS as datas relevantes.
6. Transcrever a decisão literal, se houver.
7. NÃO inventar. Se não existe no documento, use null.

Retorne APENAS um JSON válido no formato exato abaixo. Nenhum texto antes ou depois. Sem markdown.

{
  "natureza_documento": "oficio_requisitorio | oficio_precatorio | certidao_julgamento | certidao_transito | peticao_inicial | peticao_intermediaria | despacho | decisao_monocratica | decisao_interlocutoria | sentenca | acordao | auto_de_pagamento | auto_de_adjudicacao | edital | mandado | alvara | requisicao_pequeno_valor | outro",

  "processos_identificados": [
    {
      "numero": "string (preservar formatação original)",
      "formato": "cnj-20 | interno-tribunal | outro",
      "tipo": "ação_originária | execução | cumprimento_de_sentença | agravo_interno | agravo_instrumento | apelação | recurso_especial | recurso_extraordinário | precatório | ofício_requisitório | rpv | outro",
      "grau": "1 | 2 | superior | null",
      "tribunal": "TRF1 | TRF2 | ... | TJSP | STJ | STF | TST | null",
      "observacao": "contexto em que foi citado"
    }
  ],

  "documentos_identificados": [
    {
      "tipo": "id_documento_pje | codigo_verificador | id_esaj | numero_oficio | numero_protocolo | outro",
      "valor": "string",
      "fonte": "onde aparece no documento"
    }
  ],

  "partes": [
    {
      "nome": "nome completo",
      "polo": "autor | reu | agravante | agravado | exequente | executado | embargante | embargado | credor | devedor | cessionario | terceiro | outro",
      "cpf_cnpj": "XXX.XXX.XXX-XX ou XX.XXX.XXX/XXXX-XX | null",
      "qualificacao": "ex: Agravante, Credor Principal, Sucessor | null",
      "observacao": "ex: 'e outros (2)' significa que há 2 agravantes adicionais"
    }
  ],

  "autoridades": [
    {
      "nome": "nome completo",
      "funcao": "relator | presidente_sessao | desembargador | juiz | procurador | secretario | servidor | escrivao | outro",
      "grau": "desembargador_federal | juiz_federal | procurador_regional | ... | null",
      "orgao": "6ª Turma | 1ª Vara | Procuradoria Regional | null",
      "observacao": "ex: votou divergindo da relatora"
    }
  ],

  "datas_identificadas": [
    { "data": "AAAA-MM-DD", "descricao": "ex: data da sessão de julgamento" }
  ],

  "decisao_resumo": "transcrever literalmente a decisão/dispositivo se houver, OU null",

  "status_processual": "EM_TRAMITAÇÃO | EM_JULGAMENTO | JULGADO | TRANSITADO_EM_JULGADO | EM_EXECUÇÃO | CUMPRIMENTO_DE_SENTENÇA | PRECATÓRIO_EXPEDIDO | PAGO | ARQUIVADO | null",

  "numero_cnj": "string padrão NNNNNNN-DD.AAAA.J.TT.OOOO — se houver, o CNJ principal do processo | null",
  "numero_oficio": "string do ofício requisitório se houver | null",
  "tribunal": "TRF1 | TRF2 | TJSP | STF | STJ | TST | outro | null",
  "tipo": "PRECATORIO | RPV | null (apenas se o documento é efetivamente precatório ou RPV; se é outro tipo de documento, null)",

  "credor_nome": "credor principal do crédito (pode coincidir com a parte autora/agravante) | null",
  "credor_cpf_cnpj": "CPF/CNPJ do credor principal se declarado | null",
  "devedor": "entidade devedora principal (União, INSS, INCRA, Estado, Município, etc) | null",
  "valor_rs": "número decimal do valor do crédito se declarado (ex: 1250000.50) | null",
  "data_transito": "AAAA-MM-DD (trânsito em julgado ou ajuizamento se este é o documento inicial) | null",
  "orgao_julgador": "nome da vara/turma/seção | null",

  "url_verificacao_tribunal": "URL oficial do tribunal para verificação do documento (geralmente no rodapé) | null",
  "qrcode_tribunal": "URL extraída de QR Code se houver (ou 'QR_CODE_PRESENTE_URL_INDETERMINADA' se você vê QR mas não consegue ler) | null",
  "codigo_verificador": "código alfanumérico oficial (ID documento PJe, código eSAJ, etc) | null",

  "observacoes_gerais": ["lista de observações relevantes do extrator sobre o documento, ex: 'Documento é certidão de julgamento — ofício requisitório ainda NÃO foi expedido'"]
}

REGRAS OBRIGATÓRIAS:
1. NUNCA invente dados. Se não existe no documento OU não é identificável com certeza: null ou array vazio.
2. valor_rs: apenas número decimal. "R$ 1.250.000,50" vira 1250000.50.
3. processos_identificados: capture TODOS os números que aparecerem, classificando cada um pelo contexto.
4. partes: se o documento diz "Fulano e outros (2)", crie entrada para Fulano com observacao="e outros (2) — há 2 partes adicionais não identificadas no documento".
5. Se o tipo do documento NÃO é precatório nem RPV (ex: é um agravo, uma sentença, uma decisão), coloque "tipo": null.
6. URL/QR/código no RODAPÉ (padrão Resolução CNJ 234/2016).
7. Responda APENAS o JSON.`;

function parseHaikuResponse(raw: string): ExtractedFields {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Resposta do Haiku não contém JSON válido");
  }
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  const p = JSON.parse(jsonStr);

  const str = (k: string): string | null => {
    const v = p[k];
    if (v === null || v === undefined || v === "" || v === "null") return null;
    return String(v).trim();
  };

  const arr = <T>(k: string): T[] => {
    const v = p[k];
    return Array.isArray(v) ? (v as T[]) : [];
  };

  let valorRs: number | null = null;
  if (p.valor_rs !== null && p.valor_rs !== undefined && p.valor_rs !== "") {
    if (typeof p.valor_rs === "number") valorRs = p.valor_rs;
    else {
      const n = parseFloat(String(p.valor_rs).replace(/[^\d,.-]/g, "").replace(",", "."));
      if (!isNaN(n)) valorRs = n;
    }
  }

  const tipo = str("tipo");
  const tipoNorm: "PRECATORIO" | "RPV" | null =
    tipo === "PRECATORIO" || tipo === "RPV" ? tipo : null;

  return {
    natureza_documento: (str("natureza_documento") as NaturezaDocumento) ?? null,
    processos_identificados: arr<ProcessoIdentificado>("processos_identificados"),
    documentos_identificados: arr<DocumentoIdentificado>("documentos_identificados"),
    partes: arr<Parte>("partes"),
    autoridades: arr<Autoridade>("autoridades"),
    datas_identificadas: arr<DataIdentificada>("datas_identificadas"),
    decisao_resumo: str("decisao_resumo"),
    status_processual: str("status_processual"),
    numero_cnj: str("numero_cnj"),
    numero_oficio: str("numero_oficio"),
    tribunal: str("tribunal"),
    tipo: tipoNorm,
    credor_nome: str("credor_nome"),
    credor_cpf_cnpj: str("credor_cpf_cnpj"),
    devedor: str("devedor"),
    valor_rs: valorRs,
    data_transito: str("data_transito"),
    orgao_julgador: str("orgao_julgador"),
    url_verificacao_tribunal: str("url_verificacao_tribunal"),
    qrcode_tribunal: str("qrcode_tribunal"),
    codigo_verificador: str("codigo_verificador"),
    observacoes_gerais: Array.isArray(p.observacoes_gerais) ? p.observacoes_gerais.map(String) : [],
  };
}

function buildChecklist(fields: ExtractedFields): Record<string, ChecklistItem> {
  const item = (valor: string | number | null | undefined, obs?: string): ChecklistItem => {
    const encontrado = valor !== null && valor !== "" && valor !== undefined;
    return {
      verificado: true,
      encontrado,
      ...(encontrado ? { valor: String(valor) } : { observacao: obs ?? "Não localizado no documento" }),
    };
  };

  return {
    natureza_documento: item(fields.natureza_documento),
    numero_cnj: item(fields.numero_cnj),
    numero_oficio: item(fields.numero_oficio, "Nem todo documento processual traz número de ofício"),
    tribunal: item(fields.tribunal),
    tipo: item(fields.tipo, "Documento não é especificamente precatório/RPV, ou tipo não é identificável"),
    credor_nome: item(fields.credor_nome),
    credor_cpf_cnpj: item(fields.credor_cpf_cnpj, "CPF/CNPJ não explicitado no documento"),
    devedor: item(fields.devedor),
    valor_rs: item(fields.valor_rs, "Valor não declarado neste documento"),
    data_transito: item(fields.data_transito),
    orgao_julgador: item(fields.orgao_julgador),
    url_verificacao_tribunal: item(fields.url_verificacao_tribunal, "Documento pode ser anterior à Resolução CNJ 234/2016"),
    qrcode_tribunal: item(fields.qrcode_tribunal, "QR Code não localizado ou indetermin-ável"),
    codigo_verificador: item(fields.codigo_verificador, "Código verificador alfanumérico não localizado"),
    decisao_resumo: item(fields.decisao_resumo, "Documento não contém dispositivo decisório"),
    status_processual: item(fields.status_processual),
    total_processos_identificados: item(
      fields.processos_identificados.length || null,
      "Nenhum número de processo identificado"
    ),
    total_partes: item(fields.partes.length || null),
    total_autoridades: item(fields.autoridades.length || null),
    total_datas: item(fields.datas_identificadas.length || null),
  };
}

export async function extractFields(
  pdfPath: string,
  textoPdfParse: string,
): Promise<ExtractionResult> {
  const useOcr = (textoPdfParse?.length ?? 0) < OCR_THRESHOLD_CHARS;
  const method: ExtractionResult["method"] = useOcr ? "pdf-haiku-ocr" : "text-haiku";

  let messages: Anthropic.Messages.MessageParam[];
  if (useOcr) {
    const pdfBase64 = readFileSync(pdfPath).toString("base64");
    messages = [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ];
  } else {
    messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${EXTRACTION_PROMPT}\n\n=== TEXTO DO DOCUMENTO ===\n${textoPdfParse}\n=== FIM ===`,
          },
        ],
      },
    ];
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages,
  });

  const rawText = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const fields = parseHaikuResponse(rawText);
  const checklist = buildChecklist(fields);

  const tokens_input = response.usage.input_tokens;
  const tokens_output = response.usage.output_tokens;
  const cost_usd =
    (tokens_input / 1_000_000) * PRICE_INPUT_PER_MTOK +
    (tokens_output / 1_000_000) * PRICE_OUTPUT_PER_MTOK;

  return {
    fields,
    checklist,
    method,
    tokens_input,
    tokens_output,
    cost_usd,
    raw_response: rawText,
    raw_text_pdf: textoPdfParse,
  };
}
