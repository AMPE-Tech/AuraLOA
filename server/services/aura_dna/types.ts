/**
 * AuraDNA - tipos publicos do motor.
 * Modulo NOVO; nao altera tipos de outros services.
 */

export type IdentificadorTipo = 'cnj' | 'cpf' | 'cnpj' | 'numero_precatorio' | 'oficio_requisitorio' | 'chave_siop';

export interface DNAInput {
  tipo: IdentificadorTipo;
  valor: string;                    // valor cru, sem mascara
  contexto?: {
    tribunal_hint?: string;          // 'trf1'..'trf6' se cliente souber
    ano_loa_hint?: number;           // 2026 se cliente souber
    valor_estimado_hint?: number;    // R$ aproximado (ajuda match na camada 2)
  };
}

export type CamadaId = 1 | 2 | 3 | 4 | 5;

export interface CamadaResult {
  camada: CamadaId;
  nome: string;                     // 'Processo' | 'Tribunal' | 'LOA' | 'Execucao' | 'Evidencia'
  ok: boolean;                      // true se conseguiu extrair algo util
  fonte_url?: string;               // URL/endpoint consultado
  dados: Record<string, unknown>;   // payload livre da camada
  evidencias: Evidencia[];          // citacoes verificaveis
  confianca: number;                // 0-1; subjetivo da camada
  erro?: string;                    // se ok=false
  duracao_ms: number;
}

export interface Evidencia {
  tipo: 'url' | 'arquivo' | 'cnj_match' | 'screenshot' | 'json' | 'pdf_excerto';
  ref: string;                      // URL, path, CNJ, etc
  trecho?: string;                  // texto literal extraido (max ~500 chars)
  data_consulta: string;            // ISO timestamp
}

export interface ScoreDetalhe {
  camada: CamadaId;
  pontos: number;                   // 0-20 por camada
  motivo: string;
}

export interface DNAScore {
  total: number;                    // 0-100
  detalhes: ScoreDetalhe[];
  classificacao: 'ALTA' | 'MEDIA' | 'BAIXA' | 'INSUFICIENTE';
}

export interface DNAOutput {
  input: DNAInput;
  timestamp: string;                // ISO ts da execucao
  camadas: CamadaResult[];
  score: DNAScore;
  status_ativo: string;             // ex: 'PRECATORIO VALIDO, PENDENTE DE PAGAMENTO 2026'
  dossie_md: string;                // texto markdown pronto pra exibir/exportar
  duracao_total_ms: number;
}

/**
 * Cada camada exporta esta funcao.
 * Recebe input + abort signal, devolve resultado padronizado.
 */
export type CamadaFn = (input: DNAInput, signal?: AbortSignal) => Promise<CamadaResult>;
