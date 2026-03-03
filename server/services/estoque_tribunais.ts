import type { EstoqueProcesso, EstoqueSummaryByTribunal, EstoqueProvider, SourceInfo } from "../../shared/loa_types";
import { EvidencePack } from "./evidence_pack";
import { fetchEstoqueFromDataJud, TRIBUNAIS_FEDERAIS, CLASSE_PRECATORIO, CLASSE_RPV } from "./estoque_datajud";
import { downloadAndParseTribunalPDF, enrichProcessosWithValores, computePDFSummary } from "./valor_precatorio_pdf";

export interface EstoqueOrchestratorOptions {
  ano_exercicio: number;
  tribunais?: string[];
  classes?: number[];
  max_por_tribunal?: number;
  evidencePack: EvidencePack;
}

export interface PDFOrcamentoSummary {
  tribunal: string;
  ano_orcamento: number;
  total_precatorios_pdf: number;
  valor_total_orcamento: number;
  valor_alimentar: number;
  valor_comum: number;
  total_idoso: number;
  total_deficiencia: number;
  fonte_url: string;
  sha256: string;
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
  pdf_orcamento_summaries: PDFOrcamentoSummary[];
}

export async function fetchEstoque(options: EstoqueOrchestratorOptions): Promise<EstoqueOrchestratorResult> {
  const {
    ano_exercicio,
    tribunais,
    classes,
    max_por_tribunal = 10000,
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

  const tribunaisComProcessos = Array.from(new Set(allProcessos.map((p) => p.tribunal_alias)));
  const tribunaisParaEnriquecer = ["trf6"].filter((t) => tribunaisComProcessos.includes(t));
  const pdfSummaries: PDFOrcamentoSummary[] = [];

  for (const tribunalAlias of tribunaisParaEnriquecer) {
    try {
      evidencePack.log(`ValorEnrichment: starting for ${tribunalAlias} year=${ano_exercicio}`);
      const valorIndex = await downloadAndParseTribunalPDF(tribunalAlias, ano_exercicio, evidencePack);
      if (valorIndex) {
        const result = enrichProcessosWithValores(allProcessos, valorIndex, tribunalAlias);
        evidencePack.log(`ValorEnrichment ${tribunalAlias}: enriched ${result.enriched}/${result.total} processos with values from PDF`);

        const summary = computePDFSummary(valorIndex);
        pdfSummaries.push({
          tribunal: valorIndex.tribunal,
          ano_orcamento: valorIndex.ano_orcamento,
          ...summary,
          fonte_url: valorIndex.fonte_url,
          sha256: valorIndex.sha256,
        });
        evidencePack.log(`ValorEnrichment ${tribunalAlias} PDF summary: ${summary.total_precatorios_pdf} prec, valor_total=${summary.valor_total_orcamento.toFixed(2)}`);
      }
    } catch (err: any) {
      evidencePack.log(`ValorEnrichment ${tribunalAlias} error: ${err.message}`);
    }
  }

  const sources: SourceInfo[] = [
    {
      name: "CNJ DataJud API Publica",
      url: "https://api-publica.datajud.cnj.jus.br",
      type: "API",
    },
    ...tribunaisParaEnriquecer.length > 0
      ? [{
          name: "Relacao Precatorios TRF6 (PDF Oficial)",
          url: "https://portal.trf6.jus.br/rpv-e-precatorios/consulta-precatorio-e-rpv/",
          type: "WEB" as const,
        }]
      : [],
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
    pdf_orcamento_summaries: pdfSummaries,
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
