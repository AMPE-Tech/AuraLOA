import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import {
  estoqueRequestSchema,
  gapRequestSchema,
  SCHEMA_VERSION,
} from "../../shared/loa_types";
import type {
  EstoqueResult,
  GapResult,
  CruzamentoAcaoItem,
  SourceInfo,
} from "../../shared/loa_types";
import { EvidencePack, computeSHA256 } from "../services/evidence_pack";
import { fetchEstoque } from "../services/estoque_tribunais";
import { computeGapAnalysis } from "../services/gap_analysis";
import { fetchExecucaoFromTransparencia } from "../services/transparencia_execucao";
import { fetchDotacaoFromSIOP } from "../services/siop_dotacao";
import { ACOES_PRECATORIOS_UNIAO } from "../catalog/acoes_precatorios_uniao";

const router = Router();

router.post("/api/loa/uniao/estoque", async (req: Request, res: Response) => {
  const processId = randomUUID();
  const evidencePack = new EvidencePack(processId);

  try {
    const parsed = estoqueRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Input invalido",
        details: parsed.error.issues,
      });
    }

    const { ano_exercicio, tribunais, classes, max_por_tribunal } = parsed.data;
    evidencePack.log(`start estoque process_id=${processId} year=${ano_exercicio}`);
    evidencePack.saveRequest(req.body);

    const estoqueResult = await fetchEstoque({
      ano_exercicio,
      tribunais,
      classes,
      max_por_tribunal: max_por_tribunal || 500,
      evidencePack,
    });

    const tribunaisConsultados = estoqueResult.por_tribunal.map((t) => t.tribunal_alias);
    const allErro = estoqueResult.por_tribunal.every((t) => t.status === "ERRO");
    const allOk = estoqueResult.por_tribunal.every((t) => t.status === "OK");
    const statusGeral = allErro ? "NAO_LOCALIZADO" as const : allOk ? "OK" as const : "PARCIAL" as const;

    const responseObj: EstoqueResult = {
      schema_version: SCHEMA_VERSION,
      process_id_uuid: processId,
      ano_exercicio,
      generated_at_iso: new Date().toISOString(),
      status_geral: statusGeral,
      providers_used: estoqueResult.providers_used,
      tribunais_consultados: tribunaisConsultados,
      summary: {
        total_processos: estoqueResult.total_processos,
        total_precatorios: estoqueResult.total_precatorios,
        total_rpvs: estoqueResult.total_rpvs,
        por_tribunal: estoqueResult.por_tribunal,
      },
      processos: estoqueResult.processos,
      sources: estoqueResult.sources,
      evidencias_count: estoqueResult.evidences.length,
      hashes: {
        output_sha256: "PLACEHOLDER",
      },
      evidence_pack_path: evidencePack.getBasePath(),
    };

    const preHash = JSON.stringify(responseObj, null, 2);
    responseObj.hashes.output_sha256 = computeSHA256(preHash);

    evidencePack.saveResponse(responseObj);

    const allHashes: Record<string, string> = {
      output: responseObj.hashes.output_sha256,
    };
    for (const ev of estoqueResult.evidences) {
      if (ev.raw_payload_sha256 && ev.raw_payload_path) {
        allHashes[ev.raw_payload_path] = ev.raw_payload_sha256;
      }
    }
    evidencePack.saveHashes(allHashes);

    evidencePack.log(`end estoque status=${statusGeral} total=${estoqueResult.total_processos}`);
    evidencePack.saveLog();

    return res.json(responseObj);
  } catch (error: any) {
    evidencePack.log(`fatal error: ${error.message}`);
    evidencePack.saveLog();
    return res.status(500).json({
      error: "Erro interno no processamento de estoque",
      message: error.message,
      process_id_uuid: processId,
    });
  }
});

