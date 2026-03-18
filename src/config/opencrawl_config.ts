// OpenCrawl está DISABLED BY DEFAULT.
// Para habilitar em ambiente controlado, defina OPENCRAWL_ENABLED=true.
// Não habilitar em produção sem instrução explícita do DPO/Governança Técnica AuraLOA.

export type OpenCrawlMode = "disabled" | "dry_run" | "enabled";

export interface OpenCrawlConfig {
  enabled: boolean;
  mode: OpenCrawlMode;
  timeout_ms: number;
  observacao: string;
}

// Lê a flag dinamicamente em cada chamada — permite controle via env sem recarregar módulo.
export function getOpencrawlConfig(): OpenCrawlConfig {
  const enabled = process.env.OPENCRAWL_ENABLED === "true";
  return {
    enabled,
    mode: enabled ? "dry_run" : "disabled",
    timeout_ms: 30000,
    observacao: enabled
      ? "OpenCrawl em modo dry_run — plumbing ativo, sem execução distribuída real."
      : "OpenCrawl desabilitado por padrão. Defina OPENCRAWL_ENABLED=true para habilitar em ambiente controlado.",
  };
}
