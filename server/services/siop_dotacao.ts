import type { DotacaoItem, EvidenciaItem } from "../../shared/loa_types";
import { ACOES_PRECATORIOS_UNIAO } from "../catalog/acoes_precatorios_uniao";
import { EvidencePack } from "./evidence_pack";

const SIOP_SPARQL_ENDPOINT = "http://www1.siop.planejamento.gov.br/sparql/";
const SIOP_PUBLIC_URL = "https://www1.siop.planejamento.gov.br/acessopublico/";

function buildSparqlQuery(anoExercicio: number, codigoAcao: string): string {
  return `
    PREFIX loa: <http://orcamento.dados.gov.br/resource/id/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX loa-item: <http://orcamento.dados.gov.br/resource/id/ItemDeDespesa/>
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

export async function fetchDotacaoFromSIOP(
  anoExercicio: number,
  evidencePack: EvidencePack
): Promise<DotacaoItem[]> {
  const results: DotacaoItem[] = [];

  evidencePack.log(`start fetching dotacao data year=${anoExercicio} source=SIOP SPARQL`);

  for (const acao of ACOES_PRECATORIOS_UNIAO) {
    try {
      const query = buildSparqlQuery(anoExercicio, acao.codigo_acao);
      const params = new URLSearchParams({
        query,
        format: "application/sparql-results+json",
      });

      const url = `${SIOP_SPARQL_ENDPOINT}?${params.toString()}`;
      evidencePack.log(`querying SIOP SPARQL for action=${acao.codigo_acao}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": "AuraLOA/1.0 (Pesquisa Orcamentaria)",
        },
        signal: AbortSignal.timeout(20000),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const rawText = await response.text();

        const saved = evidencePack.saveRawPayload(
          `dotacao_siop_${acao.codigo_acao}.json`,
          rawText
        );

        const evidencia: EvidenciaItem = {
          source_name: "SIOP SPARQL Endpoint",
          source_url: SIOP_SPARQL_ENDPOINT,
          captured_at_iso: new Date().toISOString(),
          raw_payload_sha256: saved.sha256,
          raw_payload_path: saved.path,
        };

        if (contentType.includes("json") || rawText.trim().startsWith("{")) {
          try {
            const sparqlResult = JSON.parse(rawText);
            const bindings = sparqlResult?.results?.bindings || [];

            if (bindings.length > 0) {
              let dotacaoInicial = 0;
              let dotacaoAtual = 0;

              for (const binding of bindings) {
                if (binding.dotacaoInicial?.value) {
                  dotacaoInicial += parseFloat(binding.dotacaoInicial.value) || 0;
                }
                if (binding.dotacaoAtual?.value) {
                  dotacaoAtual += parseFloat(binding.dotacaoAtual.value) || 0;
                }
              }

              results.push({
                codigo_acao: acao.codigo_acao,
                descricao_acao: acao.descricao,
                dotacao_inicial: dotacaoInicial || null,
                dotacao_atual: dotacaoAtual || null,
                status: dotacaoAtual > 0 ? "OK" : "PARCIAL",
                observacoes: `Dados obtidos via SIOP SPARQL. ${bindings.length} registros encontrados.`,
                evidencias: [evidencia],
              });

              evidencePack.log(
                `fetched dotacao source=SIOP action=${acao.codigo_acao} records=${bindings.length}`
              );
              continue;
            }
          } catch (parseErr: any) {
            evidencePack.log(`SPARQL JSON parse error: ${parseErr.message}`);
          }
        }

        results.push({
          codigo_acao: acao.codigo_acao,
          descricao_acao: acao.descricao,
          dotacao_inicial: null,
          dotacao_atual: null,
          status: "NAO_LOCALIZADO",
          observacoes: `SIOP SPARQL retornou resposta mas sem dados para acao ${acao.codigo_acao} no exercicio ${anoExercicio}. Pode nao estar disponivel neste endpoint.`,
          evidencias: [evidencia],
        });
      } else {
        evidencePack.log(`SIOP SPARQL returned status=${response.status} for action=${acao.codigo_acao}`);

        results.push({
          codigo_acao: acao.codigo_acao,
          descricao_acao: acao.descricao,
          dotacao_inicial: null,
          dotacao_atual: null,
          status: "PARCIAL",
          observacoes: `SIOP SPARQL indisponivel (HTTP ${response.status}). Dotacao pendente por dependencia tecnica.`,
          evidencias: [
            {
              source_name: "SIOP SPARQL Endpoint",
              source_url: SIOP_SPARQL_ENDPOINT,
              captured_at_iso: new Date().toISOString(),
              raw_payload_sha256: null,
              raw_payload_path: null,
            },
          ],
        });
      }
    } catch (error: any) {
      evidencePack.log(`SIOP fetch error for action ${acao.codigo_acao}: ${error.message}`);

      results.push({
        codigo_acao: acao.codigo_acao,
        descricao_acao: acao.descricao,
        dotacao_inicial: null,
        dotacao_atual: null,
        status: "PARCIAL",
        observacoes: `Dotacao SIOP pendente por dependencia tecnica: ${error.message}. O endpoint SPARQL pode estar indisponivel ou exigir autenticacao adicional.`,
        evidencias: [
          {
            source_name: "SIOP SPARQL Endpoint",
            source_url: SIOP_SPARQL_ENDPOINT,
            captured_at_iso: new Date().toISOString(),
            raw_payload_sha256: null,
            raw_payload_path: null,
          },
        ],
      });
    }
  }

  return results;
}
