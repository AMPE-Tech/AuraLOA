import { z } from "zod";

export const SCHEMA_VERSION = "br.gov.orcamento.precatorios.uniao.a2.v1";

export const a2RequestSchema = z.object({
  ano_exercicio: z.number().int().min(2000).max(2100),
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

export interface A2Response {
  schema_version: string;
  process_id_uuid: string;
  ano_exercicio: number;
  generated_at_iso: string;
  status_geral: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
  sources: SourceInfo[];
  data: {
    dotacao: DotacaoItem[];
    execucao: ExecucaoItem[];
    kpis: KPIItem[];
  };
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
  status_geral: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
  generated_at_iso: string;
  evidencias_count: number;
  execucao_total_pago: number | null;
  dotacao_total: number | null;
}
