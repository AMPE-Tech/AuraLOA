import type { EstoqueProcesso, EstoqueSummaryByTribunal, MovimentoProcesso } from "../../shared/loa_types";
import { EvidencePack, computeSHA256 } from "./evidence_pack";

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY;
if (!DATAJUD_API_KEY) {
  throw new Error("[DataJud] DATAJUD_API_KEY não definida nas variáveis de ambiente.");
}

const CLASSE_PRECATORIO = 1265;
const CLASSE_RPV = 1266;

// Tribunais confirmados sem dados de precatórios/RPV no DataJud (classes 1265/1266)
// Verificado em 29/03/2026 — HTTP 200 com total.value=0 — problema na fonte (CNJ)
// Não tentar fallback automático — registrar como PARCIAL_FONTE no summary
export const TRIBUNAIS_SEM_DADOS_DATAJUD = ["trf1", "trf2", "trf5"] as const;

export const TRIBUNAIS_FEDERAIS: { alias: string; nome: string }[] = [
  { alias: "trf1", nome: "Tribunal Regional Federal da 1ª Região" },
  { alias: "trf2", nome: "Tribunal Regional Federal da 2ª Região" },
  { alias: "trf3", nome: "Tribunal Regional Federal da 3ª Região" },
  { alias: "trf4", nome: "Tribunal Regional Federal da 4ª Região" },
  { alias: "trf5", nome: "Tribunal Regional Federal da 5ª Região" },
  { alias: "trf6", nome: "Tribunal Regional Federal da 6ª Região" },
];

export const TRIBUNAIS_SP: { alias: string; nome: string }[] = [
  { alias: "tjsp", nome: "Tribunal de Justiça do Estado de São Paulo" },
];

export const TRIBUNAIS_ESTADUAIS: { alias: string; nome: string }[] = [
  { alias: "tjrj", nome: "Tribunal de Justiça do Estado do Rio de Janeiro" },
  { alias: "tjmg", nome: "Tribunal de Justiça do Estado de Minas Gerais" },
  { alias: "tjrs", nome: "Tribunal de Justiça do Estado do Rio Grande do Sul" },
  { alias: "tjpr", nome: "Tribunal de Justiça do Estado do Paraná" },
  { alias: "tjsc", nome: "Tribunal de Justiça do Estado de Santa Catarina" },
  { alias: "tjba", nome: "Tribunal de Justiça do Estado da Bahia" },
  { alias: "tjam", nome: "Tribunal de Justiça do Estado do Amazonas" },
];

export interface DataJudFetchOptions {
  tribunal_alias: string;
  classe_codigos: number[];
  ano_exercicio: number;
  max_results: number;
  evidencePack: EvidencePack;
}

interface DataJudHit {
  _source: {
    numeroProcesso?: string;
    classe?: { codigo?: number; nome?: string };
    assuntos?: { codigo?: number; nome?: string; codigoNacional?: number }[];
    dataAjuizamento?: string;
    dataHoraUltimaAtualizacao?: string;
    orgaoJulgador?: { codigo?: number; nome?: string };
    grau?: string;
    movimentos?: { codigo?: number; nome?: string; dataHora?: string }[];
    tribunal?: string;
    nivelSigilo?: number;
    valorCausa?: number;
  };
}

function buildElasticsearchQuery(classeCodigos: number[], ano: number | null, size: number, searchAfter?: (string | number)[]) {
  const must: any[] = [
    {
      terms: {
        "classe.codigo": classeCodigos,
      },
    },
  ];

  const filter: any[] = [];
  if (ano) {
    filter.push({
      range: {
        dataAjuizamento: {
          gte: `${ano}0101000000`,
          lte: `${ano}1231235959`,
        },
      },
    });
  }

  const query: any = {
    query: {
      bool: {
        must,
        ...(filter.length > 0 ? { filter } : {}),
      },
    },
    size,
    sort: [{ dataAjuizamento: "desc" }],
    track_total_hits: true,
  };

  if (searchAfter && searchAfter.length > 0) {
    query.search_after = searchAfter;
  }

  return query;
}

const CODIGOS_BAIXA = [22, 246, 488, 861];
const CODIGOS_PAGAMENTO = [848, 12264, 12265];

