import type { EstoqueProcesso, EstoqueSummaryByTribunal, MovimentoProcesso } from "../../shared/loa_types";
import { EvidencePack, computeSHA256 } from "./evidence_pack";

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

const CLASSE_PRECATORIO = 1265;
const CLASSE_RPV = 1266;

export const TRIBUNAIS_FEDERAIS: { alias: string; nome: string }[] = [
  { alias: "trf1", nome: "Tribunal Regional Federal da 1ª Região" },
  { alias: "trf2", nome: "Tribunal Regional Federal da 2ª Região" },
  { alias: "trf3", nome: "Tribunal Regional Federal da 3ª Região" },
  { alias: "trf4", nome: "Tribunal Regional Federal da 4ª Região" },
  { alias: "trf5", nome: "Tribunal Regional Federal da 5ª Região" },
  { alias: "trf6", nome: "Tribunal Regional Federal da 6ª Região" },
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
  trf6: "https://processual.trf1.jus.br/consultaProcessual/processo.php",
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
  const tribunalInfo = TRIBUNAIS_FEDERAIS.find((t) => t.alias === tribunal_alias);
  const tribunalNome = tribunalInfo?.nome || tribunal_alias.toUpperCase();

  const endpoint = `${DATAJUD_BASE}/api_publica_${tribunal_alias}/_search`;
  const processos: EstoqueProcesso[] = [];
  const evidences: { source_name: string; source_url: string; captured_at_iso: string; raw_payload_sha256: string; raw_payload_path: string; bytes: number }[] = [];

  let searchAfter: (string | number)[] | undefined;
  let page = 0;
  const pageSize = Math.min(max_results, 1000);
  const maxPages = Math.ceil(max_results / pageSize);

  evidencePack.log(`DataJud: querying ${tribunal_alias} for classes [${classe_codigos.join(",")}] year=${ano_exercicio} max=${max_results}`);

  try {
    while (page < maxPages && processos.length < max_results) {
      const currentSize = Math.min(pageSize, max_results - processos.length);
      const query = buildElasticsearchQuery(classe_codigos, null, currentSize, searchAfter);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `APIKey ${DATAJUD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
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

      const data = JSON.parse(rawText);
      const hits: DataJudHit[] = data.hits?.hits || [];
      const totalValue = data.hits?.total?.value || 0;

      if (page === 0) {
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

    return {
      processos,
      summary: {
        tribunal: tribunalNome,
        tribunal_alias,
        total_processos: processos.length,
        precatorios,
        rpvs,
        provider: "datajud",
        status: processos.length > 0 ? "OK" : "PARCIAL",
        observacoes: processos.length === 0 ? "Nenhum processo encontrado para o ano" : `${processos.length} processos via DataJud`,
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
