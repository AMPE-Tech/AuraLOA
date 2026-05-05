import type { ExtractedFields } from "./field_extractor";

// ══════════════════════════════════════════════════════════════════════════
// Revisor Pós-Extração — valida que o Haiku fez o trabalho direito
// Executado ANTES da consolidação para cada documento individualmente.
//
// Regra (Marcos 23/04/2026): NÃO bloqueia pipeline. Apenas sinaliza score
// + alertas. Se score < 60, recomenda re-extração com prompt reforçado.
// ══════════════════════════════════════════════════════════════════════════

export interface AlertaExtracao {
  codigo: string;
  severidade: "alta" | "media" | "baixa";
  campo?: string;
  descricao: string;
  sugestao?: string;
}

export interface ValidacaoExtracaoResult {
  score: number; // 0-100
  alertas: AlertaExtracao[];
  checksums: {
    cnj_promovido: boolean;
    oficio_promovido: boolean;
    valor_coerente: boolean;
    sem_duplicatas: boolean;
    classificacao_completa: boolean;
    credor_presente: boolean;
    tribunal_presente: boolean;
  };
  recomenda_reextrair: boolean;
  total_alertas: number;
}

function fmtReais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function revisarPosExtracao(fields: ExtractedFields): ValidacaoExtracaoResult {
  const alertas: AlertaExtracao[] = [];
  let score = 100;

  const processos = fields.processos_identificados ?? [];
  const docs = fields.documentos_identificados ?? [];
  const benefs = fields.beneficiarios_detalhados ?? [];
  const classif = fields.classificacao_credito ?? [];

  // ── Check 1 — Promotor de CNJ ────────────────────────────────────────
  const temAcaoOriginaria = processos.some((p: any) => /origin[aá]ria/i.test(p?.tipo || ""));
  const temCnj20 = processos.some((p: any) => p?.formato === "cnj-20");
  const devePromoverCnj = temAcaoOriginaria || temCnj20;
  const cnj_promovido = !(devePromoverCnj && !fields.numero_cnj);
  if (!cnj_promovido) {
    const cnjDisponivel = processos.find((p: any) => p?.numero)?.numero;
    alertas.push({
      codigo: "CNJ_NAO_PROMOVIDO",
      severidade: "alta",
      campo: "numero_cnj",
      descricao: `processos_identificados contém CNJ válido mas campo principal numero_cnj ficou NULL. CNJ disponível: ${cnjDisponivel || "—"}`,
      sugestao: "Promotor de campos falhou. Considerar re-extração.",
    });
    score -= 15;
  }

  // ── Check 2 — Promotor de Nº Ofício ──────────────────────────────────
  const docsOficio = docs.filter((d: any) => /numero_requisicao|numero_oficio|oficio/i.test(d?.tipo || ""));
  const oficio_promovido = !(docsOficio.length > 0 && !fields.numero_oficio);
  if (!oficio_promovido) {
    alertas.push({
      codigo: "OFICIO_NAO_PROMOVIDO",
      severidade: "alta",
      campo: "numero_oficio",
      descricao: `documentos_identificados contém ${docsOficio.length} número(s) de requisição mas numero_oficio ficou NULL. Primeiro: ${docsOficio[0]?.valor || "—"}`,
      sugestao: "Promotor de campos falhou. Considerar re-extração.",
    });
    score -= 10;
  }

  // ── Check 3 — Coerência de valor (CRÍTICO — detecta duplicação) ──────
  let valor_coerente = true;
  if (benefs.length > 0 && fields.valor_rs && Number(fields.valor_rs) > 0) {
    const somaTotais = benefs.reduce((acc, b: any) => acc + (Number(b?.total) || 0), 0);
    const valorRs = Number(fields.valor_rs);
    const ratio = somaTotais / valorRs;
    // Soma dos totais dos beneficiários deveria ≈ valor_rs (entre 0.8x e 1.2x)
    if (ratio > 1.3 || ratio < 0.7) {
      valor_coerente = false;
      alertas.push({
        codigo: "VALOR_INCOERENTE",
        severidade: "alta",
        campo: "valor_rs / beneficiarios_detalhados",
        descricao: `Soma dos totais dos ${benefs.length} beneficiários = ${fmtReais(somaTotais)} mas valor_rs = ${fmtReais(valorRs)} (ratio ${ratio.toFixed(2)}x). Desvio > 30% indica duplicação ou erro de soma.`,
        sugestao: ratio > 1.5
          ? "Provável duplicação — itens foram contados 2x. Revisar beneficiarios_detalhados."
          : "Valores inconsistentes — revisar campo valor_rs ou breakdown individual.",
      });
      score -= 20;
    }
  }

  // ── Check 4 — Duplicatas em beneficiários (mesmo CNPJ aparece 2x+) ──
  const chaves = new Map<string, { nome: string; count: number; tipos: string[] }>();
  for (const b of benefs) {
    const key = ((b as any).cnpj || (b as any).nome || "").toUpperCase().trim();
    if (!key) continue;
    const prev = chaves.get(key) || { nome: (b as any).nome || key, count: 0, tipos: [] };
    prev.count++;
    prev.tipos.push((b as any).tipo || "—");
    chaves.set(key, prev);
  }
  const duplicatas = [...chaves.entries()].filter(([_, v]) => v.count > 1);
  const sem_duplicatas = duplicatas.length === 0;
  if (!sem_duplicatas) {
    alertas.push({
      codigo: "DUPLICATA_BENEFICIARIOS",
      severidade: "media",
      campo: "beneficiarios_detalhados",
      descricao: `${duplicatas.length} beneficiário(s) aparecem mais de 1x: ${duplicatas.map(([_, v]) => `${v.nome} (×${v.count}, tipos: ${v.tipos.join("/")})`).join("; ")}`,
      sugestao: "Consolidar duplicatas mantendo o tipo mais específico.",
    });
    score -= 8 * duplicatas.length;
  }

  // ── Check 5 — Classificação por ofício ───────────────────────────────
  const classificacao_completa = docsOficio.length === 0 || classif.length >= docsOficio.length;
  if (!classificacao_completa) {
    alertas.push({
      codigo: "CLASSIFICACAO_INCOMPLETA",
      severidade: "media",
      campo: "classificacao_credito",
      descricao: `${docsOficio.length} ofícios identificados mas apenas ${classif.length} classificação(ões) de crédito`,
      sugestao: "Prompt pode não ter gerado classificação por cada ofício em multi-ofício.",
    });
    score -= 8;
  }

  // ── Check 6 — Credor presente (campo essencial) ─────────────────────
  const credor_presente = !!fields.credor_nome;
  if (!credor_presente) {
    alertas.push({
      codigo: "CREDOR_AUSENTE",
      severidade: "alta",
      campo: "credor_nome",
      descricao: "credor_nome está NULL",
      sugestao: "Campo essencial — sem credor, F3 não pode enriquecer contatos",
    });
    score -= 15;
  }

  // ── Check 7 — Tribunal presente ─────────────────────────────────────
  const tribunal_presente = !!fields.tribunal;
  if (!tribunal_presente) {
    alertas.push({
      codigo: "TRIBUNAL_AUSENTE",
      severidade: "media",
      campo: "tribunal",
      descricao: "tribunal está NULL",
      sugestao: "Dedutível do CNJ — promotor deveria ter identificado",
    });
    score -= 10;
  }

  // ── Score final ──────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));
  const recomenda_reextrair = score < 60;

  return {
    score,
    alertas,
    checksums: {
      cnj_promovido,
      oficio_promovido,
      valor_coerente,
      sem_duplicatas,
      classificacao_completa,
      credor_presente,
      tribunal_presente,
    },
    recomenda_reextrair,
    total_alertas: alertas.length,
  };
}
