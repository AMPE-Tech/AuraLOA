import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const MODEL = "claude-haiku-4-5-20251001";
const PRICE_INPUT_PER_MTOK = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;

// ══════════════════════════════════════════════════════════════════════════
// Auditor Final — 3ª camada de revisão
//
// Diferença pros outros revisores:
// - Revisor Pós-Extração: valida DADOS por doc (CNJ promovido, soma bate)
// - Revisor de Consolidação: valida COERÊNCIA entre docs
// - Auditor Final (este): valida o RELATÓRIO FINAL que vai ao cliente
//
// Problemas que só esta camada pega:
//   • Incoerência narrativa (banner diz X, tabela diz Y)
//   • Campos vazando (undefined, [object Object], datas ISO cruas)
//   • Badges conflitando com conteúdo ("aprovado" + alertas críticos)
//   • Somas declaradas em KPI não batem com tabela
//   • Valores monetários formatados errado
//   • Contagem diferente entre banner e tabela
// ══════════════════════════════════════════════════════════════════════════

export type SeveridadeAuditoria = "bloqueante" | "alta" | "media" | "baixa";
export type DecisaoAuditoria = "libera_para_cliente" | "libera_com_ressalva" | "bloqueado";

export interface AchadoAuditoria {
  codigo: string;
  severidade: SeveridadeAuditoria;
  onde: string; // seção/campo/elemento
  descricao: string;
  sugestao?: string;
}

export interface ResultadoAuditoriaFinal {
  score: number; // 0-100
  decisao: DecisaoAuditoria;
  justificativa: string;
  achados: AchadoAuditoria[];
  total_achados: number;
  tokens_usados?: { input: number; output: number };
  cost_usd?: number;
  duracao_ms: number;
  checksums_deterministicos: {
    campos_sem_vazamento: boolean;
    datas_formatadas: boolean;
    contagem_banner_vs_tabela: boolean;
    soma_kpi_vs_tabela: boolean;
    badge_coerente_com_alertas: boolean;
  };
}

// ── Checks determinísticos (antes de gastar token do Haiku) ─────────────

function checkCamposSemVazamento(dto: any): { ok: boolean; achados: AchadoAuditoria[] } {
  const achados: AchadoAuditoria[] = [];
  const flatStr = JSON.stringify(dto);
  if (/"undefined"|\[object Object\]|"null"/i.test(flatStr)) {
    achados.push({
      codigo: "CAMPO_VAZANDO",
      severidade: "alta",
      onde: "DTO",
      descricao: "Campos com 'undefined', '[object Object]' ou 'null' como string — bug de renderização",
      sugestao: "Revisar conversões e defaults no render",
    });
  }
  return { ok: achados.length === 0, achados };
}

function checkDatasFormatadas(dto: any): { ok: boolean; achados: AchadoAuditoria[] } {
  const achados: AchadoAuditoria[] = [];
  const str = JSON.stringify(dto);
  // Detecta ISO datetime cru: 1999-03-19T03:00:00.000Z
  const isoMatches = str.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g) || [];
  if (isoMatches.length > 0) {
    achados.push({
      codigo: "DATA_ISO_CRUA",
      severidade: "media",
      onde: "data_transito ou datas_identificadas",
      descricao: `${isoMatches.length} data(s) em formato ISO cru (ex: ${isoMatches[0]}) — cliente vê hora inútil`,
      sugestao: "Formatar com toLocaleDateString('pt-BR') ou só a parte YYYY-MM-DD",
    });
  }
  return { ok: achados.length === 0, achados };
}

