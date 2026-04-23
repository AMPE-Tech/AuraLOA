import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { ConsolidacaoResult } from "./consolidador";

const anthropic = new Anthropic();
const MODEL = "claude-haiku-4-5-20251001";
const PRICE_INPUT_PER_MTOK = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;

// ══════════════════════════════════════════════════════════════════════════
// Revisor V2 — 3 níveis (determinístico → AI com knowledge → humano)
// ══════════════════════════════════════════════════════════════════════════

export type NivelRevisor = "deterministico" | "ai_knowledge" | "humano_necessario";
export type DecisaoRevisor = "aprovado" | "aprovado_com_ressalva" | "requer_revisao_humana" | "rejeitado";

export interface AlertaRevisor {
  codigo: string;
  severidade: "baixa" | "media" | "alta" | "critica";
  campo?: string;
  descricao: string;
  sugestao?: string;
}

export interface ResultadoRevisor {
  nivel_atingido: NivelRevisor;
  decisao: DecisaoRevisor;
  score: number; // 0-100
  justificativa: string;
  alertas: AlertaRevisor[];
  knowledge_consultado?: string[]; // quando Nível 2
  tokens_usados?: { input: number; output: number };
  cost_usd?: number;
  duracao_ms: number;
}

// ── NÍVEL 1 — Determinístico (heurísticas) ────────────────────────────────

// Campos onde divergência entre docs é ESPERADA quando são do mesmo caso.
// Ex: um ofício e uma certidão do mesmo processo naturalmente terão
// natureza_documento, órgão_julgador (1º vs 2º grau), código verificador
// e decisão_resumo diferentes — não é conflito real.
const CAMPOS_CONFLITO_ESPERADO_MESMO_CASO = new Set([
  "natureza_documento",
  "orgao_julgador",
  "codigo_verificador",
  "decisao_resumo",
  "numero_cnj",         // CNJs filhos: originária + execução + recurso
  "status_processual",  // status difere por tipo de documento
]);

// Campos onde divergência é SEMPRE problema grave (valores financeiros, identificação)
const CAMPOS_CONFLITO_CRITICO = new Set([
  "valor_rs",
  "credor_cpf_cnpj",
  "credor_nome",
  "devedor",
]);

