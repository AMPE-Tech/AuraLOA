export const SOURCE_KINDS = {
  api_datajud:             "api_datajud",
  sparql_dotacao:          "sparql_dotacao",
  api_execucao_financeira: "api_execucao_financeira",
  pdf_oficial:             "pdf_oficial",
  html_publico:            "html_publico",
  csv_publico:             "csv_publico",
  zip_publico:             "zip_publico",
} as const;

export type SourceKind = (typeof SOURCE_KINDS)[keyof typeof SOURCE_KINDS];
