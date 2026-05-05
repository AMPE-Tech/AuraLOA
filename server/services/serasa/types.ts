/**
 * Serasa - tipos publicos do transporte HTTPS.
 * Modulo NOVO; nao altera tipos de outros services.
 */

export type SerasaAmbiente = 'homologacao' | 'producao';

export interface SerasaCredentials {
  logon: string;          // 8 chars exatos
  senha: string;          // 8 chars exatos
  novaSenha: string;      // 8 chars exatos (repetir senha se nao for trocar)
  ambiente: SerasaAmbiente;
}

/**
 * Request bruto: layout do produto vai como string ja montada
 * conforme manual especifico do produto contratado.
 */
export interface SerasaRequest {
  produto: string;            // identificador legivel ex 'cadastral_pf'
  layoutString: string;       // string montada pelo builder do produto
  credenciais: SerasaCredentials;
  timeoutMs?: number;         // default 30s
}

/**
 * Resposta crua. O parser de cada produto interpreta o body
 * conforme layout de retorno especifico.
 */
export interface SerasaResponse {
  ok: boolean;
  status_http: number;
  body_raw: string;           // resposta literal Serasa (string posicional)
  duracao_ms: number;
  erro?: string;
  request_summary: {
    produto: string;
    ambiente: SerasaAmbiente;
    url: string;
    body_length: number;
    sent_at: string;          // ISO ts
  };
}

/**
 * Cada produto exporta:
 *  - buildLayout(input) -> string
 *  - parseResponse(bodyRaw) -> objeto tipado especifico
 */
export interface ProdutoModule<I, O> {
  nome: string;
  buildLayout: (input: I) => string;
  parseResponse: (bodyRaw: string) => O;
}