function revisorDeterministico(consolidacao: ConsolidacaoResult): {
  score: number;
  alertas: AlertaRevisor[];
} {
  const alertas: AlertaRevisor[] = [];
  let score = 100;

  const chk = consolidacao.checklist_consolidado;
  const mesmoCaso = consolidacao.provavelmente_mesmo_caso;

  // Campos essenciais que deveriam estar preenchidos
  const camposEssenciais = ["numero_cnj", "tribunal", "credor_nome", "devedor"];
  for (const campo of camposEssenciais) {
    if (!chk[campo] || chk[campo].valor === null) {
      alertas.push({
        codigo: `MISSING_${campo.toUpperCase()}`,
        severidade: "media",
        campo,
        descricao: `Campo essencial '${campo}' não foi extraído de nenhum documento`,
        sugestao: "Fontes externas (F1-F5) podem preencher",
      });
      score -= 5;
    }
  }

  // Conflitos — com whitelist de "conflito esperado"
  if (consolidacao.total_conflitos > 0) {
    for (const [campo, item] of Object.entries(chk)) {
      if (!item.conflito) continue;

      const esperadoMesmoCaso = mesmoCaso && CAMPOS_CONFLITO_ESPERADO_MESMO_CASO.has(campo);
      const critico = CAMPOS_CONFLITO_CRITICO.has(campo);

      if (esperadoMesmoCaso) {
        // Informativo, não problema — não desconta score
        alertas.push({
          codigo: "DIVERGENCIA_ESPERADA_ENTRE_DOCS",
          severidade: "baixa",
          campo,
          descricao: `Campo '${campo}' varia entre docs (esperado em ofício + certidão do mesmo caso): ${JSON.stringify(item.valores_divergentes)}`,
          sugestao: "Manter ambos os valores — cada um representa o documento de origem",
        });
      } else if (critico) {
        alertas.push({
          codigo: "CONFLITO_CRITICO",
          severidade: "critica",
          campo,
          descricao: `Campo crítico '${campo}' tem valores divergentes: ${JSON.stringify(item.valores_divergentes)}`,
          sugestao: "Revisão humana obrigatória — pode indicar documentos de casos diferentes",
        });
        score -= 25;
      } else {
        alertas.push({
          codigo: "CONFLITO_ENTRE_DOCS",
          severidade: "media",
          campo,
          descricao: `Campo '${campo}' tem valores divergentes: ${JSON.stringify(item.valores_divergentes)}`,
          sugestao: "Escalar para Nível 2 (AI) para análise contextual",
        });
        score -= 8;
      }
    }
  }

  // Partes não batem entre docs → alerta crítico
  if (!consolidacao.provavelmente_mesmo_caso) {
    alertas.push({
      codigo: "PARTES_DIVERGENTES",
      severidade: "critica",
      descricao: "Documentos têm credores/devedores diferentes — podem ser casos não relacionados",
      sugestao: "Escalar para revisão humana",
    });
    score -= 40;
  }

  // Valor muito alto/baixo (sanity check)
  const valorItem = chk["valor_rs"];
  if (valorItem?.valor != null) {
    const v = Number(valorItem.valor);
    if (isNaN(v) || v < 0) {
      alertas.push({
        codigo: "VALOR_INVALIDO",
        severidade: "alta",
        campo: "valor_rs",
        descricao: `Valor inválido: ${v}`,
      });
      score -= 15;
    } else if (v === 0) {
      alertas.push({
        codigo: "VALOR_ZERO",
        severidade: "media",
        campo: "valor_rs",
        descricao: "Valor do precatório é zero — revisar",
      });
      score -= 5;
    }
  }

  // Data do trânsito > data atual → impossível
  const dtItem = chk["data_transito"];
  if (dtItem?.valor) {
    const dt = new Date(String(dtItem.valor));
    if (!isNaN(dt.getTime()) && dt > new Date()) {
      alertas.push({
        codigo: "DATA_FUTURA",
        severidade: "alta",
        campo: "data_transito",
        descricao: `Data de trânsito em julgado no futuro: ${dtItem.valor}`,
      });
      score -= 15;
    }
  }

  // CNJs diferentes mas mesmo caso → normal (agravo + originária)
  if (consolidacao.cnjs_encontrados.length > 1 && consolidacao.provavelmente_mesmo_caso) {
    alertas.push({
      codigo: "MULTIPLOS_CNJS_MESMO_CASO",
      severidade: "baixa",
      descricao: `${consolidacao.cnjs_encontrados.length} CNJs identificados — normal em casos com recursos/execução separada`,
    });
    // não desconta score, é esperado
  }

  // Campos preenchidos vs total
  const taxaPreenchimento = consolidacao.campos_preenchidos / consolidacao.total_campos;
  if (taxaPreenchimento < 0.3) {
    alertas.push({
      codigo: "BAIXA_COBERTURA",
      severidade: "media",
      descricao: `Apenas ${consolidacao.campos_preenchidos}/${consolidacao.total_campos} campos preenchidos (${Math.round(taxaPreenchimento * 100)}%)`,
      sugestao: "Enriquecimento externo (F1-F5) é essencial",
    });
    score -= 10;
  }

  return { score: Math.max(0, Math.min(100, score)), alertas };
}

// ── NÍVEL 2 — AI com Knowledge Base ───────────────────────────────────────

const KNOWLEDGE_FILES = [
  "CLAUDE.md",
  "docs/MANUAL_MASTER_PRECATORIO.md",
];

function loadKnowledgeBase(): { content: string; loaded: string[] } {
  const parts: string[] = [];
  const loaded: string[] = [];
  for (const file of KNOWLEDGE_FILES) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf8");
      parts.push(`### ${file}\n\n${content.slice(0, 15000)}`);
      loaded.push(file);
    }
  }
  return { content: parts.join("\n\n───────────\n\n"), loaded };
}