function checkContagemBannerVsTabela(dto: any): { ok: boolean; achados: AchadoAuditoria[] } {
  const achados: AchadoAuditoria[] = [];
  const benefs = dto.beneficiarios_detalhados || [];
  const cessFromBenefs = benefs.filter((b: any) => /cession/i.test(b?.tipo || "")).length;
  const cessFromBanner = dto.alerta_golpe_cessao_count ?? null;
  const cessFromMeta = dto.metadados_requisicao?.quantidade_cessionarios ?? null;

  if (cessFromBanner !== null && cessFromBanner !== cessFromBenefs) {
    achados.push({
      codigo: "CONTAGEM_BANNER_DIVERGE",
      severidade: "alta",
      onde: "banner anti-golpe vs tabela beneficiarios_detalhados",
      descricao: `Banner afirma ${cessFromBanner} cessionário(s) mas tabela lista ${cessFromBenefs}`,
      sugestao: "Alinhar contagem — banner deve refletir a tabela",
    });
  }
  if (cessFromMeta !== null && cessFromMeta !== cessFromBenefs) {
    achados.push({
      codigo: "CONTAGEM_KPI_DIVERGE",
      severidade: "media",
      onde: "KPI Metadados.quantidade_cessionarios vs tabela",
      descricao: `KPI afirma ${cessFromMeta} cessionários mas tabela lista ${cessFromBenefs}`,
      sugestao: "KPI deve refletir a tabela ou vice-versa",
    });
  }
  return { ok: achados.length === 0, achados };
}

function checkSomaKpiVsTabela(dto: any): { ok: boolean; achados: AchadoAuditoria[] } {
  const achados: AchadoAuditoria[] = [];
  const benefs = dto.beneficiarios_detalhados || [];
  if (benefs.length === 0) return { ok: true, achados };

  const meta = dto.metadados_requisicao || {};
  const somaPrincipal = benefs.reduce((a: number, b: any) => a + (Number(b?.principal) || 0), 0);
  const kpiPrincipal = Number(meta.valor_total_principal) || 0;

  if (kpiPrincipal > 0 && somaPrincipal > 0) {
    const ratio = somaPrincipal / kpiPrincipal;
    if (ratio > 1.1 || ratio < 0.9) {
      achados.push({
        codigo: "SOMA_KPI_DIVERGE",
        severidade: "alta",
        onde: "KPI Total Principal vs soma da tabela",
        descricao: `KPI declara R$ ${kpiPrincipal.toLocaleString("pt-BR")} mas soma dos beneficiários = R$ ${somaPrincipal.toLocaleString("pt-BR")} (ratio ${ratio.toFixed(2)}x)`,
        sugestao: "Ou o KPI está errado ou a tabela — cliente pagante verá contradição",
      });
    }
  }
  return { ok: achados.length === 0, achados };
}

function checkBadgeCoerenteComAlertas(dto: any): { ok: boolean; achados: AchadoAuditoria[] } {
  const achados: AchadoAuditoria[] = [];
  const validacaoExt = dto.validacao_extracao;
  if (validacaoExt && validacaoExt.score < 70) {
    const alertasAltos = (validacaoExt.alertas || []).filter(
      (a: any) => a.severidade === "alta" || a.severidade === "critica",
    ).length;
    if (alertasAltos > 0 && dto.revisor_decisao === "aprovado") {
      achados.push({
        codigo: "BADGE_APROVADO_COM_ALERTAS_ALTOS",
        severidade: "bloqueante",
        onde: "badge do revisor vs alertas pós-extração",
        descricao: `Revisor mostra 'aprovado' mas existem ${alertasAltos} alerta(s) de severidade alta/crítica no Pós-Extração (score ${validacaoExt.score}/100)`,
        sugestao: "Rebaixar badge para 'aprovado_com_ressalva' ou 'requer_revisao_humana'",
      });
    }
  }
  return { ok: achados.length === 0, achados };
}

// ── Haiku: revisor narrativo (pega o que heurística não pega) ───────────

