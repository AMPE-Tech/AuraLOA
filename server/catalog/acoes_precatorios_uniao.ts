import type { AcaoPrecatorio } from "../../shared/loa_types";

export const ACOES_PRECATORIOS_UNIAO: AcaoPrecatorio[] = [
  {
    codigo_acao: "0005",
    descricao:
      "Cumprimento de Sentencas Judiciais Transitadas em Julgado (Precatorios)",
    planos_orcamentarios: ["0001", "0002", "0003", "0004"],
  },
  {
    codigo_acao: "0EC7",
    descricao:
      "Cumprimento de Sentenca Judicial Transitada em Julgado devida pela Uniao, Autarquias e Fundacoes Publicas Federais (Precatorios - EC 114/2021)",
    planos_orcamentarios: [],
  },
  {
    codigo_acao: "0EC8",
    descricao:
      "Cumprimento de Sentenca Judicial Transitada em Julgado devida pela Uniao, Autarquias e Fundacoes Publicas Federais (Requisicoes de Pequeno Valor - RPV)",
    planos_orcamentarios: [],
  },
];

export function getAcaoByCode(code: string): AcaoPrecatorio | undefined {
  return ACOES_PRECATORIOS_UNIAO.find((a) => a.codigo_acao === code);
}

export function getAllCodigos(): string[] {
  return ACOES_PRECATORIOS_UNIAO.map((a) => a.codigo_acao);
}
