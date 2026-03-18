import type { JobType } from "./job_types";

export type JobRegistryStatus = "active" | "planned";

export interface JobRegistryEntry {
  job_type: JobType;
  agent_name: string;
  status: JobRegistryStatus;
  descricao: string;
}

export const JOB_REGISTRY: JobRegistryEntry[] = [
  // ── Ativos hoje ──────────────────────────────────────────────────────────
  {
    job_type: "judicial_stock.collect",
    agent_name: "judicial_stock_agent",
    status: "active",
    descricao: "Coleta de estoque judicial via DataJud CNJ (Bloco B). Cobre TRF1-TRF6 e TJSP.",
  },
  {
    job_type: "loa_dotacao.collect",
    agent_name: "loa_dotacao_agent",
    status: "active",
    descricao: "Coleta de dotação LOA via SPARQL público (Bloco C). Graceful degradation para anos > 2016.",
  },
  {
    job_type: "execucao.collect",
    agent_name: "execution_finance_agent",
    status: "active",
    descricao: "Coleta de execução financeira via Portal da Transparência REST API (Bloco D). Requer PORTAL_TRANSPARENCIA_API_KEY.",
  },

  // ── Planejados para implementação futura ─────────────────────────────────
  {
    job_type: "orcamento_pdf.collect",
    agent_name: "orcamento_pdf_agent",
    status: "planned",
    descricao: "Coleta e parsing de PDFs oficiais de precatórios publicados pelos tribunais. Base pdfjs-dist já existe no projeto.",
  },
  {
    job_type: "sp_auto_import.collect",
    agent_name: "sp_auto_import_agent",
    status: "planned",
    descricao: "Importação automática de CSVs da Fazenda/SP e ZIPs mensais de despesas (CGU). Lógica base já existe.",
  },
  {
    job_type: "tjsp_pendentes.collect",
    agent_name: "tjsp_pendentes_agent",
    status: "planned",
    descricao: "Scraping HTML público eSAJ/TJSP para processos pendentes. Sujeito a rate limit.",
  },
  {
    job_type: "tjsp_pagamentos.collect",
    agent_name: "tjsp_pagamentos_agent",
    status: "planned",
    descricao: "Coleta de movimentações de pagamento via TJSP. Dependente de tjsp_pendentes.collect.",
  },
  {
    job_type: "reconciliation.run",
    agent_name: "reconciliation_agent",
    status: "planned",
    descricao: "Cruzamento entre dotação, execução e estoque judicial. Análise de gaps. Depende dos 3 agentes ativos.",
  },
  {
    job_type: "alerts.run",
    agent_name: "alerts_agent",
    status: "planned",
    descricao: "Geração de alertas baseados em divergências detectadas pelo reconciliation_agent.",
  },
  {
    job_type: "ranking.run",
    agent_name: "ranking_agent",
    status: "planned",
    descricao: "Ranking de precatórios por valor, tribunal e ente. Depende de dados normalizados dos agentes ativos.",
  },
];

export function getActiveJobs(): JobRegistryEntry[] {
  return JOB_REGISTRY.filter((j) => j.status === "active");
}

export function getPlannedJobs(): JobRegistryEntry[] {
  return JOB_REGISTRY.filter((j) => j.status === "planned");
}

export function getJobByType(job_type: JobType): JobRegistryEntry | undefined {
  return JOB_REGISTRY.find((j) => j.job_type === job_type);
}