async function auditorAI(dto: any, achadosDeterministicos: AchadoAuditoria[]): Promise<{
  achados_ai: AchadoAuditoria[];
  score: number;
  decisao: DecisaoAuditoria;
  justificativa: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
}> {
  const dtoResumo = {
    banner_anti_golpe: dto.alerta_golpe_cessao || null,
    revisor_decisao: dto.revisor_decisao,
    revisor_score: dto.revisor_score,
    validacao_extracao_score: dto.validacao_extracao?.score,
    validacao_extracao_alertas: (dto.validacao_extracao?.alertas || []).map((a: any) => ({
      codigo: a.codigo, severidade: a.severidade, descricao: a.descricao,
    })),
    identificacao: {
      tribunal: dto.tribunal, cnj: dto.numero_cnj, oficio: dto.numero_oficio,
      valor_rs: dto.valor_rs, credor: dto.credor_nome, devedor: dto.devedor,
    },
    classificacao_credito: dto.classificacao_credito,
    metadados_requisicao: dto.metadados_requisicao,
    advogados_count: (dto.advogados || []).length,
    beneficiarios_count: (dto.beneficiarios_detalhados || []).length,
    beneficiarios_amostra: (dto.beneficiarios_detalhados || []).slice(0, 3),
    achados_deterministicos_previos: achadosDeterministicos.map((a) => ({
      codigo: a.codigo, severidade: a.severidade, descricao: a.descricao,
    })),
  };

  const systemPrompt = `Você é o Auditor Final do AuraLOA. Este relatório será entregue a um investidor pagante que vai decidir se compra um crédito judicial de centenas de milhões de reais baseado nele.

Sua missão: encontrar QUALQUER incoerência, ambiguidade ou confusão que possa gerar dúvida no cliente ou que pareça amadorismo. Seja implacável, mas específico — aponte SEÇÃO e CAMPO exato.

NÃO precisa repetir achados determinísticos que você receberá; foque em incoerências narrativas, contradições entre seções, termos técnicos não-definidos, dados que "parecem bons" mas não somam, credor principal identificado mas 12 cessionários sem explicação, etc.`;

  const userPrompt = `Audite este DTO do relatório final. Retorne via tool_use:

\`\`\`json
${JSON.stringify(dtoResumo, null, 2)}
\`\`\``;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    tools: [{
      name: "auditoria_final",
      description: "Emite resultado da auditoria final",
      input_schema: {
        type: "object" as const,
        properties: {
          score: { type: "number", description: "0-100, onde 100 = relatório impecável para cliente" },
          decisao: { type: "string", enum: ["libera_para_cliente", "libera_com_ressalva", "bloqueado"] },
          justificativa: { type: "string", description: "1-2 parágrafos explicando a decisão" },
          achados: {
            type: "array",
            items: {
              type: "object",
              properties: {
                codigo: { type: "string", description: "CODIGO_EM_CAIXA_ALTA" },
                severidade: { type: "string", enum: ["bloqueante", "alta", "media", "baixa"] },
                onde: { type: "string", description: "Seção/campo específico" },
                descricao: { type: "string" },
                sugestao: { type: "string" },
              },
              required: ["codigo", "severidade", "onde", "descricao"],
            },
          },
        },
        required: ["score", "decisao", "justificativa", "achados"],
      },
    }],
    tool_choice: { type: "tool" as const, name: "auditoria_final" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Auditor AI não retornou tool_use");
  }
  const parsed = toolUse.input as any;

  const tokens_input = response.usage.input_tokens;
  const tokens_output = response.usage.output_tokens;
  const cost_usd = (tokens_input / 1_000_000) * PRICE_INPUT_PER_MTOK
    + (tokens_output / 1_000_000) * PRICE_OUTPUT_PER_MTOK;

  return {
    achados_ai: Array.isArray(parsed.achados) ? parsed.achados : [],
    score: Number(parsed.score) || 0,
    decisao: parsed.decisao as DecisaoAuditoria,
    justificativa: String(parsed.justificativa || ""),
    tokens_input, tokens_output, cost_usd,
  };
}

// ── Entry point ──────────────────────────────────────────────────────────