router.post("/api/loa/uniao/gap-analysis", async (req: Request, res: Response) => {
  const processId = randomUUID();
  const evidencePack = new EvidencePack(processId);

  try {
    const parsed = gapRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Input invalido",
        details: parsed.error.issues,
      });
    }

    const { ano_exercicio, tribunais } = parsed.data;
    evidencePack.log(`start gap-analysis process_id=${processId} year=${ano_exercicio}`);
    evidencePack.saveRequest(req.body);

    const [execucaoResults, dotacaoResults, estoqueResult] = await Promise.all([
      fetchExecucaoFromTransparencia(ano_exercicio, evidencePack),
      fetchDotacaoFromSIOP(ano_exercicio, evidencePack),
      fetchEstoque({
        ano_exercicio,
        tribunais,
        max_por_tribunal: 500,
        evidencePack,
      }),
    ]);

    const cruzamento: CruzamentoAcaoItem[] = ACOES_PRECATORIOS_UNIAO.map((acao) => {
      const exec = execucaoResults.find((e) => e.codigo_acao === acao.codigo_acao);
      const dot = dotacaoResults.find((d) => d.codigo_acao === acao.codigo_acao);

      const dotAtual = dot?.dotacao_atual ?? null;
      const dotInicial = dot?.dotacao_inicial ?? null;
      const empApi = exec?.empenhado ?? null;
      const liqApi = exec?.liquidado ?? null;
      const pagApi = exec?.pago ?? null;

      const fonteDot = dotAtual !== null ? "SIOP SPARQL" : "Indisponivel";
      const fonteExec = empApi !== null || pagApi !== null ? "API REST Portal Transparencia" : "Indisponivel";

      let pctExec: number | null = null;
      if (dotAtual && dotAtual > 0 && pagApi !== null) {
        pctExec = (pagApi / dotAtual) * 100;
      } else if (empApi && empApi > 0 && pagApi !== null) {
        pctExec = (pagApi / empApi) * 100;
      }

      const hasDot = dotAtual !== null;
      const hasExec = empApi !== null || pagApi !== null;
      let status: "OK" | "PARCIAL" | "NAO_LOCALIZADO" = "OK";
      if (!hasDot && !hasExec) status = "NAO_LOCALIZADO";
      else if (!hasDot || !hasExec) status = "PARCIAL";

      return {
        codigo_acao: acao.codigo_acao,
        descricao_acao: acao.descricao,
        dotacao_inicial: dotInicial,
        dotacao_atual: dotAtual,
        empenhado_api: empApi,
        liquidado_api: liqApi,
        pago_api: pagApi,
        empenhado_zip: null,
        liquidado_zip: null,
        pago_zip: null,
        empenhado_final: empApi,
        liquidado_final: liqApi,
        pago_final: pagApi,
        percentual_execucao: pctExec,
        fonte_dotacao: fonteDot,
        fonte_execucao: fonteExec,
        status,
        qtd_empenhos_zip: 0,
      };
    });

    const gapResult = computeGapAnalysis({
      cruzamento,
      estoque_por_tribunal: estoqueResult.por_tribunal,
      estoque_total_processos: estoqueResult.total_processos,
      estoque_total_precatorios: estoqueResult.total_precatorios,
      estoque_total_rpvs: estoqueResult.total_rpvs,
    });

    const sources: SourceInfo[] = [
      {
        name: "Portal da Transparencia",
        url: "https://portaldatransparencia.gov.br/download-de-dados/despesas",
        type: "API",
      },
      {
        name: "SIOP Acesso Publico",
        url: "https://www1.siop.planejamento.gov.br/acessopublico/",
        type: "SPARQL",
      },
      ...estoqueResult.sources,
    ];

    const responseObj: GapResult = {
      schema_version: SCHEMA_VERSION,
      process_id_uuid: processId,
      ano_exercicio,
      generated_at_iso: new Date().toISOString(),
      status_geral: gapResult.status_geral,
      totais: gapResult.totais,
      por_acao: gapResult.por_acao,
      estoque_por_tribunal: estoqueResult.por_tribunal,
      sources,
      hashes: {
        output_sha256: "PLACEHOLDER",
      },
      evidence_pack_path: evidencePack.getBasePath(),
    };

    const preHash = JSON.stringify(responseObj, null, 2);
    responseObj.hashes.output_sha256 = computeSHA256(preHash);

    evidencePack.saveResponse(responseObj);
    evidencePack.log(`end gap-analysis status=${gapResult.status_geral}`);
    evidencePack.saveLog();

    return res.json(responseObj);
  } catch (error: any) {
    evidencePack.log(`fatal error: ${error.message}`);
    evidencePack.saveLog();
    return res.status(500).json({
      error: "Erro interno na gap analysis",
      message: error.message,
      process_id_uuid: processId,
    });
  }
});

export default router;
