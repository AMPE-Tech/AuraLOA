import type { DotacaoItem, EvidenciaItem } from "../../shared/loa_types";
import { ACOES_PRECATORIOS_UNIAO } from "../catalog/acoes_precatorios_uniao";
import { EvidencePack } from "./evidence_pack";

const ORCAMENTO_SPARQL_ENDPOINT = "http://orcamento.dados.gov.br/sparql";
const SIOP_SPARQL_ENDPOINT = "http://www1.siop.planejamento.gov.br/sparql/";

function buildSparqlQuery(anoExercicio: number, codigosAcao: string[]): string {
  const filterValues = codigosAcao.map(c => `"${c}"`).join(", ");
  return `
    PREFIX loa: <http://orcamento.dados.gov.br/id/2016/VocabularioOrcamento#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?codAcao ?descAcao
      (SUM(?valInicial) AS ?dotacao_inicial)
      (SUM(?valAtual) AS ?dotacao_atual)
    WHERE {
      GRAPH <http://orcamento.dados.gov.br/${anoExercicio}/> {
        ?i loa:temAcao ?acao .
        ?acao loa:codigo ?codAcao .
        ?acao rdfs:label ?descAcao .
        ?i loa:valorDotacaoInicial ?valInicial .
        OPTIONAL { ?i loa:valorLeiMaisCredito ?valAtual . }
        FILTER(?codAcao IN (${filterValues}))
      }
    }
    GROUP BY ?codAcao ?descAcao
  `.trim();
}

function buildSiopSparqlQuery(anoExercicio: number, codigoAcao: string): string {
  return `
    PREFIX loa: <http://orcamento.dados.gov.br/resource/id/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX prop: <http://orcamento.dados.gov.br/ontology/property/>

    SELECT ?dotacaoInicial ?dotacaoAtual ?descricao
    WHERE {
      ?item prop:exercicio "${anoExercicio}" .
      ?item prop:codigoAcao "${codigoAcao}" .
      OPTIONAL { ?item prop:dotacaoInicial ?dotacaoInicial }
      OPTIONAL { ?item prop:dotacaoAtual ?dotacaoAtual }
      OPTIONAL { ?item rdfs:label ?descricao }
    }
    LIMIT 100
  `.trim();
}

async function trySparqlEndpoint(
  endpoint: string,
  query: string,
  evidencePack: EvidencePack,
  label: string
): Promise<{ ok: boolean; data: any; rawText: string }> {
  try {
    const params = new URLSearchParams({ query, format: "application/sparql-results+json" });
    const url = `${endpoint}?${params.toString()}`;
    evidencePack.log(`querying ${label} SPARQL`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "AuraLOA/1.0 (Pesquisa Orcamentaria)",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      evidencePack.log(`${label} SPARQL returned status=${response.status}`);
      return { ok: false, data: null, rawText: "" };
    }

    const rawText = await response.text();
    try {
      const data = JSON.parse(rawText);
      return { ok: true, data, rawText };
    } catch {
      evidencePack.log(`${label} SPARQL returned non-JSON response`);
      return { ok: false, data: null, rawText };
    }
  } catch (error: any) {
    evidencePack.log(`${label} SPARQL error: ${error.message}`);
    return { ok: false, data: null, rawText: "" };
  }
}