const REVISOR_AI_PROMPT = `Você é o AGENTE REVISOR do AuraLOA — plataforma brasileira de inteligência sobre precatórios judiciais.

Sua função: analisar um lote de documentos consolidados e decidir se a consolidação é válida, precisa de ressalva, ou precisa de revisão humana.

REGRAS DE NEGÓCIO (Marcos Costa, 23/04/2026):
1. Todo documento oficial é CONTRIBUTIVO, não exclusivo.
2. CNJs diferentes com MESMAS partes = mesmo caso (ex: ação originária + agravo interno + execução).
3. Não padronização brasileira: "Ofício Requisitório" = "Requisição de Pagamento" = "OFREQ" = "AUT.YYYY.NNNNNN". Trate como sinônimos.
4. Revisão humana SÓ se NADA bater (credores/devedores totalmente diferentes, conflitos irreconciliáveis).
5. Valor 188M em principal + 47M em honorários = 235M total. Soma faz sentido. OK.
6. Sinônimos: Juiz = Magistrado; Desembargador = Ministro (conforme grau); Credor = Autor = Exequente = Beneficiário.

Você recebe:
- Resultado da consolidação (checklist + lista de conflitos + partes em comum)
- Alertas do revisor determinístico (Nível 1)

Retorne APENAS JSON:
{
  "decisao": "aprovado | aprovado_com_ressalva | requer_revisao_humana | rejeitado",
  "score": número 0-100,
  "justificativa": "explicação clara da decisão em português",
  "alertas_adicionais": [
    { "codigo": "...", "severidade": "baixa|media|alta|critica", "descricao": "...", "sugestao": "..." }
  ]
}

Responda APENAS o JSON, sem texto antes ou depois.`;

// Tool schema força JSON válido no output do Haiku (evita parse errors)
const REVISOR_TOOL = {
  name: "emitir_decisao_revisor",
  description: "Emite decisão do revisor sobre o lote consolidado",
  input_schema: {
    type: "object" as const,
    properties: {
      decisao: {
        type: "string",
        enum: ["aprovado", "aprovado_com_ressalva", "requer_revisao_humana", "rejeitado"],
        description: "Decisão final do revisor",
      },
      score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Score de qualidade da consolidação",
      },
      justificativa: {
        type: "string",
        description: "Explicação clara da decisão em português, 1-3 frases",
      },
      alertas_adicionais: {
        type: "array",
        items: {
          type: "object",
          properties: {
            codigo: { type: "string" },
            severidade: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
            descricao: { type: "string" },
            sugestao: { type: "string" },
          },
          required: ["codigo", "severidade", "descricao"],
        },
      },
    },
    required: ["decisao", "score", "justificativa"],
  },
};

