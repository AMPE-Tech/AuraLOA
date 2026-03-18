export interface PrecatorioMasterRecord {
  asset_key: string;
  ente: string;
  ente_sigla?: string;
  tribunal_alias?: string;
  numero_cnj?: string;
  numero_precatorio?: string;
  ano_exercicio?: number;
  valor_rankeado?: number;
  valor_fonte_primaria?: number;
  tipo_precatorio?: string;
  preferencia?: string;
  na_loa: boolean;
  pago: boolean;
  procedente_sem_loa: boolean;
  cobertura_execucao_status?: string;
  first_seen_at?: string;
  last_seen_at?: string;
  last_reconciled_at?: string;
  data_json: Record<string, unknown>;
}