export async function fetchDotacaoFromSIOP(
  anoExercicio: number,
  evidencePack: EvidencePack
): Promise<DotacaoItem[]> {
  const results: DotacaoItem[] = [];
  const codigosAcao = ACOES_PRECATORIOS_UNIAO.map(a => a.codigo_acao);

  evidencePack.log(`start fetching dotacao data year=${anoExercicio}`);

  const orcamentoQuery = buildSparqlQuery(anoExercicio, codigosAcao);
  const orcResult = await trySparqlEndpoint(
    ORCAMENTO_SPARQL_ENDPOINT,
    orcamentoQuery,
    evidencePack,
    "orcamento.dados.gov.br"
  );

  if (orcResult.ok && orcResult.data?.results?.bindings?.length > 0) {
    const saved = evidencePack.saveRawPayload(
      `dotacao_orcamento_sparql_${anoExercicio}.json`,
      orcResult.rawText
    );

    const bindings = orcResult.data.results.bindings;
    const found = new Set<string>();

    for (const binding of bindings) {
      const codAcao = binding.codAcao?.value;
      if (!codAcao) continue;
      found.add(codAcao);

      const dotInicial = binding.dotacao_inicial?.value ? parseFloat(binding.dotacao_inicial.value) : null;
      const dotAtual = binding.dotacao_atual?.value ? parseFloat(binding.dotacao_atual.value) : null;
      const desc = binding.descAcao?.value || ACOES_PRECATORIOS_UNIAO.find(a => a.codigo_acao === codAcao)?.descricao || "";

      results.push({
        codigo_acao: codAcao,
        descricao_acao: desc,
        dotacao_inicial: dotInicial,
        dotacao_atual: dotAtual || dotInicial,
        status: (dotInicial !== null || dotAtual !== null) ? "OK" : "PARCIAL",
        observacoes: `Dados obtidos via SPARQL orcamento.dados.gov.br. Exercicio ${anoExercicio}.`,
        evidencias: [{
          source_name: "Orcamento Dados Gov BR SPARQL",
          source_url: ORCAMENTO_SPARQL_ENDPOINT,
          captured_at_iso: new Date().toISOString(),
          raw_payload_sha256: saved.sha256,
          raw_payload_path: saved.path,
        }],
      });

      evidencePack.log(`fetched dotacao action=${codAcao} dotInicial=${dotInicial} dotAtual=${dotAtual}`);
    }

    for (const acao of ACOES_PRECATORIOS_UNIAO) {
      if (!found.has(acao.codigo_acao)) {
        results.push({
          codigo_acao: acao.codigo_acao,
          descricao_acao: acao.descricao,
          dotacao_inicial: null,
          dotacao_atual: null,
          status: "NAO_LOCALIZADO",
          observacoes: `Acao ${acao.codigo_acao} nao encontrada no SPARQL para exercicio ${anoExercicio}.`,
          evidencias: [{
            source_name: "Orcamento Dados Gov BR SPARQL",
            source_url: ORCAMENTO_SPARQL_ENDPOINT,
            captured_at_iso: new Date().toISOString(),
            raw_payload_sha256: saved.sha256,
            raw_payload_path: saved.path,
          }],
        });
      }
    }

    return results;
  }

  if (anoExercicio > 2016) {
    evidencePack.log(`orcamento.dados.gov.br has data only up to ~2016, year ${anoExercicio} not available in public SPARQL`);
  }
  evidencePack.log(`trying SIOP SPARQL fallback for ${anoExercicio}`);

  for (const acao of ACOES_PRECATORIOS_UNIAO) {
    const siopQuery = buildSiopSparqlQuery(anoExercicio, acao.codigo_acao);
    const siopResult = await trySparqlEndpoint(
      SIOP_SPARQL_ENDPOINT,
      siopQuery,
      evidencePack,
      `SIOP(${acao.codigo_acao})`
    );

    if (siopResult.ok && siopResult.data?.results?.bindings?.length > 0) {
      const saved = evidencePack.saveRawPayload(
        `dotacao_siop_${acao.codigo_acao}.json`,
        siopResult.rawText
      );

      const bindings = siopResult.data.results.bindings;
      let dotacaoInicial = 0;
      let dotacaoAtual = 0;

      for (const binding of bindings) {
        if (binding.dotacaoInicial?.value) dotacaoInicial += parseFloat(binding.dotacaoInicial.value) || 0;
        if (binding.dotacaoAtual?.value) dotacaoAtual += parseFloat(binding.dotacaoAtual.value) || 0;
      }

      results.push({
        codigo_acao: acao.codigo_acao,
        descricao_acao: acao.descricao,
        dotacao_inicial: dotacaoInicial || null,
        dotacao_atual: dotacaoAtual || null,
        status: (dotacaoAtual > 0 || dotacaoInicial > 0) ? "OK" : "PARCIAL",
        observacoes: `Dados obtidos via SIOP SPARQL. ${bindings.length} registros.`,
        evidencias: [{
          source_name: "SIOP SPARQL Endpoint",
          source_url: SIOP_SPARQL_ENDPOINT,
          captured_at_iso: new Date().toISOString(),
          raw_payload_sha256: saved.sha256,
          raw_payload_path: saved.path,
        }],
      });

      evidencePack.log(`fetched dotacao via SIOP action=${acao.codigo_acao} records=${bindings.length}`);
    } else {
      const reason = anoExercicio > 2016
        ? `Dados de dotacao indisponiveis para ${anoExercicio}. O endpoint publico orcamento.dados.gov.br contem dados ate ~2016. O SIOP SPARQL (www1.siop.planejamento.gov.br) esta bloqueado por firewall para acessos externos. Para dados de dotacao de anos recentes, consulte o SIOP Acesso Publico manualmente.`
        : `Nenhum dado encontrado para acao ${acao.codigo_acao} no exercicio ${anoExercicio} em nenhum endpoint SPARQL disponivel.`;

      results.push({
        codigo_acao: acao.codigo_acao,
        descricao_acao: acao.descricao,
        dotacao_inicial: null,
        dotacao_atual: null,
        status: "PARCIAL",
        observacoes: reason,
        evidencias: [{
          source_name: "SPARQL Endpoints",
          source_url: ORCAMENTO_SPARQL_ENDPOINT,
          captured_at_iso: new Date().toISOString(),
          raw_payload_sha256: null,
          raw_payload_path: null,
        }],
      });
    }
  }

  return results;
}
