/**
 * Validação de CPF, CNPJ, email e telefone.
 * Usado na extração de dados do Portal da Transparência.
 */

// ── CPF ──────────────────────────────────────────────

/** Remove tudo que não é dígito */
function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Valida CPF (11 dígitos, dígitos verificadores, rejeita sequências repetidas) */
export function validarCPF(cpf: string): boolean {
  const digits = somenteDigitos(cpf);
  if (digits.length !== 11) return false;

  // Rejeita sequências como 000.000.000-00, 111.111.111-11, etc.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += Number(digits[i]) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(digits[9])) return false;

  // Segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += Number(digits[i]) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(digits[10])) return false;

  return true;
}

/** Formata CPF: 000.000.000-00 */
export function formatarCPF(cpf: string): string | null {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ── CNPJ ─────────────────────────────────────────────

const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Valida CNPJ (14 dígitos, dígitos verificadores, rejeita sequências repetidas) */
export function validarCNPJ(cnpj: string): boolean {
  const digits = somenteDigitos(cnpj);
  if (digits.length !== 14) return false;

  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += Number(digits[i]) * PESOS_CNPJ_1[i];
  }
  let resto = soma % 11;
  const dv1 = resto < 2 ? 0 : 11 - resto;
  if (dv1 !== Number(digits[12])) return false;

  // Segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += Number(digits[i]) * PESOS_CNPJ_2[i];
  }
  resto = soma % 11;
  const dv2 = resto < 2 ? 0 : 11 - resto;
  if (dv2 !== Number(digits[13])) return false;

  return true;
}

/** Formata CNPJ: 00.000.000/0000-00 */
export function formatarCNPJ(cnpj: string): string | null {
  const d = somenteDigitos(cnpj);
  if (d.length !== 14) return null;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// ── Email ────────────────────────────────────────────

/**
 * Valida email com regex pragmática.
 * Não cobre 100% da RFC 5322 mas funciona para dados reais do Portal da Transparência.
 */
export function validarEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  // Regex pragmática: local@dominio.tld
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(trimmed);
}

/** Normaliza email (trim + lowercase) */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ── Telefone ─────────────────────────────────────────

/**
 * Valida telefone brasileiro.
 * Aceita: 10 dígitos (fixo com DDD) ou 11 dígitos (celular com DDD e 9° dígito).
 * DDDs válidos: 11-99 (exclui 00-10).
 */
export function validarTelefone(telefone: string): boolean {
  const digits = somenteDigitos(telefone);

  if (digits.length !== 10 && digits.length !== 11) return false;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  // Celular (11 dígitos) deve começar com 9 após o DDD
  if (digits.length === 11 && digits[2] !== "9") return false;

  // Fixo (10 dígitos): primeiro dígito do número deve ser 2-5
  if (digits.length === 10) {
    const primeiro = Number(digits[2]);
    if (primeiro < 2 || primeiro > 5) return false;
  }

  return true;
}

/** Formata telefone: (00) 0000-0000 ou (00) 00000-0000 */
export function formatarTelefone(telefone: string): string | null {
  const d = somenteDigitos(telefone);
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return null;
}

// ── Utilitário geral ─────────────────────────────────

export type TipoDocumento = "cpf" | "cnpj" | "email" | "telefone";

export interface ResultadoValidacao {
  tipo: TipoDocumento;
  valido: boolean;
  valorOriginal: string;
  valorFormatado: string | null;
}

/** Detecta o tipo e valida automaticamente */
export function validarDocumento(valor: string): ResultadoValidacao {
  const trimmed = valor.trim();

  // Tenta email primeiro (tem @)
  if (trimmed.includes("@")) {
    return {
      tipo: "email",
      valido: validarEmail(trimmed),
      valorOriginal: trimmed,
      valorFormatado: validarEmail(trimmed) ? normalizarEmail(trimmed) : null,
    };
  }

  const digits = somenteDigitos(trimmed);

  // CPF: 11 dígitos
  if (digits.length === 11 && !/^(\d)\1{10}$/.test(digits)) {
    // Pode ser telefone celular ou CPF — se tem formatação de CPF, prioriza CPF
    const pareceCPF = /[\.\-]/.test(trimmed) || digits.length === 11;
    if (pareceCPF) {
      return {
        tipo: "cpf",
        valido: validarCPF(digits),
        valorOriginal: trimmed,
        valorFormatado: formatarCPF(digits),
      };
    }
  }

  // CNPJ: 14 dígitos
  if (digits.length === 14) {
    return {
      tipo: "cnpj",
      valido: validarCNPJ(digits),
      valorOriginal: trimmed,
      valorFormatado: formatarCNPJ(digits),
    };
  }

  // Telefone: 10-11 dígitos
  if (digits.length === 10 || digits.length === 11) {
    return {
      tipo: "telefone",
      valido: validarTelefone(digits),
      valorOriginal: trimmed,
      valorFormatado: formatarTelefone(digits),
    };
  }

  // Fallback: tenta cada um
  if (digits.length > 0) {
    if (validarCPF(digits)) return { tipo: "cpf", valido: true, valorOriginal: trimmed, valorFormatado: formatarCPF(digits) };
    if (validarCNPJ(digits)) return { tipo: "cnpj", valido: true, valorOriginal: trimmed, valorFormatado: formatarCNPJ(digits) };
  }

  // Não identificado — retorna como CPF inválido por padrão
  return {
    tipo: "cpf",
    valido: false,
    valorOriginal: trimmed,
    valorFormatado: null,
  };
}

/** Valida um lote de documentos e retorna resumo */
export function validarLote(valores: string[]): {
  resultados: ResultadoValidacao[];
  resumo: { total: number; validos: number; invalidos: number; por_tipo: Record<TipoDocumento, number> };
} {
  const resultados = valores.map(validarDocumento);
  const validos = resultados.filter((r) => r.valido).length;
  const por_tipo: Record<TipoDocumento, number> = { cpf: 0, cnpj: 0, email: 0, telefone: 0 };
  for (const r of resultados) {
    if (r.valido) por_tipo[r.tipo]++;
  }
  return {
    resultados,
    resumo: { total: valores.length, validos, invalidos: valores.length - validos, por_tipo },
  };
}