const TRIBUNAL_CONSULTA_URLS: Record<string, string> = {
  trf1: "https://processual.trf1.jus.br/consultaProcessual/processo.php",
  trf2: "https://eproc.trf2.jus.br/eproc/externo_controlador.php?acao=processo_seleciona_publica",
  trf3: "https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam",
  trf4: "https://eproc.trf4.jus.br/eproc2trf4/externo_controlador.php?acao=processo_seleciona_publica",
  trf5: "https://pje.trf5.jus.br/pje/ConsultaPublica/listView.seam",
  trf6: "https://processual.trf6.jus.br/consultaProcessual/processo.php",
  tjsp: "https://esaj.tjsp.jus.br/cpopg/open.do",
  tjrj: "https://www3.tjrj.jus.br/consultaprocessual/processo.do",
  tjmg: "https://processo.tjmg.jus.br/cpopg/search.do",
  tjrs: "https://www.tjrs.jus.br/site_php/consulta/consultaProcesso.php",
  tjpr: "https://portal.tjpr.jus.br/jurisprudencia/j/12100/",
  tjsc: "https://esaj.tjsc.jus.br/cpopg/open.do",
  tjba: "https://esaj.tjba.jus.br/cpopg/open.do",
  tjam: "https://consultasaj.tjam.jus.br/cpopg/open.do",
};

const TRIBUNAL_CONSULTA_EPROC: Record<string, string> = {
  trf6: "https://eproc2g.trf6.jus.br/eproc/externo_controlador.php?acao=processo_seleciona_publica",
};

function buildConsultaUrl(tribunalAlias: string, numeroCnj: string): string | null {
  const base = TRIBUNAL_CONSULTA_URLS[tribunalAlias];
  if (!base) return null;
  if (tribunalAlias === "trf1") {
    return `${base}?proc=${numeroCnj}&secao=TRF1`;
  }
  if (tribunalAlias === "trf6") {
    return `${base}?proc=${numeroCnj}&secao=TRF6`;
  }
  // eSAJ-based tribunals (tjsp, tjsc, tjba, tjam)
  if (["tjsp", "tjsc", "tjba", "tjam"].includes(tribunalAlias)) {
    return `${base}?processo.numero=${numeroCnj}`;
  }
  if (tribunalAlias === "tjrj") {
    return `${base}?numProcesso=${numeroCnj}`;
  }
  if (tribunalAlias === "tjmg") {
    return `${base}?numeroCNJ=${numeroCnj}`;
  }
  if (tribunalAlias === "tjrs") {
    return `${base}?numProcesso=${numeroCnj}`;
  }
  return base;
}

function buildConsultaEprocUrl(tribunalAlias: string): string | null {
  return TRIBUNAL_CONSULTA_EPROC[tribunalAlias] || null;
}

function parseHitToProcesso(hit: DataJudHit, tribunalAlias: string, tribunalNome: string): EstoqueProcesso {
  const src = hit._source;
  const rawMovs = src.movimentos || [];
  const ultimoMov = rawMovs.length > 0 ? rawMovs[rawMovs.length - 1] : null;

  const movimentos: MovimentoProcesso[] = rawMovs.map((m) => ({
    codigo: m.codigo ?? null,
    nome: m.nome || "",
    data: m.dataHora || null,
  }));

  const temBaixa = rawMovs.some((m) => m.codigo !== undefined && CODIGOS_BAIXA.includes(m.codigo));
  const temPagamento = rawMovs.some((m) => m.codigo !== undefined && CODIGOS_PAGAMENTO.includes(m.codigo));
  const pagamentoPendente = !temBaixa;

  let situacao = "em_tramitacao";
  if (temBaixa) situacao = "baixado";
  else if (temPagamento) situacao = "pagamento_parcial";
  else if (rawMovs.length === 0) situacao = "desconhecido";

  const numeroCnj = src.numeroProcesso || "";

  return {
    numero_cnj: numeroCnj,
    tribunal: tribunalNome,
    tribunal_alias: tribunalAlias,
    classe_codigo: src.classe?.codigo || 0,
    classe_nome: src.classe?.nome || "",
    assuntos: (src.assuntos || []).map((a) => ({
      codigo: a.codigoNacional || a.codigo || 0,
      nome: a.nome || "",
    })),
    situacao,
    valor_causa: typeof src.valorCausa === "number" ? src.valorCausa : null,
    data_ajuizamento: src.dataAjuizamento || null,
    data_ultima_atualizacao: src.dataHoraUltimaAtualizacao || null,
    orgao_julgador: src.orgaoJulgador
      ? { codigo: src.orgaoJulgador.codigo ?? null, nome: src.orgaoJulgador.nome || "" }
      : null,
    grau: src.grau || null,
    total_movimentos: rawMovs.length,
    ultima_movimentacao: ultimoMov
      ? {
          codigo: ultimoMov.codigo ?? null,
          nome: ultimoMov.nome || "",
          data: ultimoMov.dataHora || null,
        }
      : null,
    movimentos,
    pagamento_pendente: pagamentoPendente,
    tem_baixa: temBaixa,
    tem_pagamento: temPagamento,
    url_consulta: buildConsultaUrl(tribunalAlias, numeroCnj),
    url_consulta_eproc: buildConsultaEprocUrl(tribunalAlias),
    valor_fonte: typeof src.valorCausa === "number" ? "datajud" : null,
  };
}

