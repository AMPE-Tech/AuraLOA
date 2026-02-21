import type { ExecucaoItem, EvidenciaItem } from "../../shared/loa_types";
import { ACOES_PRECATORIOS_UNIAO } from "../catalog/acoes_precatorios_uniao";
import { EvidencePack } from "./evidence_pack";

const API_BASE_URL = "https://api.portaldatransparencia.gov.br/api-de-dados";

interface DespesaFuncionalDTO {
  ano: number;
  funcao: string;
  codigoFuncao: string;
  subfuncao: string;
  codigoSubfuncao: string;
  programa: string;
  codigoPrograma: string;
  acao: string;
  codigoAcao: string;
  empenhado: string;
  liquidado: string;
  pago: string;
}

function parseMoneyString(val: string | null | undefined): number | null {
  if (!val || val === "--" || val.trim() === "") return null;
  const cleaned = val.replace(/\./g, "").replace(",", ".").trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function fetchApiPage(
  url: string,
  apiKey: string,
  evidencePack: EvidencePack
): Promise<any[] | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "chave-api-dados": apiKey,
        Accept: "application/json",
        "User-Agent": "AuraLOA/1.0 (Pesquisa Orcamentaria)",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      evidencePack.log(`API returned status=${response.status} for url=${url}`);
      return null;
    }

    const data = await response.json();
    return Array.isArray(data) ? data : null;
  } catch (error: any) {
    evidencePack.log(`API fetch error: ${error.message}`);
    return null;
  }
}

async function fetchAllPages(
  baseUrl: string,
  apiKey: string,
  evidencePack: EvidencePack,
  maxPages: number = 10
): Promise<any[]> {
  const allItems: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${baseUrl}&pagina=${page}`;
    evidencePack.log(`fetching page=${page} url=${url}`);
    const items = await fetchApiPage(url, apiKey, evidencePack);
    if (!items || items.length === 0) break;
    allItems.push(...items);
    if (items.length < 15) break;
  }
  return allItems;
}

export async function fetchExecucaoFromTransparencia(
  anoExercicio: number,
  evidencePack: EvidencePack
): Promise<ExecucaoItem[]> {
  const results: ExecucaoItem[] = [];
  const apiKey = process.env.PORTAL_TRANSPARENCIA_API_KEY;

  evidencePack.log(`start fetching execution data year=${anoExercicio}`);

  if (apiKey) {
    evidencePack.log(`using Portal da Transparencia REST API with API key`);

    for (const acao of ACOES_PRECATORIOS_UNIAO) {
      const baseUrl = `${API_BASE_URL}/despesas/por-funcional-programatica?ano=${anoExercicio}&acao=${acao.codigo_acao}`;
      evidencePack.log(`querying API for action=${acao.codigo_acao}`);

      try {
        const data = await fetchAllPages(baseUrl, apiKey, evidencePack);

        const payloadStr = JSON.stringify(data, null, 2);
        const saved = evidencePack.saveRawPayload(
          `execucao_api_${acao.codigo_acao}.json`,
          payloadStr
        );

        const evidencia: EvidenciaItem = {
          source_name: "Portal da Transparencia API REST",
          source_url: `${baseUrl}&pagina=1`,
          captured_at_iso: new Date().toISOString(),
          raw_payload_sha256: saved.sha256,
          raw_payload_path: saved.path,
        };

        if (data.length > 0) {
          let empenhado: number | null = null;
          let liquidado: number | null = null;
          let pago: number | null = null;
          let descricaoAcao = acao.descricao;

          for (const item of data as DespesaFuncionalDTO[]) {
            const emp = parseMoneyString(item.empenhado);
            const liq = parseMoneyString(item.liquidado);
            const pg = parseMoneyString(item.pago);

            if (emp !== null) empenhado = (empenhado || 0) + emp;
            if (liq !== null) liquidado = (liquidado || 0) + liq;
            if (pg !== null) pago = (pago || 0) + pg;

            if (item.acao && item.acao.trim()) {
              descricaoAcao = item.acao.trim();
            }
          }

          const hasValues = empenhado !== null || liquidado !== null || pago !== null;

          results.push({
            codigo_acao: acao.codigo_acao,
            descricao_acao: descricaoAcao,
            empenhado,
            liquidado,
            pago,
            status: hasValues ? "OK" : "PARCIAL",
            observacoes: hasValues
              ? `Dados obtidos via API REST do Portal da Transparencia. ${data.length} registros agregados.`
              : `API retornou ${data.length} registros mas sem valores numericos para acao ${acao.codigo_acao}.`,
            evidencias: [evidencia],
          });

          evidencePack.log(
            `fetched execution action=${acao.codigo_acao} records=${data.length} empenhado=${empenhado} liquidado=${liquidado} pago=${pago}`
          );
        } else {
          results.push({
            codigo_acao: acao.codigo_acao,
            descricao_acao: acao.descricao,
            empenhado: null,
            liquidado: null,
            pago: null,
            status: "NAO_LOCALIZADO",
            observacoes: `API nao retornou dados para acao ${acao.codigo_acao} no exercicio ${anoExercicio}.`,
            evidencias: [evidencia],
          });
        }
      } catch (error: any) {
        evidencePack.log(`API error for action ${acao.codigo_acao}: ${error.message}`);
        results.push({
          codigo_acao: acao.codigo_acao,
          descricao_acao: acao.descricao,
          empenhado: null,
          liquidado: null,
          pago: null,
          status: "PARCIAL",
          observacoes: `Erro ao consultar API para acao ${acao.codigo_acao}: ${error.message}`,
          evidencias: [{
            source_name: "Portal da Transparencia API REST",
            source_url: baseUrl,
            captured_at_iso: new Date().toISOString(),
            raw_payload_sha256: null,
            raw_payload_path: null,
          }],
        });
      }
    }

    return results;
  }

  evidencePack.log(`no API key available (PORTAL_TRANSPARENCIA_API_KEY). Cannot fetch execution data.`);
  for (const acao of ACOES_PRECATORIOS_UNIAO) {
    results.push({
      codigo_acao: acao.codigo_acao,
      descricao_acao: acao.descricao,
      empenhado: null,
      liquidado: null,
      pago: null,
      status: "NAO_LOCALIZADO",
      observacoes: `Chave de API do Portal da Transparencia nao configurada (PORTAL_TRANSPARENCIA_API_KEY). Cadastre sua chave em https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email`,
      evidencias: [{
        source_name: "Portal da Transparencia API REST",
        source_url: "https://portaldatransparencia.gov.br/api-de-dados",
        captured_at_iso: new Date().toISOString(),
        raw_payload_sha256: null,
        raw_payload_path: null,
      }],
    });
  }

  return results;
}