async function revisorAI(
  consolidacao: ConsolidacaoResult,
  alertasN1: AlertaRevisor[],
): Promise<{
  decisao: DecisaoRevisor;
  score: number;
  justificativa: string;
  alertas_adicionais: AlertaRevisor[];
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  knowledge_loaded: string[];
}> {
  const { content: kb, loaded } = loadKnowledgeBase();

  // Compacta checklist removendo arrays grandes que não ajudam a decidir
  const chkCompacto: Record<string, any> = {};
  for (const [k, v] of Object.entries(consolidacao.checklist_consolidado)) {
    if (Array.isArray(v.valor)) {
      chkCompacto[k] = { total_items: v.valor.length, conflito: v.conflito };
    } else {
      chkCompacto[k] = {
        valor: v.valor,
        conflito: v.conflito,
        ...(v.conflito ? { divergentes: v.valores_divergentes } : {}),
      };
    }
  }

  const userContent = `KNOWLEDGE BASE (resumido):
${kb.slice(0, 8000)}

═══════════════════════════════════════
CONSOLIDAÇÃO (compactada):
═══════════════════════════════════════

${JSON.stringify({
  total_docs: consolidacao.total_docs,
  cnjs_encontrados: consolidacao.cnjs_encontrados,
  provavelmente_mesmo_caso: consolidacao.provavelmente_mesmo_caso,
  partes_em_comum: consolidacao.partes_em_comum,
  total_conflitos: consolidacao.total_conflitos,
  campos_preenchidos: `${consolidacao.campos_preenchidos}/${consolidacao.total_campos}`,
  checklist: chkCompacto,
}, null, 2)}

═══════════════════════════════════════
ALERTAS NÍVEL 1:
═══════════════════════════════════════

${JSON.stringify(alertasN1, null, 2)}

Use a ferramenta emitir_decisao_revisor para sua resposta estruturada.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: REVISOR_AI_PROMPT,
    tools: [REVISOR_TOOL],
    tool_choice: { type: "tool", name: "emitir_decisao_revisor" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUseBlock = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  if (!toolUseBlock) {
    throw new Error("Haiku não retornou bloco tool_use");
  }
  const parsed = toolUseBlock.input as any;

  const tokens_input = response.usage.input_tokens;
  const tokens_output = response.usage.output_tokens;
  const cost_usd =
    (tokens_input / 1_000_000) * PRICE_INPUT_PER_MTOK +
    (tokens_output / 1_000_000) * PRICE_OUTPUT_PER_MTOK;

  return {
    decisao: parsed.decisao as DecisaoRevisor,
    score: Number(parsed.score) || 0,
    justificativa: String(parsed.justificativa || ""),
    alertas_adicionais: Array.isArray(parsed.alertas_adicionais) ? parsed.alertas_adicionais : [],
    tokens_input,
    tokens_output,
    cost_usd,
    knowledge_loaded: loaded,
  };
}

// ── ENTRY POINT ──────────────────────────────────────────────────────────

export async function revisarConsolidacao(
  consolidacao: ConsolidacaoResult,
  opts: { forcarAI?: boolean } = {},
): Promise<ResultadoRevisor> {
  const start = Date.now();

  // Nível 1 sempre roda
  const n1 = revisorDeterministico(consolidacao);

  // Se score ≥ 70 e sem alertas críticos/altos → auto-aprovado
  // (abaixado de 80 → 70 porque agora 'conflito esperado' tem severidade baixa)
  const hasCritica = n1.alertas.some((a) => a.severidade === "critica");
  const hasAlta = n1.alertas.some((a) => a.severidade === "alta");

  if (!opts.forcarAI && n1.score >= 70 && !hasCritica && !hasAlta) {
    return {
      nivel_atingido: "deterministico",
      decisao: "aprovado",
      score: n1.score,
      justificativa: `Revisor determinístico aprovou automaticamente: score ${n1.score}/100, ${n1.alertas.length} alertas sem severidade alta/crítica`,
      alertas: n1.alertas,
      duracao_ms: Date.now() - start,
    };
  }

  // Se alerta crítico + partes divergentes → escala direto para humano
  if (hasCritica && consolidacao.provavelmente_mesmo_caso === false) {
    return {
      nivel_atingido: "humano_necessario",
      decisao: "requer_revisao_humana",
      score: n1.score,
      justificativa: "Credores/devedores totalmente diferentes entre documentos — precisa operador humano confirmar se são casos relacionados",
      alertas: n1.alertas,
      duracao_ms: Date.now() - start,
    };
  }

  // Caso contrário: Nível 2 AI com knowledge base
  try {
    const n2 = await revisorAI(consolidacao, n1.alertas);
    const todosAlertas = [...n1.alertas, ...n2.alertas_adicionais];

    return {
      nivel_atingido: "ai_knowledge",
      decisao: n2.decisao,
      score: n2.score,
      justificativa: n2.justificativa,
      alertas: todosAlertas,
      knowledge_consultado: n2.knowledge_loaded,
      tokens_usados: { input: n2.tokens_input, output: n2.tokens_output },
      cost_usd: n2.cost_usd,
      duracao_ms: Date.now() - start,
    };
  } catch (err: any) {
    // Se AI falha → escala para humano
    return {
      nivel_atingido: "humano_necessario",
      decisao: "requer_revisao_humana",
      score: n1.score,
      justificativa: `Revisor Nível 1 score ${n1.score} inconclusivo e Nível 2 (AI) falhou: ${err.message}. Escalado para humano.`,
      alertas: n1.alertas,
      duracao_ms: Date.now() - start,
    };
  }
}
