import type { SourceKind } from "./source_kinds";
import type { JobType } from "../runtime/job_types";

export type ExecutionMode =
  | "existing_api_agent"
  | "existing_sparql_agent"
  | "future_pdf_agent"
  | "future_html_agent"
  | "future_csv_agent"
  | "future_zip_agent";

export type SourceStatus = "active" | "planned";

export interface AuraLOASource {
  source_name: string;
  source_kind: SourceKind;
  sistema_origem: string;
  ente_padrao: string | null;
  target_agent: string;
  target_job_type: JobType;
  execution_mode: ExecutionMode;
  status: SourceStatus;
  observacao_operacional: string;
}

export const AURALOA_SOURCES: AuraLOASource[] = [
  {
    source_name: "DataJud CNJ",
    source_kind: "api_datajud",
    sistema_origem: "api-publica.datajud.cnj.jus.br",
    ente_padrao: "UNIAO",
    target_agent: "judicial_stock_agent",
    target_job_type: "judicial_stock.collect",
    execution_mode: "existing_api_agent",
    status: "active",
    observacao_operacional:
      "Elasticsearch público CNJ. Coleta processos de classe Precatório (1265) e RPV (1266). Cobre TRF1-TRF6 e TJSP. Sem autenticação adicional.",
  },
  {
    source_name: "SIOP/Orçamento SPARQL",
    source_kind: "sparql_dotacao",
    sistema_origem: "orcamento.dados.gov.br / www1.siop.planejamento.gov.br",
    ente_padrao: "UNIAO",
    target_agent: "loa_dotacao_agent",
    target_job_type: "loa_dotacao.collect",
    execution_mode: "existing_sparql_agent",
    status: "active",
    observacao_operacional:
      "SPARQL público cobre dados até ~2016. SIOP SPARQL bloqueado externamente para anos recentes. Retorna PARCIAL para exercícios > 2016. Sem chave de API.",
  },
  {
    source_name: "Portal da Transparência REST API",
    source_kind: "api_execucao_financeira",
    sistema_origem: "api.portaldatransparencia.gov.br",
    ente_padrao: "UNIAO",
    target_agent: "execution_finance_agent",
    target_job_type: "execucao.collect",
    execution_mode: "existing_api_agent",
    status: "active",
    observacao_operacional:
      "API REST paginada. Requer PORTAL_TRANSPARENCIA_API_KEY. Coleta por ação orçamentária (ACOES_PRECATORIOS_UNIAO). Retorna PAGO+LIQUIDADO+EMPENHADO.",
  },
  {
    source_name: "PDF Oficial de Precatórios (Tribunais)",
    source_kind: "pdf_oficial",
    sistema_origem: "portal.trf6.jus.br e equivalentes",
    ente_padrao: null,
    target_agent: "orcamento_pdf_agent",
    target_job_type: "orcamento_pdf.collect",
    execution_mode: "future_pdf_agent",
    status: "planned",
    observacao_operacional:
      "PDFs publicados pelos tribunais com valores orçamentários de precatórios. Parsing via pdfjs-dist já existe no projeto. Agente dedicado não criado ainda.",
  },
  {
    source_name: "HTML Público TJSP (eSAJ)",
    source_kind: "html_publico",
    sistema_origem: "esaj.tjsp.jus.br",
    ente_padrao: "SP",
    target_agent: "tjsp_pendentes_agent",
    target_job_type: "tjsp_pendentes.collect",
    execution_mode: "future_html_agent",
    status: "planned",
    observacao_operacional:
      "Consulta pública de processos via HTML scraping. URL padrão: /cpopg/open.do?processo.numero={CNJ}. Sem autenticação. Sujeito a bloqueio por rate limit.",
  },
  {
    source_name: "CSV Fazenda/SP (dworcamento)",
    source_kind: "csv_publico",
    sistema_origem: "dworcamento.fazenda.sp.gov.br",
    ente_padrao: "SP",
    target_agent: "sp_auto_import_agent",
    target_job_type: "sp_auto_import.collect",
    execution_mode: "future_csv_agent",
    status: "planned",
    observacao_operacional:
      "CSVs de dotação e execução SP disponíveis via download direto desde 2011. Importação manual já existe no módulo LOA SP. Agente automatizado planejado.",
  },
  {
    source_name: "ZIP Mensal de Despesas (CGU)",
    source_kind: "zip_publico",
    sistema_origem: "dadosabertos-download.cgu.gov.br",
    ente_padrao: "UNIAO",
    target_agent: "zip_despesas_agent",
    target_job_type: "sp_auto_import.collect",
    execution_mode: "future_zip_agent",
    status: "planned",
    observacao_operacional:
      "ZIPs mensais de despesas federais publicados pela CGU. Download e parsing já existem via transparencia_download.ts e a2_execucao_from_zip.ts. Agente autônomo planejado.",
  },
];
