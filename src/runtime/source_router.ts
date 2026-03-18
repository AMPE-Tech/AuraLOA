import type { AuraLOASource, ExecutionMode } from "../catalog/auraloa_sources";
import type { JobType } from "./job_types";

export interface SourceRouteResult {
  source_name: string;
  source_kind: string;
  target_agent: string;
  target_job_type: JobType;
  execution_mode: ExecutionMode;
  status: "active" | "planned";
  routable_now: boolean;
  observacao: string;
}

export function routeSource(source: AuraLOASource): SourceRouteResult {
  const routable_now = source.status === "active";

  const observacao = routable_now
    ? `Fonte ativa. Agente ${source.target_agent} disponível para execução imediata via job_runner.`
    : `Fonte planejada. Agente ${source.target_agent} ainda não implementado. Roteamento futuro via ${source.execution_mode}.`;

  return {
    source_name: source.source_name,
    source_kind: source.source_kind,
    target_agent: source.target_agent,
    target_job_type: source.target_job_type,
    execution_mode: source.execution_mode,
    status: source.status,
    routable_now,
    observacao,
  };
}

export function routeBySourceName(
  sources: AuraLOASource[],
  source_name: string,
): SourceRouteResult | null {
  const source = sources.find((s) => s.source_name === source_name);
  if (!source) return null;
  return routeSource(source);
}

export function routeAll(sources: AuraLOASource[]): SourceRouteResult[] {
  return sources.map(routeSource);
}
