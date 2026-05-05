/**
 * Le credenciais Serasa do .env (NUNCA hardcoded).
 * Modulo NOVO; nao altera nada existente.
 */
import type { SerasaCredentials, SerasaAmbiente } from './types';

export function loadCredentialsFromEnv(): SerasaCredentials {
  const logon = process.env.SERASA_LOGON;
  const senha = process.env.SERASA_SENHA;
  const novaSenha = process.env.SERASA_NOVA_SENHA ?? senha;  // se nao trocar, repete senha
  const ambiente = (process.env.SERASA_AMBIENTE as SerasaAmbiente) || 'homologacao';

  if (!logon)    throw new Error('SERASA_LOGON nao definido em .env');
  if (!senha)    throw new Error('SERASA_SENHA nao definido em .env');
  if (!novaSenha) throw new Error('SERASA_NOVA_SENHA nao definido em .env (ou nao foi possivel reusar SENHA)');
  if (ambiente !== 'homologacao' && ambiente !== 'producao') {
    throw new Error(`SERASA_AMBIENTE invalido: "${ambiente}" (use 'homologacao' ou 'producao')`);
  }

  return { logon, senha, novaSenha, ambiente };
}