export async function fetchEstoqueFromDataJud(options: DataJudFetchOptions): Promise<{
  processos: EstoqueProcesso[];
  summary: EstoqueSummaryByTribunal;
  evidences: { source_name: string; source_url: string; captured_at_iso: string; raw_payload_sha256: string; raw_payload_path: string; bytes: number }[];
}> {
  const { tribunal_alias, classe_codigos, ano_exercicio, max_results, evidencePack } = options;
  const tribunalInfo = [...TRIBUNAIS_FEDERAIS, ...TRIBUNAIS_SP, ...TRIBUNAIS_ESTADUAIS].find((t) => t.alias === tribunal_alias);
  const tribunalNome = tribunalInfo?.nome || tribunal_alias.toUpperCase();

  const endpoint = `${DATAJUD_BASE}/api_publica_${tribunal_alias}/_search`;
  const processos: EstoqueProcesso[] = [];
  const evidences: { source_name: string; source_url: string; captured_at_iso: string; raw_payload_sha256: string; raw_payload_path: string; bytes: number }[] = [];
  let totalDisponivel: number | null = null;

  let searchAfter: (string | number)[] | undefined;
  let page = 0;
  const pageSize = Math.min(max_results, 1000);
  const maxPages = Math.ceil(max_results / pageSize);

  evidencePack.log(`DataJud: querying ${tribunal_alias} for classes [${classe_codigos.join(",")}] year=${ano_exercicio} max=${max_results}`);

  try {
    while (page < maxPages && processos.length < max_results) {
      const currentSize = Math.min(pageSize, max_results - processos.length);
      const query = buildElasticsearchQuery(classe_codigos, ano_exercicio, currentSize, searchAfter);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `APIKey ${DATAJUD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
        signal: AbortSignal.timeout(15000),
      });

      const captured_at_iso = new Date().toISOString();

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        evidencePack.log(`DataJud ${tribunal_alias} HTTP ${response.status}: ${errText.substring(0, 200)}`);
        return {
          processos,
          summary: {
            tribunal: tribunalNome,
            tribunal_alias,
            total_processos: 0,
            total_disponivel: null,
            precatorios: 0,
            rpvs: 0,
            provider: "datajud",
            status: "ERRO",
            observacoes: `HTTP ${response.status}: ${errText.substring(0, 100)}`,
          },
          evidences,
        };
      }

      const rawText = await response.text();
      const rawFilename = `datajud_${tribunal_alias}_page${page}.json`;
      const savedRaw = evidencePack.saveRawPayload(rawFilename, rawText);
      evidences.push({
        source_name: `DataJud ${tribunal_alias} page ${page}`,
        source_url: endpoint,
        captured_at_iso,
        raw_payload_sha256: savedRaw.sha256,
        raw_payload_path: savedRaw.path,
        bytes: rawText.length,
      });

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Resposta inválida da API DataJud (não é JSON válido). Tribunal: ${tribunal_alias}`);
      }
      const hits: DataJudHit[] = data.hits?.hits || [];
      const totalValue = data.hits?.total?.value || 0;

      if (page === 0) {
        totalDisponivel = totalValue;
        evidencePack.log(`DataJud ${tribunal_alias}: total_hits=${totalValue} (capped at ${max_results})`);
      }

      if (hits.length === 0) break;

      for (const hit of hits) {
        processos.push(parseHitToProcesso(hit, tribunal_alias, tribunalNome));
      }

      const lastHit = data.hits.hits[data.hits.hits.length - 1];
      searchAfter = lastHit?.sort;
      if (!searchAfter || searchAfter.length === 0) break;

      page++;
    }

    const precatorios = processos.filter((p) => p.classe_codigo === CLASSE_PRECATORIO).length;
    const rpvs = processos.filter((p) => p.classe_codigo === CLASSE_RPV).length;

    evidencePack.log(`DataJud ${tribunal_alias}: fetched ${processos.length} processos (${precatorios} prec, ${rpvs} RPV) in ${page + 1} pages`);

    const loadedObs = totalDisponivel && totalDisponivel > processos.length
      ? `${processos.length} de ${totalDisponivel} processos via DataJud`
      : `${processos.length} processos via DataJud`;

    return {
      processos,
      summary: {
        tribunal: tribunalNome,
        tribunal_alias,
        total_processos: processos.length,
        total_disponivel: totalDisponivel,
        precatorios,
        rpvs,
        provider: "datajud",
        status: processos.length > 0 ? "OK" : "PARCIAL",
        observacoes: processos.length === 0
          ? `Nenhum precatório/RPV (classes 1265/1266) indexado no DataJud para ${tribunal_alias.toUpperCase()} no ano ${ano_exercicio}`
          : loadedObs,
      },
      evidences,
    };
  } catch (err: any) {
    evidencePack.log(`DataJud ${tribunal_alias} error: ${err.message}`);
    return {
      processos: [],
      summary: {
        tribunal: tribunalNome,
        tribunal_alias,
        total_processos: 0,
        total_disponivel: null,
        precatorios: 0,
        rpvs: 0,
        provider: "datajud",
        status: "ERRO",
        observacoes: `Erro: ${err.message}`,
      },
      evidences,
    };
  }
}

