/**
 * Cliente HTTPS Serasa - String de Dados.
 * Transporte generico - cada produto monta seu layout e parsa o retorno
 * em produtos/{produto}.ts.
 *
 * Ref: Instrucoes-de-utilizacao-HTTPS.pdf (Serasa Experian, jan/2022).
 */
import https from 'node:https';
import { URLSearchParams } from 'node:url';
import type { SerasaRequest, SerasaResponse, SerasaAmbiente } from './types';

const ENDPOINTS: Record<SerasaAmbiente, string> = {
  homologacao: 'https://mqlinuxext-2.serasa.com.br/Homologa/consultahttps',
  producao: 'https://sitenet43-2.serasa.com.br/Prod/consultahttps',
};

function validarCredenciais(c: SerasaRequest['credenciais']) {
  if (c.logon.length !== 8) throw new Error(`Serasa: logon deve ter 8 chars (recebeu ${c.logon.length})`);
  if (c.senha.length !== 8) throw new Error(`Serasa: senha deve ter 8 chars (recebeu ${c.senha.length})`);
  if (c.novaSenha.length !== 8) throw new Error(`Serasa: novaSenha deve ter 8 chars (recebeu ${c.novaSenha.length})`);
}

export async function consultarSerasa(req: SerasaRequest): Promise<SerasaResponse> {
  validarCredenciais(req.credenciais);

  const url = ENDPOINTS[req.credenciais.ambiente];
  const p = req.credenciais.logon + req.credenciais.senha + req.credenciais.novaSenha + req.layoutString;
  const body = new URLSearchParams({ p }).toString();

  const sentAt = new Date().toISOString();
  const t0 = Date.now();

  const summary: SerasaResponse['request_summary'] = {
    produto: req.produto,
    ambiente: req.credenciais.ambiente,
    url,
    body_length: body.length,
    sent_at: sentAt,
  };

  return new Promise<SerasaResponse>((resolve) => {
    const u = new URL(url);
    const opts: https.RequestOptions = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      minVersion: 'TLSv1.2',          // PDF exige TLS 1.2+
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body).toString(),
      },
      timeout: req.timeoutMs ?? 30_000,
    };

    const r = https.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const bodyRaw = Buffer.concat(chunks).toString('latin1'); // Serasa devolve Latin1 historicamente
        resolve({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status_http: res.statusCode ?? 0,
          body_raw: bodyRaw,
          duracao_ms: Date.now() - t0,
          request_summary: summary,
        });
      });
    });

    r.on('timeout', () => {
      r.destroy(new Error('timeout'));
    });
    r.on('error', (e) => {
      resolve({
        ok: false,
        status_http: 0,
        body_raw: '',
        duracao_ms: Date.now() - t0,
        erro: e.message,
        request_summary: summary,
      });
    });

    r.write(body);
    r.end();
  });
}
