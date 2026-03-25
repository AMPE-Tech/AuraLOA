export function formatarValor(valor: number | null | undefined): string {
  if (valor == null) return "R$ —";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export type StatusPrecatorio =
  | "pesquisado"
  | "aprovado"
  | "verificar"
  | "suspeito"
  | "proposta_enviada"
  | "aguardando_vendedor"
  | "aguardando_comprador"
  | "analise_interna"
  | "fechado"
  | "cancelado";

export interface PrecatorioDashboard {
  id: string;
  numero_cnj: string;
  tribunal: string;
  valor_face: number | null;
  valor_negociado: number | null;
  status: StatusPrecatorio;
  data_consulta: string;
  data_atualizacao: string;
  score_autenticidade: number | null;
  tipo: "PRECATORIO" | "RPV" | "DESCONHECIDO";
  credor_nome: string | null;
  proposta_comercial: boolean;
  negocio_fechado: boolean;
}

export interface DashboardKPIs {
  total_pesquisado: number;
  total_aprovado: number;
  total_verificar: number;
  total_suspeito: number;
  total_proposta: number;
  total_fechado: number;
  valor_total_pesquisado: number;
  valor_total_negociacao: number;
  valor_total_fechado: number;
  taxa_aprovacao: number;
  taxa_conversao: number;
}

export interface FunilEtapa {
  id: StatusPrecatorio;
  label: string;
  cor: string;
  quantidade: number;
  valor_total: number;
}

export interface GraficoMensal {
  mes: string;
  pesquisado: number;
  aprovado: number;
  fechado: number;
  valor_pesquisado: number;
  valor_fechado: number;
}

export interface GraficoTribunal {
  tribunal: string;
  quantidade: number;
  valor_total: number;
}

export interface GraficoStatus {
  name: string;
  value: number;
  color: string;
}

export function calcularKPIs(precatorios: PrecatorioDashboard[]): DashboardKPIs {
  const total_pesquisado = precatorios.length;
  const total_aprovado = precatorios.filter(p => (p.score_autenticidade ?? 0) >= 80).length;
  const total_verificar = precatorios.filter(p => (p.score_autenticidade ?? 0) >= 50 && (p.score_autenticidade ?? 0) < 80).length;
  const total_suspeito = precatorios.filter(p => (p.score_autenticidade ?? 0) < 50).length;
  const total_proposta = precatorios.filter(p => p.proposta_comercial).length;
  const total_fechado = precatorios.filter(p => p.negocio_fechado).length;
  const valor_total_pesquisado = precatorios.reduce((a, p) => a + (p.valor_face ?? 0), 0);
  const valor_total_negociacao = precatorios.filter(p => p.proposta_comercial).reduce((a, p) => a + (p.valor_negociado ?? 0), 0);
  const valor_total_fechado = precatorios.filter(p => p.negocio_fechado).reduce((a, p) => a + (p.valor_negociado ?? 0), 0);
  const taxa_aprovacao = total_pesquisado > 0 ? Math.round((total_aprovado / total_pesquisado) * 100) : 0;
  const taxa_conversao = total_aprovado > 0 ? Math.round((total_fechado / total_aprovado) * 100) : 0;
  return {
    total_pesquisado, total_aprovado, total_verificar, total_suspeito,
    total_proposta, total_fechado, valor_total_pesquisado,
    valor_total_negociacao, valor_total_fechado, taxa_aprovacao, taxa_conversao,
  };
}

export const FUNIL_ETAPAS: Omit<FunilEtapa, "quantidade" | "valor_total">[] = [
  { id: "pesquisado",           label: "Pesquisado",          cor: "rgba(251,146,60,1)"    },
  { id: "aprovado",             label: "Aprovado",            cor: "rgba(251,146,60,0.85)" },
  { id: "proposta_enviada",     label: "Proposta Enviada",    cor: "rgba(251,146,60,0.70)" },
  { id: "aguardando_vendedor",  label: "Aguard. Vendedor",    cor: "rgba(251,146,60,0.55)" },
  { id: "aguardando_comprador", label: "Aguard. Comprador",   cor: "rgba(251,146,60,0.40)" },
  { id: "analise_interna",      label: "Análise Interna",     cor: "rgba(251,146,60,0.28)" },
  { id: "fechado",              label: "Fechado",             cor: "rgba(251,146,60,0.15)" },
];

export const STATUS_LABELS: Record<StatusPrecatorio, string> = {
  pesquisado:           "Pesquisado",
  aprovado:             "Aprovado",
  verificar:            "Verificar",
  suspeito:             "Suspeito",
  proposta_enviada:     "Proposta Enviada",
  aguardando_vendedor:  "Aguardando Vendedor",
  aguardando_comprador: "Aguardando Comprador",
  analise_interna:      "Análise Interna",
  fechado:              "Fechado",
  cancelado:            "Cancelado",
};

export const STATUS_CORES: Record<StatusPrecatorio, string> = {
  pesquisado:           "text-slate-300",
  aprovado:             "text-emerald-400",
  verificar:            "text-amber-400",
  suspeito:             "text-red-400",
  proposta_enviada:     "text-cyan-400",
  aguardando_vendedor:  "text-orange-400",
  aguardando_comprador: "text-orange-300",
  analise_interna:      "text-violet-400",
  fechado:              "text-teal-400",
  cancelado:            "text-gray-500",
};