export { CLASSE_PRECATORIO, CLASSE_RPV };

// ─── Busca por número de processo específico ──────────────────────────────────

export interface ValidacaoPreliminarResult {
  encontrado: boolean;
  numero_cnj: string;
  numero_oficio: string;
  tribunal: string;
  tribunal_alias: string;
  tipo: "PRECATORIO" | "RPV" | "DESCONHECIDO";
  situacao: string;
  grau: string | null;
  data_ajuizamento_ano: string | null;
  pagamento_pendente: boolean;
  url_consulta: string | null;
  sha256_evidencia: string;
  consultado_em: string;
  // Dados premium (retornados null no modo gratuito)
  valor_causa_locked: true;
  credor_locked: true;
  loa_status_locked: true;
}

// Mapa J=8 (Justiça Estadual): TT → alias
const TT_ESTADUAL: Record<string, string> = {
  "01": "tjac",
  "02": "tjal",
  "03": "tjap",
  "04": "tjam",
  "05": "tjba",
  "06": "tjce",
  "07": "tjdf",
  "08": "tjes",
  "09": "tjgo",
  "10": "tjma",
  "11": "tjmt",
  "12": "tjms",
  "13": "tjmg",
  "14": "tjpa",
  "15": "tjpb",
  "16": "tjpr",
  "17": "tjpe",
  "18": "tjpi",
  "19": "tjrj",
  "20": "tjrn",
  "21": "tjrs",
  "22": "tjro",
  "23": "tjrr",
  "24": "tjsc",
  "25": "tjse",
  "26": "tjsp",
  "27": "tjto",
};

function extrairTribunalDoCNJ(numeroCNJ: string): string | null {
  // Formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
  // J=4 → Federal (TRF), TT=01-06 → TRF1-TRF6
  // J=8 → Estadual, TT conforme tabela CNJ
  const partes = numeroCNJ.replace(/[^\d.]/g, "").split(".");
  if (partes.length < 5) return null;
  const j = partes[2];   // ramo da justiça
  const tt = partes[3];  // tribunal
  if (j === "4") {
    const num = parseInt(tt, 10);
    if (num >= 1 && num <= 6) return `trf${num}`;
  }
  if (j === "8") {
    return TT_ESTADUAL[tt.padStart(2, "0")] || null;
  }
  return null;
}

