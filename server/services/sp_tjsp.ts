import { EvidencePack } from "./evidence_pack";
import type { TjspItem } from "../../shared/loa_types";

const TJSP_PENDENTES_FORM =
  "https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx";
const TJSP_PAGAMENTOS_FORM =
  "https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatefetuados.aspx";

function safeNumberBR(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : undefined;
}

function extractTableRowsFromHtml(html: string): string[][] {
  const rows: string[][] = [];
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trMatches) {
    const tds = tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? [];
    const cols = tds.map((td) =>
      td
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
    if (cols.length) rows.push(cols);
  }
  return rows;
}

function bestEffortMapTjsp(
  rows: string[][],
  entidade: string,
  status: string,
  fonte_url: string
): TjspItem[] {
  const items: TjspItem[] = [];

  for (const cols of rows) {
    if (cols.join(" ").toLowerCase().includes("entidade")) continue;
    if (cols.length < 3) continue;

    let valor: number | undefined;
    for (const c of cols) {
      if (
        /[0-9]+\.[0-9]{3}\.[0-9]{3},[0-9]{2}/.test(c) ||
        /[0-9]+,[0-9]{2}/.test(c)
      ) {
        const n = safeNumberBR(c);
        if (n && n > 0) {
          valor = n;
          break;
        }
      }
    }

    const numero = cols.find((c) => /\d{6,}/.test(c));
    const credor = cols.find(
      (c) => c.length > 10 && /[A-Za-zÀ-ÿ]/.test(c) && !/\d{4,}/.test(c)
    );

    if (!numero && !credor && !valor) continue;

    items.push({
      entidade,
      numero,
      credor,
      valor,
      status,
      fonte_url,
    });
  }

  return items;
}

export async function consultarTjspPendentes(
  entidade: string,
  pack: EvidencePack
): Promise<{ items: TjspItem[]; note: string }> {
  pack.log(`[SP] Consultando TJSP pendentes para entidade: ${entidade}`);

  try {
    const r = await fetch(TJSP_PENDENTES_FORM, {
      method: "GET",
      headers: {
        "User-Agent": "AuraLOA/1.0 (pesquisa precatorios)",
        Accept: "text/html",
      },
    });
    const html = await r.text();
    pack.saveRawPayload(
      `tjsp_pendentes_${Date.now()}.html`,
      Buffer.from(html, "utf-8")
    );
    pack.log(
      `[SP] TJSP pendentes HTML capturado: ${html.length} bytes, status=${r.status}`
    );

    const rows = extractTableRowsFromHtml(html);
    const items = bestEffortMapTjsp(rows, entidade, "PENDENTE", TJSP_PENDENTES_FORM);
    pack.log(`[SP] TJSP pendentes extraidos: ${items.length} itens`);

    return {
      items,
      note: "MVP best-effort: captura HTML e tenta mapear tabela. Se o TJSP exigir selecao/POST por entidade, evoluir para POST com VIEWSTATE.",
    };
  } catch (e: any) {
    pack.log(`[SP] Erro ao consultar TJSP pendentes: ${e?.message}`);
    return {
      items: [],
      note: `Erro ao acessar TJSP: ${e?.message}. Evidencia salva.`,
    };
  }
}

export async function consultarTjspPagamentos(
  entidade: string,
  pack: EvidencePack
): Promise<{ items: TjspItem[]; note: string }> {
  pack.log(`[SP] Consultando TJSP pagamentos para entidade: ${entidade}`);

  try {
    const r = await fetch(TJSP_PAGAMENTOS_FORM, {
      method: "GET",
      headers: {
        "User-Agent": "AuraLOA/1.0 (pesquisa precatorios)",
        Accept: "text/html",
      },
    });
    const html = await r.text();
    pack.saveRawPayload(
      `tjsp_pagamentos_${Date.now()}.html`,
      Buffer.from(html, "utf-8")
    );
    pack.log(
      `[SP] TJSP pagamentos HTML capturado: ${html.length} bytes, status=${r.status}`
    );

    const rows = extractTableRowsFromHtml(html);
    const items = bestEffortMapTjsp(
      rows,
      entidade,
      "PAGAMENTO",
      TJSP_PAGAMENTOS_FORM
    );
    pack.log(`[SP] TJSP pagamentos extraidos: ${items.length} itens`);

    return {
      items,
      note: "MVP best-effort: captura HTML e tenta mapear. Para dados por entidade com precisao, evoluir para submissao do formulario do TJSP.",
    };
  } catch (e: any) {
    pack.log(`[SP] Erro ao consultar TJSP pagamentos: ${e?.message}`);
    return {
      items: [],
      note: `Erro ao acessar TJSP: ${e?.message}. Evidencia salva.`,
    };
  }
}

export function getTjspUrls() {
  return {
    pendentes: TJSP_PENDENTES_FORM,
    pagamentos: TJSP_PAGAMENTOS_FORM,
    pesquisa: "https://www.tjsp.jus.br/cac/scp/webmenupesquisa.aspx",
    lista_pendentes_oficial: "https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes",
  };
}
