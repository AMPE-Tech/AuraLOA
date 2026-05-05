/**
 * Template para implementar um novo produto Serasa.
 * Copiar este arquivo, renomear (ex: cadastral_pf.ts), e implementar
 * buildLayout + parseResponse conforme manual do produto.
 *
 * NAO ALTERAR este template - ele e referencia.
 */
import type { ProdutoModule } from '../types';

interface InputExemplo {
  cpf: string;
  // adicionar campos especificos do produto
}

interface OutputExemplo {
  // estrutura tipada do retorno parseado
  cpf_consultado: string;
  nome?: string;
  // ...
}

export const produtoTemplate: ProdutoModule<InputExemplo, OutputExemplo> = {
  nome: '_template',

  /**
   * Monta a string posicional conforme layout do produto.
   * Exemplo: cabecalho fixo + CPF preenchido com zeros a esquerda + filler.
   */
  buildLayout: (input) => {
    // exemplo: '0001' + cpfPad11 + filler
    const cpfPad = input.cpf.replace(/\D/g, '').padStart(11, '0');
    return `0001${cpfPad}`;
  },

  /**
   * Parsa a resposta posicional/delimitada conforme manual do produto.
   * Serasa devolve string com campos em offsets fixos.
   */
  parseResponse: (bodyRaw) => {
    // exemplo: extrair CPF + nome a partir dos offsets do layout de retorno
    return {
      cpf_consultado: bodyRaw.substring(4, 15) ?? '',
      nome: bodyRaw.substring(15, 75)?.trim(),
    };
  },
};