async function consultarTribunal(
  alias: string,
  numeroCNJNorm: string,
  numeroOficio: string,
  consultado_em: string,
): Promise<ValidacaoPreliminarResult | null> {
  const endpoint = `${DATAJUD_BASE}/api_publica_${alias}/_search`;
  const esQuery = {
    query: {
      bool: {
        should: [
          { match: { numeroProcesso: numeroCNJNorm } },
          { term: { "numeroProcesso.keyword": numeroCNJNorm } },
        ],
        minimum_should_match: 1,
      },
    },
    size: 3,
  };

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(esQuery),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    const hits: DataJudHit[] = data.hits?.hits || [];
    if (hits.length === 0) return null;

    const processo = parseHitToProcesso(hits[0], alias, alias.toUpperCase());
    const payload = JSON.stringify({ numeroCNJ: numeroCNJNorm, numeroOficio, resultado: processo, consultado_em });
    const sha256 = (await import("crypto")).createHash("sha256").update(payload).digest("hex");

    return {
      encontrado: true,
      numero_cnj: processo.numero_cnj,
      numero_oficio: numeroOficio,
      tribunal: processo.tribunal,
      tribunal_alias: alias,
      tipo: processo.classe_codigo === CLASSE_PRECATORIO ? "PRECATORIO" : processo.classe_codigo === CLASSE_RPV ? "RPV" : "DESCONHECIDO",
      situacao: processo.situacao,
      grau: processo.grau,
      data_ajuizamento_ano: processo.data_ajuizamento ? String(processo.data_ajuizamento).substring(0, 4) : null,
      pagamento_pendente: processo.pagamento_pendente,
      url_consulta: processo.url_consulta,
      sha256_evidencia: sha256,
      consultado_em,
      valor_causa_locked: true,
      credor_locked: true,
      loa_status_locked: true,
    };
  } catch {
    return null;
  }
}

export async function fetchPrecatorioByNumero(
  numeroCNJ: string,
  numeroOficio: string,
  urlDocumento?: string,
): Promise<ValidacaoPreliminarResult> {
  const consultado_em = new Date().toISOString();
  const numeroCNJNorm = numeroCNJ.trim();

  // Determina tribunal pelo número CNJ — se identificado, consulta só ele
  const tribunalAlias = extrairTribunalDoCNJ(numeroCNJNorm);
  const tribunaisParaConsultar: string[] = tribunalAlias
    ? [tribunalAlias]
    : [
        "trf1", "trf2", "trf3", "trf4", "trf5", "trf6",
        "tjsp",
        ...TRIBUNAIS_ESTADUAIS.map((t) => t.alias),
      ];

  // Consulta todos os tribunais em paralelo — tempo total = max(timeout) ~8s
  const resultados = await Promise.all(
    tribunaisParaConsultar.map((alias) =>
      consultarTribunal(alias, numeroCNJNorm, numeroOficio, consultado_em)
    )
  );

  const encontrado = resultados.find((r) => r !== null && r.encontrado);
  if (encontrado) {
    // URL do documento tem prioridade sobre a URL padrão do tribunal no DataJud
    if (urlDocumento && !encontrado.url_consulta) {
      encontrado.url_consulta = urlDocumento;
      (encontrado as any).url_origem = "documento";
    }
    return encontrado;
  }

  // TJRJ: usa numeração interna (ex: 2024.09516-4), não CNJ padrão
  // DataJud retorna 0 resultados para classes 1265/1266 no índice api_publica_tjrj
  // Fallback: retornar URL de consulta manual
  const isTJRJ = tribunalAlias === "tjrj";
  if (isTJRJ) {
    console.warn("[DataJud] TJRJ: numeração interna não suportada pelo DataJud. Retornando URL de consulta manual.");
  }

  const payload = JSON.stringify({ numeroCNJ: numeroCNJNorm, numeroOficio, encontrado: false, consultado_em });
  const sha256 = (await import("crypto")).createHash("sha256").update(payload).digest("hex");

  return {
    encontrado: false,
    numero_cnj: numeroCNJNorm,
    numero_oficio: numeroOficio,
    tribunal: isTJRJ ? "Tribunal de Justiça do Estado do Rio de Janeiro" : "—",
    tribunal_alias: isTJRJ ? "tjrj" : "—",
    tipo: "DESCONHECIDO" as const,
    situacao: isTJRJ ? "consulta_manual_necessaria" : "nao_localizado",
    grau: null,
    data_ajuizamento_ano: null,
    pagamento_pendente: false,
    url_consulta: urlDocumento || (isTJRJ ? "https://www3.tjrj.jus.br/consultaprocessual/processo.do" : null),
    ...(isTJRJ ? { observacao: "TJRJ utiliza numeração interna. Consulte diretamente o portal do tribunal." } : {}),
    ...(urlDocumento ? { url_origem: "documento" } : {}),
    sha256_evidencia: sha256,
    consultado_em,
    valor_causa_locked: true as const,
    credor_locked: true as const,
    loa_status_locked: true as const,
  };
}
