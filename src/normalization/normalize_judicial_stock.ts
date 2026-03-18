import type { EstoqueProcesso } from "../../shared/loa_types";

// asset_key é chave lógica PROVISÓRIA no formato "{tribunal_alias}:{numero_cnj}".
// Formalização no esquema canônico PrecatorioMaster está pendente para Bloco C.
export interface NormalizedJudicialRecord {
  asset_key: string;
  tribunal_alias: string;
  ente: string;
  ano_exercicio: number;
  numero_cnj: string;
  classe_codigo: number;
  classe_nome: string;
  valor_causa: number | null;
  valor_fonte: string | null;
  pagamento_pendente: boolean;
  source_confidence: number;
}

export interface NormalizeJudicialStockParams {
  ente: string;
  tribunal_alias: string;
  ano_exercicio: number;
}

const CLASSE_PRECATORIO = 1265;
const CLASSE_RPV = 1266;

export function normalizeJudicialStock(
  records: EstoqueProcesso[],
  params: NormalizeJudicialStockParams,
): NormalizedJudicialRecord[] {
  const { ente, tribunal_alias, ano_exercicio } = params;

  return records.map((p) => {
    const hasClasse = p.classe_codigo === CLASSE_PRECATORIO || p.classe_codigo === CLASSE_RPV;
    const hasValor = p.valor_causa !== null;
    const source_confidence = hasClasse && hasValor ? 0.85 : hasClasse ? 0.6 : 0.4;

    return {
      asset_key: `${tribunal_alias}:${p.numero_cnj}`,
      tribunal_alias,
      ente,
      ano_exercicio,
      numero_cnj: p.numero_cnj,
      classe_codigo: p.classe_codigo,
      classe_nome: p.classe_nome,
      valor_causa: p.valor_causa,
      valor_fonte: p.valor_fonte,
      pagamento_pendente: p.pagamento_pendente,
      source_confidence,
    };
  });
}
