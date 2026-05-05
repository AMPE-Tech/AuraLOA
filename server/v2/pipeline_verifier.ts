import { readFileSync } from "fs";
import { createHash } from "crypto";
import { resolve } from "path";
import { fetchPrecatorioByNumero } from "../services/estoque_datajud";
import { enrichContacts } from "../services/contact_enrichment";

// ── Tipos ─────────────────────────────────────────────────────────────────

export type FaseStatus = "ok" | "nao_localizado" | "skipped" | "erro" | "parcial";
export type Confianca = "alta" | "media" | "baixa" | "nenhuma";

export type StatusInscricaoLOA =
  | "INSCRITO_LOA_VIGENTE"             // LOA 2026 — credor confiante
  | "INSCRITO_LOA_ANTERIOR"            // 2024/2025 — F4 vai verificar se foi pago
  | "NAO_INSCRITO_PRECATORIO_EXPEDIDO" // OPORTUNIDADE ALTA
  | "PRE_OFICIO_EM_EXECUCAO"           // OPORTUNIDADE MÁXIMA
  | "NAO_LOCALIZADO";                  // insuficiente

export interface FaseResult {
  fase: string;
  status: FaseStatus;
  confianca: Confianca;
  fontes: string[];
  evidencia_hash: string | null;
  duracao_ms: number;
  timestamp: string;
  motivo?: string;
  dados: Record<string, unknown> | null;
}

