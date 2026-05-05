/**
 * radar_defesa.ts
 * Módulo de inteligência defensiva — usa Claude AI para análise profunda
 * de cada documento e gera subsídios estruturados para a defesa.
 * Detecta: nulidades, desconformidades, inconsistências fáticas,
 * brechas probatórias e argumentos jurídicos favoráveis à defesa.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AnaliseDocumento, ResultadoCadeiaCustodia } from "./cadeia_custodia.js";
import type { ResultadoConformidade } from "./conformidade_cpp.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface SubsidioDefesa {
  categoria:
    | "NULIDADE_ABSOLUTA"
    | "NULIDADE_RELATIVA"
    | "PROVA_ILICITA"
    | "CERCEAMENTO_DEFESA"
    | "INCONSTITUCIONALIDADE"
    | "PRESCRICAO"
    | "ARGUMENTOS_MERITO"
    | "MITIGACAO_PENA";
  prioridade: "URGENTE" | "ALTA" | "MEDIA" | "BAIXA";
  titulo: string;
  descricao: string;
  fundamentoLegal: string[];
  jurisprudencia: string[];
  estrategia: string;
  documentosBase: number[];
}

export interface AnaliseDocumentoIA {
  numero: number;
  descricao: string;
  subsidiosEncontrados: SubsidioDefesa[];
  inconsistencias: string[];
  pontosForteDefesa: string[];
  alertas: string[];
  resumoIA: string;
}

export interface ResultadoRadarDefesa {
  totalDocumentosAnalisados: number;
  subsidiosCriticos: SubsidioDefesa[];
  subsidiosAlta: SubsidioDefesa[];
  subsidiosMedia: SubsidioDefesa[];
  analisesPorDocumento: AnaliseDocumentoIA[];
  recomendacoesEstrategicas: string[];
  resumoExecutivo: string;
  geradoEm: string;
}

const SYSTEM_PROMPT_DEFESA = `Você é um especialista em Direito Penal brasileiro com 20 anos de experiência na defesa criminal.
Sua missão é analisar documentos de um processo criminal e identificar TUDO que pode beneficiar a defesa.

FOCO EXCLUSIVO: Subsídios para a defesa. Você deve:
1. Identificar nulidades absolutas e relativas (CPP arts. 563-573)
2. Detectar provas ilícitas ou derivadas de provas ilícitas (CF art. 5º, LVI; CPP art. 157)
3. Encontrar cerceamento de defesa em qualquer forma
4. Verificar inconstitucionalidades na coleta de provas ou na condução do processo
5. Identificar argumentos de mérito favoráveis ao réu
6. Apontar inconsistências fáticas nos documentos da acusação
7. Verificar prescrição da pretensão punitiva e executória
8. Identificar possibilidade de desclassificação do crime
9. Detectar atenuantes e causas de diminuição de pena não reconhecidas
10. Verificar se houve violação ao sistema acusatório (CPP art. 3-A)

LEGISLAÇÃO DE REFERÊNCIA: CPP, CP, CF/88, CADH, PIDCP, Lei 11.419/2006, Lei 12.850/2013, Lei 13.964/2019.

Responda sempre em JSON estruturado conforme o schema solicitado.
Seja objetivo, técnico e sempre cite o fundamento legal específico.`;

async function analisarDocumentoComIA(
  doc: AnaliseDocumento,
  numeroCNJ: string,
  logFn: (msg: string) => void,
): Promise<AnaliseDocumentoIA> {
  if (!doc.textoExtraido || doc.textoExtraido.length < 50) {
    return {
      numero: doc.numero,
      descricao: doc.descricao,
      subsidiosEncontrados: [],
      inconsistencias: [],
      pontosForteDefesa: [],
      alertas: ["Texto insuficiente para análise — documento possivelmente escaneado sem OCR"],
      resumoIA: "Documento sem texto extraível. Análise manual recomendada.",
    };
  }

  const prompt = `Analise este documento do processo criminal ${numeroCNJ} (TJSP) e identifique subsídios para a DEFESA.

DOCUMENTO #${doc.numero}: ${doc.descricao}
DATA DE JUNTADA: ${doc.dataJuntadaRegistrada || "não informada"}
ASSINATURA DIGITAL: ${doc.temAssinaturaDigital ? "SIM" : "NÃO DETECTADA"}

TEXTO DO DOCUMENTO (primeiros 1800 caracteres):
---
${doc.textoExtraido}
---

ANOMALIAS JÁ DETECTADAS:
${doc.anomalias.length > 0 ? doc.anomalias.map((a) => `- ${a}`).join("\n") : "Nenhuma"}

Responda APENAS com JSON no formato:
{
  "subsidios": [
    {
      "categoria": "NULIDADE_ABSOLUTA|NULIDADE_RELATIVA|PROVA_ILICITA|CERCEAMENTO_DEFESA|INCONSTITUCIONALIDADE|PRESCRICAO|ARGUMENTOS_MERITO|MITIGACAO_PENA",
      "prioridade": "URGENTE|ALTA|MEDIA|BAIXA",
      "titulo": "título conciso",
      "descricao": "descrição detalhada do subsídio",
      "fundamentoLegal": ["artigo/lei 1", "artigo/lei 2"],
      "jurisprudencia": ["STF/STJ precedente 1", "STJ precedente 2"],
      "estrategia": "como usar este subsídio na defesa"
    }
  ],
  "inconsistencias": ["inconsistência 1", "inconsistência 2"],
  "pontosForteDefesa": ["ponto favorável 1", "ponto favorável 2"],
  "alertas": ["alerta 1"],
  "resumo": "resumo analítico de 2-3 frases sobre o documento sob a ótica da defesa"
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", // Haiku para volume — rápido e econômico
      max_tokens: 2000,
      system: SYSTEM_PROMPT_DEFESA,
      messages: [{ role: "user", content: prompt }],
    });

    const textoResposta = response.content[0].type === "text" ? response.content[0].text : "";

    // Extrair JSON da resposta
    const jsonMatch = textoResposta.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta da IA sem JSON válido");

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      numero: doc.numero,
      descricao: doc.descricao,
      subsidiosEncontrados: (parsed.subsidios || []).map((s: any) => ({
        ...s,
        documentosBase: [doc.numero],
      })),
      inconsistencias: parsed.inconsistencias || [],
      pontosForteDefesa: parsed.pontosForteDefesa || [],
      alertas: parsed.alertas || [],
      resumoIA: parsed.resumo || "",
    };
  } catch (err: any) {
    logFn(`[RadarDefesa] Erro na análise IA do doc ${doc.numero}: ${err.message}`);
    return {
      numero: doc.numero,
      descricao: doc.descricao,
      subsidiosEncontrados: [],
      inconsistencias: [],
      pontosForteDefesa: [],
      alertas: [`Erro na análise IA: ${err.message}`],
      resumoIA: "Análise IA não concluída — verificar manualmente.",
    };
  }
}

async function gerarResumoExecutivo(
  custódia: ResultadoCadeiaCustodia,
  conformidade: ResultadoConformidade,
  analises: AnaliseDocumentoIA[],
  numeroCNJ: string,
  logFn: (msg: string) => void,
): Promise<{ resumo: string; recomendacoes: string[] }> {
  const subsidiosUrgentes = analises.flatMap((a) => a.subsidiosEncontrados).filter((s) => s.prioridade === "URGENTE");
  const nulidadesAbs = conformidade.regras.filter((r) => !r.conformidade && r.categoria === "NULIDADE_ABSOLUTA");

  const contexto = `
PROCESSO: ${numeroCNJ} (TJSP — Criminal)
INTEGRIDADE DA CADEIA DE CUSTÓDIA: ${custódia.integridadeGeral} (Score: ${custódia.scoreIntegridade}/100)
CONFORMIDADE LEGAL: ${conformidade.scoreConformidade}/100
NULIDADES ABSOLUTAS DETECTADAS: ${nulidadesAbs.length}
SUBSÍDIOS URGENTES: ${subsidiosUrgentes.length}
TOTAL DE DOCUMENTOS: ${custódia.totalDocumentos}
LACUNAS NA NUMERAÇÃO: ${custódia.totalLacunas}

PRINCIPAIS ACHADOS:
${nulidadesAbs.map((r) => `- [NULIDADE ABSOLUTA] ${r.titulo}`).join("\n")}
${subsidiosUrgentes.slice(0, 5).map((s) => `- [URGENTE] ${s.titulo}`).join("\n")}
`.trim();

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6", // Sonnet para o resumo executivo — maior precisão
      max_tokens: 3000,
      system: SYSTEM_PROMPT_DEFESA,
      messages: [
        {
          role: "user",
          content: `Com base na due diligence completa deste processo criminal, elabore:

${contexto}

1. Um RESUMO EXECUTIVO para a Dra. Márcia (defensora) — 400-500 palavras, linguagem técnico-jurídica, focado nas oportunidades defensivas mais relevantes.

2. Uma lista de 10 RECOMENDAÇÕES ESTRATÉGICAS priorizadas por urgência e impacto.

Responda em JSON:
{
  "resumoExecutivo": "texto completo do resumo executivo",
  "recomendacoes": [
    "1. [URGENTE] Descrição da recomendação com fundamento legal",
    "2. [ALTA] ...",
    ...
  ]
}`,
        },
      ],
    });

    const textoResposta = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = textoResposta.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Sem JSON na resposta");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      resumo: parsed.resumoExecutivo || "",
      recomendacoes: parsed.recomendacoes || [],
    };
  } catch (err: any) {
    logFn(`[RadarDefesa] Erro no resumo executivo: ${err.message}`);
    return {
      resumo: `Due diligence do processo ${numeroCNJ} concluída. Foram analisados ${custódia.totalDocumentos} documentos. Score de integridade: ${custódia.scoreIntegridade}/100. Conformidade legal: ${conformidade.scoreConformidade}/100. Consultar relatório detalhado.`,
      recomendacoes: nulidadesAbs.map((r) => `[URGENTE] Arguir: ${r.titulo} — ${r.fundamentoLegal}`),
    };
  }
}

export async function executarRadarDefesa(
  custódia: ResultadoCadeiaCustodia,
  conformidade: ResultadoConformidade,
  numeroCNJ: string,
  maxDocumentosIA: number = 200, // limite de docs para análise IA (custo)
  logFn: (msg: string) => void = console.log,
): Promise<ResultadoRadarDefesa> {
  const geradoEm = new Date().toISOString();
  logFn(`[RadarDefesa] Iniciando análise IA de até ${maxDocumentosIA} documentos...`);

  if (!process.env.ANTHROPIC_API_KEY) {
    logFn(`[RadarDefesa] AVISO: ANTHROPIC_API_KEY não definida — análise IA desabilitada`);
    return {
      totalDocumentosAnalisados: 0,
      subsidiosCriticos: [],
      subsidiosAlta: [],
      subsidiosMedia: [],
      analisesPorDocumento: [],
      recomendacoesEstrategicas: ["Configure ANTHROPIC_API_KEY no .env para habilitar análise IA"],
      resumoExecutivo: "Análise IA não disponível — ANTHROPIC_API_KEY não configurada.",
      geradoEm,
    };
  }

  // Priorizar documentos com anomalias para análise IA
  const docsComAnomalias = custódia.analises.filter((a) => a.anomalias.length > 0);
  const docsSemAnomalias = custódia.analises.filter((a) => a.anomalias.length === 0);
  const docsParaIA = [
    ...docsComAnomalias,
    ...docsSemAnomalias,
  ].slice(0, maxDocumentosIA);

  logFn(`[RadarDefesa] ${docsParaIA.length} documentos selecionados para análise IA (${docsComAnomalias.length} com anomalias)`);

  // Processar em lotes de 5 para não sobrecarregar a API
  const LOTE = 5;
  const analises: AnaliseDocumentoIA[] = [];

  for (let i = 0; i < docsParaIA.length; i += LOTE) {
    const lote = docsParaIA.slice(i, i + LOTE);
    logFn(`[RadarDefesa] Lote ${Math.floor(i / LOTE) + 1}/${Math.ceil(docsParaIA.length / LOTE)}: docs ${lote.map((d) => d.numero).join(", ")}`);

    const resultados = await Promise.all(
      lote.map((doc) => analisarDocumentoComIA(doc, numeroCNJ, logFn)),
    );
    analises.push(...resultados);

    // Pequena pausa entre lotes
    if (i + LOTE < docsParaIA.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Consolidar subsídios
  const todosSubsidios = analises.flatMap((a) => a.subsidiosEncontrados);
  const subsidiosCriticos = todosSubsidios.filter((s) => s.prioridade === "URGENTE");
  const subsidiosAlta = todosSubsidios.filter((s) => s.prioridade === "ALTA");
  const subsidiosMedia = todosSubsidios.filter((s) => s.prioridade === "MEDIA");

  // Adicionar subsídios das regras de conformidade
  for (const regra of conformidade.regras) {
    if (!regra.conformidade) {
      const subsidio: SubsidioDefesa = {
        categoria: regra.categoria === "NULIDADE_ABSOLUTA" ? "NULIDADE_ABSOLUTA"
          : regra.categoria === "NULIDADE_RELATIVA" ? "NULIDADE_RELATIVA"
            : "ARGUMENTOS_MERITO",
        prioridade: regra.gravidade === "CRITICA" ? "URGENTE"
          : regra.gravidade === "ALTA" ? "ALTA"
            : regra.gravidade === "MEDIA" ? "MEDIA" : "BAIXA",
        titulo: regra.titulo,
        descricao: regra.descricao,
        fundamentoLegal: [regra.fundamentoLegal],
        jurisprudencia: regra.jurisprudencia,
        estrategia: regra.observacao,
        documentosBase: regra.documentosAfetados,
      };

      if (subsidio.prioridade === "URGENTE") subsidiosCriticos.push(subsidio);
      else if (subsidio.prioridade === "ALTA") subsidiosAlta.push(subsidio);
      else subsidiosMedia.push(subsidio);
    }
  }

  logFn(`[RadarDefesa] Gerando resumo executivo com Claude Sonnet...`);
  const { resumo, recomendacoes } = await gerarResumoExecutivo(
    custódia,
    conformidade,
    analises,
    numeroCNJ,
    logFn,
  );

  logFn(`[RadarDefesa] Concluído: ${subsidiosCriticos.length} urgentes, ${subsidiosAlta.length} altos, ${subsidiosMedia.length} médios`);

  return {
    totalDocumentosAnalisados: analises.length,
    subsidiosCriticos,
    subsidiosAlta,
    subsidiosMedia,
    analisesPorDocumento: analises,
    recomendacoesEstrategicas: recomendacoes,
    resumoExecutivo: resumo,
    geradoEm,
  };
}
