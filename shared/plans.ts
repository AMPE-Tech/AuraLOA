export type PlanId = "free" | "essencial" | "professional" | "business" | "enterprise" | "enterprise_plus";
export type BillingPeriod = "monthly" | "yearly";

export interface PlanFeatures {
  consultas_mes: number | "custom";
  consulta_adicional_brl: number | null;
  gravames_loa_cessao: boolean;
  revisao_ia_especialista: boolean;
  revisao_humana: boolean;
  proposta_comercial: boolean;
  contato_credor_advogado: boolean;
  dashboard: boolean;
  iataks: boolean;
  modelos_contrato_nda: boolean;
}

export interface PlanPrice {
  monthly_brl: number | null;
  yearly_brl: number | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  badge: string | null;
  price: PlanPrice;
  features: PlanFeatures;
  feature_labels: string[];
  highlight: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Acesso gratuito ao validador preliminar",
    badge: null,
    price: {
      monthly_brl: 0,
      yearly_brl: 0,
      stripe_price_id_monthly: null,
      stripe_price_id_yearly: null,
    },
    features: {
      consultas_mes: 3,
      consulta_adicional_brl: null,
      gravames_loa_cessao: true,
      revisao_ia_especialista: true,
      revisao_humana: false,
      proposta_comercial: false,
      contato_credor_advogado: false,
      dashboard: false,
      iataks: false,
      modelos_contrato_nda: false,
    },
    feature_labels: [
      "3 validações gratuitas com qualidade Standard",
      "Relatório com gravames e restrições",
      "Verificação se está na LOA",
      "Verificação de cessão, venda ou pagamento",
      "Revisão por banca de IA especialista",
      "Sem revisão humana",
      "Sem proposta comercial",
    ],
    highlight: false,
  },
  {
    id: "essencial",
    name: "Essencial",
    description: "Para investidores iniciantes em precatórios",
    badge: null,
    price: {
      monthly_brl: 147,
      yearly_brl: 1587.60,
      stripe_price_id_monthly: "price_1TEl5CFaeVcV75CQFj99g9gZ",
      stripe_price_id_yearly: "price_1TEl66FaeVcV75CQ8EudxFY8",
    },
    features: {
      consultas_mes: 3,
      consulta_adicional_brl: 99,
      gravames_loa_cessao: false,
      revisao_ia_especialista: false,
      revisao_humana: false,
      proposta_comercial: false,
      contato_credor_advogado: false,
      dashboard: false,
      iataks: false,
      modelos_contrato_nda: false,
    },
    feature_labels: [
      "3 consultas completas por mês",
      "Relatório de autenticidade do documento",
      "Verificação de CNJ no DataJud",
      "Consulta adicional por R$ 99/precatório",
      "Sem informações de gravames ou LOA",
      "Sem revisão jurídica por IA especialista",
    ],
    highlight: false,
  },
  {
    id: "professional",
    name: "Professional",
    description: "Para investidores que precisam de mais dados",
    badge: null,
    price: {
      monthly_brl: 399,
      yearly_brl: 4309.21,
      stripe_price_id_monthly: "price_1TEl8fFaeVcV75CQzFshPfJ5",
      stripe_price_id_yearly: "price_1TElDIFaeVcV75CQP4UjoMHe",
    },
    features: {
      consultas_mes: 6,
      consulta_adicional_brl: 199,
      gravames_loa_cessao: true,
      revisao_ia_especialista: false,
      revisao_humana: false,
      proposta_comercial: false,
      contato_credor_advogado: false,
      dashboard: false,
      iataks: false,
      modelos_contrato_nda: false,
    },
    feature_labels: [
      "6 consultas completas por mês",
      "Relatório com gravames e restrições",
      "Verificação se está na LOA",
      "Verificação de cessão, venda ou pagamento",
      "Consulta adicional por R$ 199/precatório",
      "Sem revisão jurídica por IA especialista",
    ],
    highlight: false,
  },
  {
    id: "business",
    name: "Business",
    description: "Para investidores que exigem análise jurídica completa",
    badge: "Mais Popular",
    price: {
      monthly_brl: 899,
      yearly_brl: 9709.24,
      stripe_price_id_monthly: "price_1TElI7FaeVcV75CQgj3rn9JX",
      stripe_price_id_yearly: "price_1TElK8FaeVcV75CQnl3Pjqdr",
    },
    features: {
      consultas_mes: 10,
      consulta_adicional_brl: 399,
      gravames_loa_cessao: true,
      revisao_ia_especialista: true,
      revisao_humana: false,
      proposta_comercial: false,
      contato_credor_advogado: false,
      dashboard: false,
      iataks: false,
      modelos_contrato_nda: false,
    },
    feature_labels: [
      "10 consultas completas por mês",
      "Relatório com gravames e restrições",
      "Verificação se está na LOA",
      "Verificação de cessão, venda ou pagamento",
      "Revisão por banca de IA especialista",
      "Banca formada por especialistas, juízes e desembargadores",
      "Consulta adicional por R$ 399/precatório",
      "Sem revisão humana",
    ],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Para operações profissionais com revisão humana",
    badge: "Completo",
    price: {
      monthly_brl: 1599,
      yearly_brl: 17260.26,
      stripe_price_id_monthly: "price_1TElOoFaeVcV75CQiHNhc6U1",
      stripe_price_id_yearly: "price_1TElQXFaeVcV75CQ4zht5MfD",
    },
    features: {
      consultas_mes: 20,
      consulta_adicional_brl: 799,
      gravames_loa_cessao: true,
      revisao_ia_especialista: true,
      revisao_humana: true,
      proposta_comercial: true,
      contato_credor_advogado: true,
      dashboard: false,
      iataks: false,
      modelos_contrato_nda: false,
    },
    feature_labels: [
      "20 consultas completas por mês",
      "Relatório com gravames e restrições",
      "Verificação se está na LOA",
      "Verificação de cessão, venda ou pagamento",
      "Revisão por banca de IA especialista",
      "Revisão humana por advogado especializado",
      "Proposta comercial de compra inclusa",
      "Contato direto com credor e advogado",
      "Consulta adicional por R$ 799/precatório",
    ],
    highlight: false,
  },
  {
    id: "enterprise_plus",
    name: "Enterprise Plus",
    description: "Para fundos e escritórios com volume personalizado",
    badge: "Enterprise",
    price: {
      monthly_brl: null,
      yearly_brl: null,
      stripe_price_id_monthly: "price_1TElTrFaeVcV75CQEUpwIdxE",
      stripe_price_id_yearly: null,
    },
    features: {
      consultas_mes: "custom",
      consulta_adicional_brl: null,
      gravames_loa_cessao: true,
      revisao_ia_especialista: true,
      revisao_humana: true,
      proposta_comercial: true,
      contato_credor_advogado: true,
      dashboard: true,
      iataks: true,
      modelos_contrato_nda: true,
    },
    feature_labels: [
      "Volume de consultas definido pelo cliente",
      "Relatório com gravames e restrições",
      "Verificação se está na LOA",
      "Verificação de cessão, venda ou pagamento",
      "Revisão por banca de IA especialista",
      "Revisão humana por advogado especializado",
      "Proposta comercial de compra inclusa",
      "Contato direto com credor e advogado",
      "Dashboard exclusivo",
      "IATAKS incluso",
      "Modelos de contrato e NDA inclusos",
      "Atendimento personalizado",
    ],
    highlight: false,
  },
];

export function getPlanById(id: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function getPlanByStripePrice(priceId: string): Plan | undefined {
  return PLANS.find(
    (p) =>
      p.price.stripe_price_id_monthly === priceId ||
      p.price.stripe_price_id_yearly === priceId
  );
}

export function getPlanLimit(planId: PlanId): number {
  const plan = getPlanById(planId);
  if (!plan) return 3;
  if (plan.features.consultas_mes === "custom") return 999999;
  return plan.features.consultas_mes;
}