export async function auditarRelatorioFinal(
  dto: any,
  opts: { pularAI?: boolean } = {},
): Promise<ResultadoAuditoriaFinal> {
  const start = Date.now();

  const c1 = checkCamposSemVazamento(dto);
  const c2 = checkDatasFormatadas(dto);
  const c3 = checkContagemBannerVsTabela(dto);
  const c4 = checkSomaKpiVsTabela(dto);
  const c5 = checkBadgeCoerenteComAlertas(dto);

  const achadosDet = [...c1.achados, ...c2.achados, ...c3.achados, ...c4.achados, ...c5.achados];
  const bloqueantesDet = achadosDet.filter((a) => a.severidade === "bloqueante").length;
  const altasDet = achadosDet.filter((a) => a.severidade === "alta").length;

  if (opts.pularAI) {
    let scoreDet = 100 - bloqueantesDet * 30 - altasDet * 15 - achadosDet.filter((a) => a.severidade === "media").length * 7;
    scoreDet = Math.max(0, scoreDet);
    const decisaoDet: DecisaoAuditoria = bloqueantesDet > 0 ? "bloqueado" : (altasDet > 0 || scoreDet < 70) ? "libera_com_ressalva" : "libera_para_cliente";
    return {
      score: scoreDet,
      decisao: decisaoDet,
      justificativa: `Auditoria determinística: ${achadosDet.length} achado(s) ${bloqueantesDet} bloqueante(s) ${altasDet} alto(s)`,
      achados: achadosDet,
      total_achados: achadosDet.length,
      duracao_ms: Date.now() - start,
      checksums_deterministicos: {
        campos_sem_vazamento: c1.ok,
        datas_formatadas: c2.ok,
        contagem_banner_vs_tabela: c3.ok,
        soma_kpi_vs_tabela: c4.ok,
        badge_coerente_com_alertas: c5.ok,
      },
    };
  }

  let ai;
  try {
    ai = await auditorAI(dto, achadosDet);
  } catch (err: any) {
    let scoreDet = 100 - bloqueantesDet * 30 - altasDet * 15;
    scoreDet = Math.max(0, scoreDet);
    return {
      score: scoreDet,
      decisao: bloqueantesDet > 0 ? "bloqueado" : "libera_com_ressalva",
      justificativa: `Auditor AI indisponível (${err.message}). Score derivado só da heurística.`,
      achados: achadosDet,
      total_achados: achadosDet.length,
      duracao_ms: Date.now() - start,
      checksums_deterministicos: {
        campos_sem_vazamento: c1.ok,
        datas_formatadas: c2.ok,
        contagem_banner_vs_tabela: c3.ok,
        soma_kpi_vs_tabela: c4.ok,
        badge_coerente_com_alertas: c5.ok,
      },
    };
  }

  const todosAchados = [...achadosDet, ...ai.achados_ai];
  const bloqueantes = todosAchados.filter((a) => a.severidade === "bloqueante").length;

  // Score final = min(AI, heurística). Se AI diz OK mas heurística detectou bloqueante,
  // a heurística vence.
  let scoreFinal = ai.score;
  if (bloqueantes > 0) scoreFinal = Math.min(scoreFinal, 40);
  if (bloqueantesDet > 0) scoreFinal = Math.min(scoreFinal, 40);

  let decisaoFinal = ai.decisao;
  if (bloqueantes > 0) decisaoFinal = "bloqueado";

  return {
    score: scoreFinal,
    decisao: decisaoFinal,
    justificativa: ai.justificativa
      + (achadosDet.length > 0 ? ` [${achadosDet.length} achado(s) determinístico(s) adicionados]` : ""),
    achados: todosAchados,
    total_achados: todosAchados.length,
    tokens_usados: { input: ai.tokens_input, output: ai.tokens_output },
    cost_usd: ai.cost_usd,
    duracao_ms: Date.now() - start,
    checksums_deterministicos: {
      campos_sem_vazamento: c1.ok,
      datas_formatadas: c2.ok,
      contagem_banner_vs_tabela: c3.ok,
      soma_kpi_vs_tabela: c4.ok,
      badge_coerente_com_alertas: c5.ok,
    },
  };
}
