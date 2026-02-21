import type { ExecucaoItem, EvidenciaItem } from "../../shared/loa_types";
import { ACOES_PRECATORIOS_UNIAO } from "../catalog/acoes_precatorios_uniao";
import { EvidencePack } from "./evidence_pack";

const PORTAL_BASE_URL = "https://portaldatransparencia.gov.br";
const DOWNLOAD_BASE_URL = `${PORTAL_BASE_URL}/download-de-dados/despesas`;

interface DespesaCSVRow {
  codigoAcao: string;
  nomeAcao: string;
  valorEmpenhado: number;
  valorLiquidado: number;
  valorPago: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ";" && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseBRNumber(val: string): number | null {
  if (!val || val === "--" || val === "" || val === '""') return null;
  const cleaned = val.replace(/"/g, "").replace(/\./g, "").replace(",", ".").trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function findColumnIndex(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => h.toLowerCase().replace(/"/g, "").trim() === candidate.toLowerCase()
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function fetchExecucaoFromTransparencia(
  anoExercicio: number,
  evidencePack: EvidencePack
): Promise<ExecucaoItem[]> {
  const codigosAlvo = ACOES_PRECATORIOS_UNIAO.map((a) => a.codigo_acao);
  const results: ExecucaoItem[] = [];

  evidencePack.log(`start fetching execution data year=${anoExercicio}`);

  const apiUrl = `https://api.portaldatransparencia.gov.br/api-de-dados/despesas/por-acao?ano=${anoExercicio}&pagina=1`;

  const csvDownloadUrl = `${DOWNLOAD_BASE_URL}`;

  let rawCSV: string | null = null;
  let sourceUrl = "";
  let sourceName = "";

  try {
    evidencePack.log(`attempting CSV download for year=${anoExercicio}`);
    const downloadUrl = `https://portaldatransparencia.gov.br/download-de-dados/despesas/${anoExercicio}`;

    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    let latestMonth = "";
    let csvData: string | null = null;

    for (const month of months.reverse()) {
      const csvUrl = `https://portaldatransparencia.gov.br/download-de-dados/despesas/${anoExercicio}${month}`;
      try {
        evidencePack.log(`trying month=${month} url=${csvUrl}`);
        const response = await fetch(csvUrl, {
          headers: {
            "User-Agent": "AuraLOA/1.0 (Pesquisa Orcamentaria)",
            Accept: "text/csv, application/zip, */*",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("text") || contentType.includes("csv")) {
            csvData = await response.text();
            latestMonth = month;
            sourceUrl = csvUrl;
            sourceName = `Portal da Transparencia CSV ${anoExercicio}/${month}`;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (csvData && csvData.length > 100) {
      rawCSV = csvData;
    }
  } catch (error: any) {
    evidencePack.log(`CSV download failed: ${error.message}`);
  }

  if (!rawCSV) {
    try {
      evidencePack.log(`attempting API fallback for year=${anoExercicio}`);
      const apiKey = process.env.PORTAL_TRANSPARENCIA_API_KEY;

      if (apiKey) {
        for (const acao of ACOES_PRECATORIOS_UNIAO) {
          const url = `https://api.portaldatransparencia.gov.br/api-de-dados/despesas/recursos-recebidos?ano=${anoExercicio}&codigoAcao=${acao.codigo_acao}&pagina=1`;

          try {
            const response = await fetch(url, {
              headers: {
                "chave-api-dados": apiKey,
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(15000),
            });

            if (response.ok) {
              const data = await response.json();
              const payloadStr = JSON.stringify(data, null, 2);
              const saved = evidencePack.saveRawPayload(
                `execucao_api_${acao.codigo_acao}.json`,
                payloadStr
              );

              sourceUrl = url;
              sourceName = `Portal da Transparencia API`;

              const evidencia: EvidenciaItem = {
                source_name: sourceName,
                source_url: url,
                captured_at_iso: new Date().toISOString(),
                raw_payload_sha256: saved.sha256,
                raw_payload_path: saved.path,
              };

              if (Array.isArray(data) && data.length > 0) {
                let empenhado = 0, liquidado = 0, pago = 0;
                for (const item of data) {
                  empenhado += item.valorEmpenhado || 0;
                  liquidado += item.valorLiquidado || 0;
                  pago += item.valorPago || item.valorPagoReal || 0;
                }

                results.push({
                  codigo_acao: acao.codigo_acao,
                  descricao_acao: acao.descricao,
                  empenhado,
                  liquidado,
                  pago,
                  status: "OK",
                  observacoes: `Dados obtidos via API do Portal da Transparencia`,
                  evidencias: [evidencia],
                });
              } else {
                results.push({
                  codigo_acao: acao.codigo_acao,
                  descricao_acao: acao.descricao,
                  empenhado: null,
                  liquidado: null,
                  pago: null,
                  status: "NAO_LOCALIZADO",
                  observacoes: `API retornou dados vazios para acao ${acao.codigo_acao} no ano ${anoExercicio}`,
                  evidencias: [evidencia],
                });
              }
              evidencePack.log(
                `fetched execution via API source=${sourceName} action=${acao.codigo_acao}`
              );
            }
          } catch (err: any) {
            evidencePack.log(`API fetch failed for action ${acao.codigo_acao}: ${err.message}`);
          }
        }

        if (results.length > 0) return results;
      }
    } catch (error: any) {
      evidencePack.log(`API fallback failed: ${error.message}`);
    }
  }

  if (rawCSV) {
    evidencePack.log(`parsing CSV data length=${rawCSV.length}`);
    const saved = evidencePack.saveRawPayload(`execucao_csv_${anoExercicio}.csv`, rawCSV);

    const lines = rawCSV.split("\n");
    if (lines.length < 2) {
      evidencePack.log(`CSV has insufficient lines: ${lines.length}`);
    }

    const headers = parseCSVLine(lines[0]);

    const colAcao = findColumnIndex(headers, "codigo acao", "código ação", "código da ação", "codigoacao");
    const colNomeAcao = findColumnIndex(headers, "nome acao", "nome ação", "nome da ação", "nomeacao");
    const colEmpenhado = findColumnIndex(headers, "valor empenhado", "valorempenhado");
    const colLiquidado = findColumnIndex(headers, "valor liquidado", "valorliquidado");
    const colPago = findColumnIndex(headers, "valor pago", "valorpago");

    const aggregated: Record<string, { empenhado: number | null; liquidado: number | null; pago: number | null; nome: string; hasData: boolean }> = {};

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = parseCSVLine(lines[i]);
      const codigoAcao = (cols[colAcao] || "").replace(/"/g, "").trim();

      if (codigosAlvo.includes(codigoAcao)) {
        if (!aggregated[codigoAcao]) {
          aggregated[codigoAcao] = {
            empenhado: null,
            liquidado: null,
            pago: null,
            nome: (cols[colNomeAcao] || "").replace(/"/g, "").trim(),
            hasData: false,
          };
        }
        const emp = colEmpenhado >= 0 ? parseBRNumber(cols[colEmpenhado]) : null;
        const liq = colLiquidado >= 0 ? parseBRNumber(cols[colLiquidado]) : null;
        const pg = colPago >= 0 ? parseBRNumber(cols[colPago]) : null;

        if (emp !== null) { aggregated[codigoAcao].empenhado = (aggregated[codigoAcao].empenhado || 0) + emp; aggregated[codigoAcao].hasData = true; }
        if (liq !== null) { aggregated[codigoAcao].liquidado = (aggregated[codigoAcao].liquidado || 0) + liq; aggregated[codigoAcao].hasData = true; }
        if (pg !== null) { aggregated[codigoAcao].pago = (aggregated[codigoAcao].pago || 0) + pg; aggregated[codigoAcao].hasData = true; }
      }
    }

    const evidencia: EvidenciaItem = {
      source_name: sourceName || `Portal da Transparencia CSV`,
      source_url: sourceUrl || csvDownloadUrl,
      captured_at_iso: new Date().toISOString(),
      raw_payload_sha256: saved.sha256,
      raw_payload_path: saved.path,
    };

    for (const acao of ACOES_PRECATORIOS_UNIAO) {
      const agg = aggregated[acao.codigo_acao];
      if (agg && agg.hasData) {
        results.push({
          codigo_acao: acao.codigo_acao,
          descricao_acao: agg.nome || acao.descricao,
          empenhado: agg.empenhado,
          liquidado: agg.liquidado,
          pago: agg.pago,
          status: "OK",
          observacoes: `Dados extraidos de CSV do Portal da Transparencia`,
          evidencias: [evidencia],
        });
      } else if (agg && !agg.hasData) {
        results.push({
          codigo_acao: acao.codigo_acao,
          descricao_acao: agg.nome || acao.descricao,
          empenhado: null,
          liquidado: null,
          pago: null,
          status: "PARCIAL",
          observacoes: `Acao ${acao.codigo_acao} encontrada no CSV mas sem valores numericos extraiveis`,
          evidencias: [evidencia],
        });
      } else {
        results.push({
          codigo_acao: acao.codigo_acao,
          descricao_acao: acao.descricao,
          empenhado: null,
          liquidado: null,
          pago: null,
          status: "NAO_LOCALIZADO",
          observacoes: `Acao ${acao.codigo_acao} nao encontrada no CSV de despesas do ano ${anoExercicio}`,
          evidencias: [evidencia],
        });
      }
    }

    return results;
  }

  evidencePack.log(`no data source available, returning NAO_LOCALIZADO for all actions`);
  for (const acao of ACOES_PRECATORIOS_UNIAO) {
    results.push({
      codigo_acao: acao.codigo_acao,
      descricao_acao: acao.descricao,
      empenhado: null,
      liquidado: null,
      pago: null,
      status: "NAO_LOCALIZADO",
      observacoes: `Nenhuma fonte de dados de execucao disponivel. CSV download e API falharam para o ano ${anoExercicio}. Verifique se o ano possui dados publicados no Portal da Transparencia.`,
      evidencias: [
        {
          source_name: "Portal da Transparencia",
          source_url: DOWNLOAD_BASE_URL,
          captured_at_iso: new Date().toISOString(),
          raw_payload_sha256: null,
          raw_payload_path: null,
        },
      ],
    });
  }

  return results;
}
