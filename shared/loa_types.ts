import { z } from "zod";

export const SCHEMA_VERSION = "br.gov.orcamento.precatorios.uniao.a2.v1";

export const a2RequestSchema = z.object({
  ano_exercicio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12).optional(),
});

export type A2Request = z.infer<typeof a2RequestSchema>;

export interface EvidenciaItem {
  source_name: string;
  source_url: string;
  captured_at_iso: string;
  raw_payload_sha256: string | null;
  raw_payload_path: string | null;
}

export interface AcaoPrecatorio {
  codigo_acao: string;
  descricao: string;
  planos_orcamentarios?: string[];
}

export interface DotacaoItem {
  codigo_acao: string;
  descricao_acao: string;
  dotacao_inicial: number | null;
  dotacao_atual: number | null;
  status: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
  observacoes: string;
  evidencias: EvidenciaItem[];
}

export interface ExecucaoItem {
  codigo_acao: string;
  descricao_acao: string;
  empenhado: number | null;
  liquidado: number | null;
  pago: number | null;
  status: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
  observacoes: string;
  evidencias: EvidenciaItem[];
}

export interface KPIItem {
  codigo_acao: string;
  descricao_acao: string;
  dotacao_atual: number | null;
  empenhado: number | null;
  liquidado: number | null;
  pago: number | null;
  percentual_execucao: number | null;
  status: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
}

export interface SourceInfo {
  name: string;
  url: string;
  type: "API" | "CSV" | "SPARQL" | "WEB";
}

export interface ZipDownloadInfo {
  url: string;
  status: number;
  ok: boolean;
  sha256: string;
  bytes: number;
  filePath: string;
  contentType: string | null;
  captured_at_iso: string;
}

export interface ZipExecucaoRow {
  ano: number | null;
  codigo_acao: string;
  codigo_po: string | null;
  pago: number;
  moeda: "BRL";
}

export interface ZipEmpenhoDetalhe {
  codigo_empenho: string;
  data_emissao: string;
  codigo_orgao_superior: string;
  orgao_superior: string;
  codigo_orgao: string;
  orgao: string;
  codigo_ug: string;
  unidade_gestora: string;
  codigo_favorecido: string;
  favorecido: string;
  codigo_acao: string;
  acao: string;
  codigo_po: string | null;
  plano_orcamentario: string | null;
  codigo_programa: string;
  programa: string;
  codigo_subfuncao: string;
  subfuncao: string;
  codigo_subtitulo: string;
  subtitulo: string;
  processo: string;
  valor_empenho: number;
  valor_pago: number;
  valor_liquidado: number;
}

export interface ZipExecucaoByAcao {
  codigo_acao: string;
  descricao_acao: string;
  total_empenhado: number;
  total_liquidado: number;
  total_pago: number;
  qtd_empenhos: number;
  planos_orcamentarios: { codigo_po: string; pago: number; empenhado: number; liquidado: number }[];
}

export interface ZipExecucaoStats {
  empenhos_com_pagamento: number;
  chaves_acao_po: number;
  total_empenhos_zip: number;
  total_liquidacoes_zip: number;
}

export interface ZipExecucaoResult {
  pago_por_acao_po: ZipExecucaoRow[];
  empenhos_detalhe: ZipEmpenhoDetalhe[];
  execucao_por_acao: ZipExecucaoByAcao[];
  stats: ZipExecucaoStats;
}

export interface CruzamentoAcaoItem {
  codigo_acao: string;
  descricao_acao: string;
  dotacao_inicial: number | null;
  dotacao_atual: number | null;
  empenhado_api: number | null;
  liquidado_api: number | null;
  pago_api: number | null;
  empenhado_zip: number | null;
  liquidado_zip: number | null;
  pago_zip: number | null;
  empenhado_final: number | null;
  liquidado_final: number | null;
  pago_final: number | null;
  percentual_execucao: number | null;
  fonte_dotacao: string;
  fonte_execucao: string;
  status: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
  qtd_empenhos_zip: number;
}

export interface A2Response {
  schema_version: string;
  process_id_uuid: string;
  ano_exercicio: number;
  mes?: number;
  generated_at_iso: string;
  status_geral: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
  sources: SourceInfo[];
  data: {
    dotacao: DotacaoItem[];
    execucao: ExecucaoItem[];
    kpis: KPIItem[];
    execucao_zip?: ZipExecucaoResult;
    cruzamento?: CruzamentoAcaoItem[];
  };
  zip_download?: ZipDownloadInfo;
  evidencias_count: number;
  hashes: {
    output_sha256: string;
  };
  evidence_pack_path: string;
}

export interface A2HistoryEntry {
  id: string;
  process_id_uuid: string;
  ano_exercicio: number;
  mes?: number;
  status_geral: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
  generated_at_iso: string;
  evidencias_count: number;
  execucao_total_pago: number | null;
  dotacao_total: number | null;
  zip_downloaded?: boolean;
}
