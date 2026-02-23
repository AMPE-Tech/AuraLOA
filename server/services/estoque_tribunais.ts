import type { EstoqueProcesso, EstoqueSummaryByTribunal, EstoqueProvider, SourceInfo } from "../../shared/loa_types";
import { EvidencePack } from "./evidence_pack";
import { fetchEstoqueFromDataJud, TRIBUNAIS_FEDERAIS, CLASSE_PRECATORIO, CLASSE_RPV } from "./estoque_datajud";

export interface EstoqueOrchestratorOptions {
  ano_exercicio: number;
  tribunais?: string[];
  classes?: number[];
  max_por_tribunal?: number;
  evidencePack: EvidencePack;
}

export interface EstoqueOrchestratorResult {
  processos: EstoqueProcesso[];
  por_tribunal: EstoqueSummaryByTribunal[];
  providers_used: EstoqueProvider[];
  sources: SourceInfo[];
  evidences: { source_name: string; source_url: string; captured_at_iso: string; raw_payload_sha256: string; raw_payload_path: string; bytes: number }[];
  total_processos: number;
  total_precatorios: number;
  total_rpvs: number;
}

export async function fetchEstoque(options: EstoqueOrchestratorOptions): Promise<EstoqueOrchestratorResult> {
  const {
    ano_exercicio,
    tribunais,
    classes,
    max_por_tribunal = 500,
    evidencePack,
  } = options;

  const targetTribunais = tribunais && tribunais.length > 0
    ? TRIBUNAIS_FEDERAIS.filter((t) => tribunais.includes(t.alias))
    : TRIBUNAIS_FEDERAIS;

  const classeCodigos = classes && classes.length > 0
    ? classes
    : [CLASSE_PRECATORIO, CLASSE_RPV];

  evidencePack.log(`Estoque orchestrator: ${targetTribunais.length} tribunais, classes=[${classeCodigos.join(",")}], max=${max_por_tribunal}/tribunal`);

  const allProcessos: EstoqueProcesso[] = [];
  const porTribunal: EstoqueSummaryByTribunal[] = [];
  const allEvidences: EstoqueOrchestratorResult["evidences"] = [];
  const providersUsed = new Set<EstoqueProvider>();

  const results = await Promise.allSettled(
    targetTribunais.map((tribunal) =>
      fetchFromProviders({
        tribunal_alias: tribunal.alias,
        classe_codigos: classeCodigos,
        ano_exercicio,
        max_results: max_por_tribunal,
        evidencePack,
      })
    )
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { processos, summary, evidences, provider } = result.value;
      allProcessos.push(...processos);
      porTribunal.push(summary);
      allEvidences.push(...evidences);
      providersUsed.add(provider);
    } else {
      evidencePack.log(`Estoque orchestrator: tribunal promise rejected: ${result.reason}`);
    }
  }

  const totalPrec = allProcessos.filter((p) => p.classe_codigo === CLASSE_PRECATORIO).length;
  const totalRpv = allProcessos.filter((p) => p.classe_codigo === CLASSE_RPV).length;

  evidencePack.log(`Estoque orchestrator: total=${allProcessos.length} (prec=${totalPrec}, rpv=${totalRpv}) from ${porTribunal.length} tribunais`);

  const sources: SourceInfo[] = [
    {
      name: "CNJ DataJud API Publica",
      url: "https://api-publica.datajud.cnj.jus.br",
      type: "API",
    },
  ];

  return {
    processos: allProcessos,
    por_tribunal: porTribunal,
    providers_used: Array.from(providersUsed),
    sources,
    evidences: allEvidences,
    total_processos: allProcessos.length,
    total_precatorios: totalPrec,
    total_rpvs: totalRpv,
  };
}

async function fetchFromProviders(params: {
  tribunal_alias: string;
  classe_codigos: number[];
  ano_exercicio: number;
  max_results: number;
  evidencePack: EvidencePack;
}): Promise<{
  processos: EstoqueProcesso[];
  summary: EstoqueSummaryByTribunal;
  evidences: EstoqueOrchestratorResult["evidences"];
  provider: EstoqueProvider;
}> {
  const datajudResult = await fetchEstoqueFromDataJud({
    tribunal_alias: params.tribunal_alias,
    classe_codigos: params.classe_codigos,
    ano_exercicio: params.ano_exercicio,
    max_results: params.max_results,
    evidencePack: params.evidencePack,
  });

  if (datajudResult.summary.status !== "ERRO") {
    return {
      ...datajudResult,
      provider: "datajud",
    };
  }

  params.evidencePack.log(`DataJud failed for ${params.tribunal_alias}, CSV/scraping providers not yet implemented`);

  return {
    processos: [],
    summary: {
      ...datajudResult.summary,
      observacoes: `DataJud indisponivel, providers alternativos nao implementados`,
    },
    evidences: datajudResult.evidences,
    provider: "datajud",
  };
}
