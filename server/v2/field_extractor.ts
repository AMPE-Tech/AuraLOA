import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";

const anthropic = new Anthropic();
const MODEL = "claude-haiku-4-5-20251001";

const PRICE_INPUT_PER_MTOK = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;

const OCR_THRESHOLD_CHARS = 500;

export interface ExtractedFields {
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
  url_verificacao_tribunal: string | null;
  qrcode_tribunal: string | null;
  codigo_verificador: string | null;
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
}

const EXTRACTION_PROMPT = `Você é um extrator especializado em ofícios requisitórios e precatórios do sistema judicial brasileiro (TRFs, TJs, STF, STJ, TST).

Analise o documento e retorne APENAS um JSON válido no formato EXATO abaixo. Nenhum texto antes ou depois. Sem markdown, sem code fences.

{
  "numero_cnj": "string no formato NNNNNNN-DD.AAAA.J.TT.OOOO | null",
  "numero_oficio": "string (ex: AUT.2024.008667, 666/2021, 2024.08671/OFREQ) | null",
  "tribunal": "TRF1 | TRF2 | TRF3 | TRF4 | TRF5 | TRF6 | TJSP | TJRJ | TJMG | TJRS | TJPR | TJSC | TJBA | STF | STJ | TST | outro | null",
  "tipo": "PRECATORIO | RPV | null",
  "credor_nome": "string | null",
  "credor_cpf_cnpj": "string formato XXX.XXX.XXX-XX ou XX.XXX.XXX/XXXX-XX | null",
  "devedor": "string (União, INSS, INCRA, Município de X, Estado de Y, etc) | null",
  "valor_rs": "número decimal sem formatação (ex: 1250000.50) | null",
  "data_transito": "AAAA-MM-DD | null",
  "orgao_julgador": "string (nome da vara/turma/seção judiciária) | null",
  "url_verificacao_tribunal": "URL oficial do tribunal para verificação (geralmente no rodapé) | null",
  "qrcode_tribunal": "URL do QR Code se houver (normalmente igual à url_verificacao_tribunal) | null",
  "codigo_verificador": "código alfanumérico de autenticação oficial | null"
}

REGRAS ABSOLUTAS:
1. Se o campo não estiver presente no documento OU não for identificável com certeza: use null. NUNCA invente.
2. valor_rs: apenas número decimal. "R$ 1.250.000,50" vira 1250000.50.
3. CNJ: formato exato com hífen e pontos. Se só encontrar dígitos, formate corretamente.
4. URL/QR Code: procure ESPECIALMENTE no RODAPÉ (padrão Resolução CNJ 234/2016). Pode aparecer como "Para verificar a autenticidade: https://...".
5. Se o QR Code está presente no documento mas você não consegue decodificar sua URL, registre qrcode_tribunal como "QR_CODE_PRESENTE_URL_INDETERMINADA" em vez de null.
6. Se o documento menciona data de ajuizamento OU trânsito em julgado, prefira a de trânsito. Se só tem ajuizamento, use essa.
7. Responda APENAS com o JSON. Zero texto adicional.`;

function parseHaikuResponse(raw: string): ExtractedFields {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Resposta do Haiku não contém JSON válido");
  }
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(jsonStr);

  const get = (k: string): string | null => {
    const v = parsed[k];
    if (v === null || v === undefined || v === "" || v === "null") return null;
    return String(v).trim();
  };

  const tipo = get("tipo");
  const tipoNormalizado: "PRECATORIO" | "RPV" | null =
    tipo === "PRECATORIO" || tipo === "RPV" ? tipo : null;

  let valorRs: number | null = null;
  const rawValor = parsed.valor_rs;
  if (rawValor !== null && rawValor !== undefined && rawValor !== "") {
    if (typeof rawValor === "number") valorRs = rawValor;
    else {
      const cleanedValor = String(rawValor).replace(/[^\d,.-]/g, "").replace(",", ".");
      const n = parseFloat(cleanedValor);
      if (!isNaN(n)) valorRs = n;
    }
  }

  return {
    numero_cnj: get("numero_cnj"),
    numero_oficio: get("numero_oficio"),
    tribunal: get("tribunal"),
    tipo: tipoNormalizado,
    credor_nome: get("credor_nome"),
    credor_cpf_cnpj: get("credor_cpf_cnpj"),
    devedor: get("devedor"),
    valor_rs: valorRs,
    data_transito: get("data_transito"),
    orgao_julgador: get("orgao_julgador"),
    url_verificacao_tribunal: get("url_verificacao_tribunal"),
    qrcode_tribunal: get("qrcode_tribunal"),
    codigo_verificador: get("codigo_verificador"),
  };
}

function buildChecklist(fields: ExtractedFields): Record<string, ChecklistItem> {
  const item = (valor: string | number | null, obsSeNaoEncontrado?: string): ChecklistItem => {
    const encontrado = valor !== null && valor !== "" && valor !== undefined;
    return {
      verificado: true,
      encontrado,
      ...(encontrado ? { valor: String(valor) } : { observacao: obsSeNaoEncontrado ?? "Não localizado no documento" }),
    };
  };

  return {
    numero_cnj: item(fields.numero_cnj, "CNJ não identificado — ofício pode ser anterior à Resolução CNJ 65/2008"),
    numero_oficio: item(fields.numero_oficio),
    tribunal: item(fields.tribunal),
    tipo: item(fields.tipo),
    credor_nome: item(fields.credor_nome),
    credor_cpf_cnpj: item(fields.credor_cpf_cnpj, "CPF/CNPJ do credor não explicitado no ofício"),
    devedor: item(fields.devedor),
    valor_rs: item(fields.valor_rs),
    data_transito: item(fields.data_transito),
    orgao_julgador: item(fields.orgao_julgador),
    url_verificacao_tribunal: item(
      fields.url_verificacao_tribunal,
      "URL de verificação não localizada no rodapé — ofício pode ser anterior à Resolução CNJ 234/2016"
    ),
    qrcode_tribunal: item(
      fields.qrcode_tribunal,
      "QR Code não localizado ou URL indetermin-ável — auditor humano deve conferir visualmente o rodapé"
    ),
    codigo_verificador: item(
      fields.codigo_verificador,
      "Código verificador alfanumérico não localizado — nem todo tribunal emite"
    ),
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
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
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
    max_tokens: 2000,
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
  };
}