function hashJson(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

function normalizeText(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── F1 — DataJud CNJ ─────────────────────────────────────────────────────

export async function faseF1DataJud(
  cnj: string | null,
  numeroOficio: string | null,
): Promise<FaseResult> {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  if (!cnj) {
    return {
      fase: "F1_datajud", status: "skipped", confianca: "nenhuma",
      motivo: "CNJ não foi extraído do documento",
      fontes: [], evidencia_hash: null,
      duracao_ms: Date.now() - start, timestamp, dados: null,
    };
  }

  try {
    const r = await fetchPrecatorioByNumero(cnj, numeroOficio ?? "", undefined);
    const evidencia_hash = hashJson(r);

    return {
      fase: "F1_datajud",
      status: r.encontrado ? "ok" : "nao_localizado",
      confianca: r.encontrado ? "alta" : "baixa",
      fontes: [
        r.tribunal_alias
          ? `datajud:api-publica.datajud.cnj.jus.br/api_publica_${r.tribunal_alias}`
          : "datajud:api-publica.datajud.cnj.jus.br",
      ],
      evidencia_hash,
      duracao_ms: Date.now() - start,
      timestamp,
      dados: {
        encontrado: r.encontrado,
        tribunal: r.tribunal,
        tribunal_alias: r.tribunal_alias,
        tipo: r.tipo,
        classe_nome: r.classe_nome,
        situacao: r.situacao,
        valor_causa: r.valor_causa,
        data_ajuizamento: r.data_ajuizamento,
        data_ultima_atualizacao: r.data_ultima_atualizacao,
        total_movimentos: r.total_movimentos,
        orgao_julgador: r.orgao_julgador,
        pagamento_pendente: r.pagamento_pendente,
        tem_baixa: r.tem_baixa,
        tem_pagamento: r.tem_pagamento,
        url_consulta: r.url_consulta,
        sha256_datajud: r.sha256_evidencia,
        movimentos: r.movimentos ?? [],
      },
    };
  } catch (err: any) {
    return {
      fase: "F1_datajud", status: "erro", confianca: "nenhuma",
      motivo: err.message || "Erro desconhecido",
      fontes: [], evidencia_hash: null,
      duracao_ms: Date.now() - start, timestamp, dados: null,
    };
  }
}

// Detecta se processo já teve ofício requisitório expedido (F2 usa esse sinal)
function oficioExpedidoNosMovimentos(movimentos: any[]): boolean {
  if (!Array.isArray(movimentos) || movimentos.length === 0) return false;
  const termos = [
    "ofício requisitório",
    "oficio requisitorio",
    "requisição de pagamento",
    "requisicao de pagamento",
    "expedição de precatório",
    "expedicao de precatorio",
    "expedido precatório",
    "expedido precatorio",
    "precatório expedido",
    "precatorio expedido",
    "requisitório expedido",
  ];
  return movimentos.some((m) => {
    const nome = normalizeText(String(m?.nome || ""));
    return termos.some((t) => nome.includes(normalizeText(t)));
  });
}

// ── F2 — LOA CSV lookup com classificação multi-status ────────────────────

interface LOARegistro {
  uo_cadastradora_codigo: string;
  uo_cadastradora_nome: string;
  uo_devedora_codigo: string;
  uo_devedora_nome: string;
  ano: number;
  precatorio: string;
  tipo_causa: string;
  valor_rs: number;
}

let loaCache: LOARegistro[] | null = null;

function loadLOACSV(): LOARegistro[] {
  if (loaCache) return loaCache;
  const path = resolve(process.cwd(), "data", "precatorios_extraidos.csv");
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/).slice(1);
  const out: LOARegistro[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const c = line.split(";");
    if (c.length < 8) continue;
    out.push({
      uo_cadastradora_codigo: (c[0] || "").trim(),
      uo_cadastradora_nome: (c[1] || "").trim(),
      uo_devedora_codigo: (c[2] || "").trim(),
      uo_devedora_nome: (c[3] || "").trim(),
      ano: parseInt(c[4], 10) || 0,
      precatorio: (c[5] || "").trim(),
      tipo_causa: (c[6] || "").trim(),
      valor_rs: parseFloat(c[7]) || 0,
    });
  }
  loaCache = out;
  console.log(`[V2 LOA CSV] ${out.length} registros carregados em memória.`);
  return out;
}

function devedorMatch(loaDevedor: string, queryDevedor: string): boolean {
  const a = normalizeText(loaDevedor);
  const b = normalizeText(queryDevedor);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tokensA = a.split(" ").filter((t) => t.length > 3);
  const tokensB = b.split(" ").filter((t) => t.length > 3);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  const intersect = tokensA.filter((t) => tokensB.includes(t));
  return intersect.length >= Math.min(2, Math.min(tokensA.length, tokensB.length));
}

function classificarOportunidade(
  status: StatusInscricaoLOA,
): { oportunidade_score: number; recomendacao_desagio: string; justificativa: string } {
  switch (status) {
    case "INSCRITO_LOA_VIGENTE":
      return {
        oportunidade_score: 30,
        recomendacao_desagio: "5-15%",
        justificativa:
          "Precatório inscrito na LOA 2026. Pagamento programado para exercício seguinte — credor tem alta expectativa de recebimento, aceita pouco desconto.",
      };
    case "INSCRITO_LOA_ANTERIOR":
      return {
        oportunidade_score: 50,
        recomendacao_desagio: "10-25%",
        justificativa:
          "Precatório inscrito em LOA de exercício anterior — verificar na F4 se já foi pago. Se ainda pendente, há atraso orçamentário e deságio aumenta.",
      };
    case "NAO_INSCRITO_PRECATORIO_EXPEDIDO":
      return {
        oportunidade_score: 85,
        recomendacao_desagio: "30-50%",
        justificativa:
          "Ofício requisitório expedido mas crédito não inscrito em LOA 2024/2025/2026. Credor sem garantia de pagamento no próximo exercício → aceita desconto maior.",
      };
    case "PRE_OFICIO_EM_EXECUCAO":
      return {
        oportunidade_score: 95,
        recomendacao_desagio: "40-60%",
        justificativa:
          "Processo em fase de cumprimento/execução mas ofício requisitório ainda não expedido. Longo caminho até o pagamento → oportunidade máxima de deságio.",
      };
    case "NAO_LOCALIZADO":
      return {
        oportunidade_score: 0,
        recomendacao_desagio: "indeterminado",
        justificativa:
          "Dados insuficientes para classificar. Executar F5 (PJe) e revisão manual.",
      };
  }
}

export async function faseF2LOACSV(input: {
  devedor: string | null;
  valor_rs: number | null;
  movimentos_f1?: any[];
  f1_encontrou_processo?: boolean;
}): Promise<FaseResult> {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const { devedor, valor_rs, movimentos_f1, f1_encontrou_processo } = input;

  if (!devedor && !valor_rs) {
    return {
      fase: "F2_loa_csv", status: "skipped", confianca: "nenhuma",
      motivo: "Sem devedor nem valor extraídos — impossível fazer lookup na LOA",
      fontes: [], evidencia_hash: null,
      duracao_ms: Date.now() - start, timestamp, dados: null,
    };
  }

  let registros: LOARegistro[];
  try {
    registros = loadLOACSV();
  } catch (err: any) {
    return {
      fase: "F2_loa_csv", status: "erro", confianca: "nenhuma",
      motivo: `Falha ao carregar CSV LOA: ${err.message}`,
      fontes: [], evidencia_hash: null,
      duracao_ms: Date.now() - start, timestamp, dados: null,
    };
  }

  const valorMin = valor_rs ? valor_rs * 0.95 : 0;
  const valorMax = valor_rs ? valor_rs * 1.05 : Infinity;

  // Busca em TODOS os anos disponíveis (2024-2026)
  const candidatos = registros
    .filter((r) => {
      const devOk = !devedor || devedorMatch(r.uo_devedora_nome, devedor);
      const valorOk = !valor_rs || (r.valor_rs >= valorMin && r.valor_rs <= valorMax);
      return devOk && valorOk;
    })
    .slice(0, 20);

  // Classificação multi-status
  let status_inscricao_loa: StatusInscricaoLOA;
  let ano_inscricao: number | null = null;

  if (candidatos.length > 0) {
    const anos = candidatos.map((c) => c.ano);
    const maxAno = Math.max(...anos);
    ano_inscricao = maxAno;
    if (maxAno >= 2026) {
      status_inscricao_loa = "INSCRITO_LOA_VIGENTE";
    } else {
      status_inscricao_loa = "INSCRITO_LOA_ANTERIOR";
    }
  } else {
    // Não está em LOA 2024-2026 → analisar F1
    const oficioExpedido = oficioExpedidoNosMovimentos(movimentos_f1 ?? []);
    if (oficioExpedido) {
      status_inscricao_loa = "NAO_INSCRITO_PRECATORIO_EXPEDIDO";
    } else if (f1_encontrou_processo) {
      status_inscricao_loa = "PRE_OFICIO_EM_EXECUCAO";
    } else {
      status_inscricao_loa = "NAO_LOCALIZADO";
    }
  }

  const oportunidade = classificarOportunidade(status_inscricao_loa);
  const totalNoCSV = registros.length;
  const hash = hashJson({ total: candidatos.length, status_inscricao_loa, ano_inscricao });

  const confianca: Confianca =
    candidatos.length === 1 ? "alta" :
    candidatos.length > 1 && candidatos.length <= 5 ? "media" :
    candidatos.length > 5 ? "baixa" :
    status_inscricao_loa === "NAO_LOCALIZADO" ? "nenhuma" : "media";

  const statusFase: FaseStatus =
    candidatos.length === 0 && status_inscricao_loa === "NAO_LOCALIZADO" ? "nao_localizado" :
    candidatos.length > 5 ? "parcial" : "ok";

  return {
    fase: "F2_loa_csv",
    status: statusFase,
    confianca,
    fontes: [`data/precatorios_extraidos.csv (LOA 2024-2026, ${totalNoCSV} registros)`],
    evidencia_hash: hash,
    duracao_ms: Date.now() - start,
    timestamp,
    dados: {
      status_inscricao_loa,
      ano_inscricao,
      oportunidade_score: oportunidade.oportunidade_score,
      recomendacao_desagio: oportunidade.recomendacao_desagio,
      justificativa: oportunidade.justificativa,
      total_candidatos: candidatos.length,
      total_no_csv: totalNoCSV,
      filtro_valor: valor_rs ? { min: valorMin, max: valorMax } : null,
      filtro_devedor: devedor,
      anos_cobertos: [2024, 2025, 2026],
      candidatos: candidatos.slice(0, 10).map((r) => ({
        ano: r.ano,
        precatorio: r.precatorio,
        uo_devedora: r.uo_devedora_nome,
        uo_cadastradora: r.uo_cadastradora_nome,
        tipo_causa: r.tipo_causa,
        valor_rs: r.valor_rs,
      })),
    },
  };
}

// ── F3 — Contatos (BrasilAPI + CNPJ.ws + Google CSE via contact_enrichment) ─

export async function faseF3Contatos(
  credor_cpf_cnpj: string | null,
  credor_nome: string | null,
): Promise<FaseResult> {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  const digits = (credor_cpf_cnpj || "").replace(/\D/g, "");
  const isCNPJ = digits.length === 14;
  const isCPF = digits.length === 11;

  if (!isCNPJ && !isCPF) {
    return {
      fase: "F3_contatos", status: "skipped", confianca: "nenhuma",
      motivo: "Sem CPF/CNPJ extraído do documento — F3 precisa pelo menos um identificador",
      fontes: [], evidencia_hash: null,
      duracao_ms: Date.now() - start, timestamp, dados: null,
    };
  }

  if (isCPF) {
    return {
      fase: "F3_contatos", status: "skipped", confianca: "nenhuma",
      motivo: `Credor é pessoa física (CPF ${credor_cpf_cnpj}). Enriquecimento de sócios via QSA só se aplica a PJ. Google CSE por nome pode rodar em versão futura.`,
      fontes: [], evidencia_hash: null,
      duracao_ms: Date.now() - start, timestamp, dados: { credor_cpf_cnpj, credor_nome, tipo_pessoa: "PF" },
    };
  }

  try {
    const r = await enrichContacts({
      cnpj: digits,
      razao_social: credor_nome ?? undefined,
    });
    const hash = hashJson(r);

    const confianca: Confianca =
      r.score_cobertura >= 70 ? "alta" :
      r.score_cobertura >= 30 ? "media" :
      r.total_pessoas > 0 ? "baixa" : "nenhuma";

    return {
      fase: "F3_contatos",
      status: r.total_com_contato > 0 ? "ok" : r.total_pessoas > 0 ? "parcial" : "nao_localizado",
      confianca,
      fontes: [
        "brasilapi.com.br/api/cnpj/v1",
        "publica.cnpj.ws/cnpj",
        "customsearch.googleapis.com (Google CSE)",
      ],
      evidencia_hash: hash,
      duracao_ms: Date.now() - start,
      timestamp,
      dados: {
        cnpj: r.cnpj,
        razao_social: r.razao_social,
        total_pessoas: r.total_pessoas,
        total_com_contato: r.total_com_contato,
        score_cobertura: r.score_cobertura,
        socios: r.socios,
        advogados: r.advogados,
        alertas: r.alertas,
      },
    };
  } catch (err: any) {
    return {
      fase: "F3_contatos", status: "erro", confianca: "nenhuma",
      motivo: err.message || "Erro no enrichContacts",
      fontes: [], evidencia_hash: null,
      duracao_ms: Date.now() - start, timestamp, dados: null,
    };
  }
}

// ── Orquestrador — F1 → (F2 || F3) em paralelo ────────────────────────────

export interface PipelineVerifierInput {
  analise_id: string;
  numero_cnj: string | null;
  numero_oficio: string | null;
  devedor: string | null;
  valor_rs: number | null;
  credor_cpf_cnpj: string | null;
  credor_nome: string | null;
}

export interface PipelineVerifierResult {
  fases: {
    f1_datajud: FaseResult;
    f2_loa_csv: FaseResult;
    f3_contatos: FaseResult;
  };
  duracao_total_ms: number;
}

export async function runPipelineVerifier(
  input: PipelineVerifierInput,
): Promise<PipelineVerifierResult> {
  const start = Date.now();

  // F1 primeiro — F2 depende dos movimentos de F1
  const f1 = await faseF1DataJud(input.numero_cnj, input.numero_oficio);
  const f1Dados = (f1.dados as any) ?? {};

  // F2 e F3 em paralelo
  const [f2, f3] = await Promise.all([
    faseF2LOACSV({
      devedor: input.devedor,
      valor_rs: input.valor_rs,
      movimentos_f1: f1Dados.movimentos ?? [],
      f1_encontrou_processo: f1Dados.encontrado === true,
    }),
    faseF3Contatos(input.credor_cpf_cnpj, input.credor_nome),
  ]);

  return {
    fases: { f1_datajud: f1, f2_loa_csv: f2, f3_contatos: f3 },
    duracao_total_ms: Date.now() - start,
  };
}
