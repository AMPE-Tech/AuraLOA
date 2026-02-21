import type { AcaoPrecatorio } from "../../shared/loa_types";

export const ACOES_PRECATORIOS_UNIAO: AcaoPrecatorio[] = [
  {
    codigo_acao: "0005",
    descricao:
      "Sentencas Judiciais Transitadas em Julgado (Precatorios)",
    planos_orcamentarios: ["0001", "0002", "0003", "0004"],
  },
  {
    codigo_acao: "0EC7",
    descricao:
      "Sentencas Judiciais Transitadas em Julgado (Precatorios Relativos a Complementacao da Uniao ao FUNDEF)",
    planos_orcamentarios: [],
  },
  {
    codigo_acao: "0EC8",
    descricao:
      "Sentencas Judiciais Transitadas em Julgado (Precatorios Parcelados ou Objetos de Acordos)",
    planos_orcamentarios: [],
  },
  {
    codigo_acao: "0625",
    descricao:
      "Sentencas Judiciais Transitadas em Julgado de Pequeno Valor (RPV)",
    planos_orcamentarios: [],
  },
  {
    codigo_acao: "00WU",
    descricao:
      "Sentencas Judiciais Transitadas em Julgado (Precatorios) - Excedentes ao Sublimite",
    planos_orcamentarios: [],
  },
  {
    codigo_acao: "00G5",
    descricao:
      "Contribuicao da Uniao para Custeio do Regime de Previdencia Decorrente do Pagamento de Precatorios e RPV",
    planos_orcamentarios: [],
  },
  {
    codigo_acao: "0022",
    descricao:
      "Sentencas Judiciais Devidas por Empresas Estatais",
    planos_orcamentarios: [],
  },
];

export function getAcaoByCode(code: string): AcaoPrecatorio | undefined {
  return ACOES_PRECATORIOS_UNIAO.find((a) => a.codigo_acao === code);
}

export function getAllCodigos(): string[] {
  return ACOES_PRECATORIOS_UNIAO.map((a) => a.codigo_acao);
}
