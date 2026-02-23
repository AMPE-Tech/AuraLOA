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
  PrecatorioPendenteResult,
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

router.post("/api/loa/uniao/precatorios-pendentes", async (req: Request, res: Response) => {
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
    evidencePack.log(`start precatorios-pendentes process_id=${processId} year=${ano_exercicio}`);
    evidencePack.saveRequest(req.body);

    const estoqueResult = await fetchEstoque({
      ano_exercicio,
      tribunais,
      classes,
      max_por_tribunal: max_por_tribunal || 2000,
      evidencePack,
    });

    const pendentes = estoqueResult.processos.filter((p) => p.pagamento_pendente);

    const precPendentes = pendentes.filter((p) => p.classe_codigo === 1265);
    const rpvPendentes = pendentes.filter((p) => p.classe_codigo === 1266);

    const porTribunalPendentes = estoqueResult.por_tribunal.map((t) => {
      const tribPendentes = pendentes.filter((p) => p.tribunal_alias === t.tribunal_alias);
      return {
        ...t,
        total_processos: tribPendentes.length,
        precatorios: tribPendentes.filter((p) => p.classe_codigo === 1265).length,
        rpvs: tribPendentes.filter((p) => p.classe_codigo === 1266).length,
        observacoes: `${tribPendentes.length} pendentes de ${t.total_processos} total`,
      };
    });

    const responseObj: PrecatorioPendenteResult = {
      schema_version: SCHEMA_VERSION,
      process_id_uuid: processId,
      ano_exercicio,
      generated_at_iso: new Date().toISOString(),
      status_geral: pendentes.length > 0 ? "OK" : "NAO_LOCALIZADO",
      total_pendentes: pendentes.length,
      total_precatorios_pendentes: precPendentes.length,
      total_rpvs_pendentes: rpvPendentes.length,
      por_tribunal: porTribunalPendentes,
      processos: pendentes,
      sources: estoqueResult.sources,
      evidencias_count: estoqueResult.evidences.length,
      hashes: { output_sha256: "PLACEHOLDER" },
      evidence_pack_path: evidencePack.getBasePath(),
      ultima_atualizacao_iso: new Date().toISOString(),
      pdf_orcamento_summaries: estoqueResult.pdf_orcamento_summaries,
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

    evidencePack.log(`end precatorios-pendentes total_pendentes=${pendentes.length} prec=${precPendentes.length} rpv=${rpvPendentes.length}`);
    evidencePack.saveLog();

    return res.json(responseObj);
  } catch (error: any) {
    evidencePack.log(`fatal error: ${error.message}`);
    evidencePack.saveLog();
    return res.status(500).json({
      error: "Erro interno ao buscar precatorios pendentes",
      message: error.message,
      process_id_uuid: processId,
    });
  }
});

router.post("/api/loa/uniao/precatorios-pendentes/csv", async (req: Request, res: Response) => {
  try {
    const parsed = estoqueRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Input invalido", details: parsed.error.issues });
    }

    const { ano_exercicio, tribunais, classes, max_por_tribunal } = parsed.data;
    const processId = randomUUID();
    const evidencePack = new EvidencePack(processId);

    const estoqueResult = await fetchEstoque({
      ano_exercicio,
      tribunais,
      classes,
      max_por_tribunal: max_por_tribunal || 2000,
      evidencePack,
    });

    const pendentes = estoqueResult.processos.filter((p) => p.pagamento_pendente);

    const BOM = "\uFEFF";
    const sep = ";";
    const headers = [
      "Numero CNJ",
      "Numero Formatado",
      "Tribunal",
      "Classe Codigo",
      "Classe Nome",
      "Situacao",
      "Valor Causa",
      "Fonte Valor",
      "Data Ajuizamento",
      "Data Ultima Atualizacao",
      "Orgao Julgador",
      "Assuntos",
      "Total Movimentos",
      "Ultima Movimentacao",
      "Data Ultima Movimentacao",
      "Pagamento Pendente",
      "Tem Baixa",
      "Tem Pagamento",
      "URL Consulta PJe",
      "URL Consulta eProc",
    ];

    const formatCnj = (n: string) => {
      if (!n || n.length < 20) return n;
      return `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13, 14)}.${n.slice(14, 16)}.${n.slice(16, 20)}`;
    };

    const escCsv = (v: string) => {
      if (v.includes(sep) || v.includes('"') || v.includes("\n")) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    };

    const rows = pendentes.map((p) => [
      escCsv(p.numero_cnj),
      escCsv(formatCnj(p.numero_cnj)),
      escCsv(p.tribunal_alias.toUpperCase()),
      String(p.classe_codigo),
      escCsv(p.classe_nome),
      escCsv(p.situacao),
      p.valor_causa !== null ? String(p.valor_causa) : "",
      p.valor_fonte || "",
      p.data_ajuizamento || "",
      p.data_ultima_atualizacao || "",
      escCsv(p.orgao_julgador?.nome || ""),
      escCsv(p.assuntos.map((a) => a.nome).join(", ")),
      String(p.total_movimentos),
      escCsv(p.ultima_movimentacao?.nome || ""),
      p.ultima_movimentacao?.data || "",
      p.pagamento_pendente ? "Sim" : "Nao",
      p.tem_baixa ? "Sim" : "Nao",
      p.tem_pagamento ? "Sim" : "Nao",
      p.url_consulta || "",
      p.url_consulta_eproc || "",
    ].join(sep));

    const csv = BOM + headers.join(sep) + "\n" + rows.join("\n");
    const filename = `precatorios_pendentes_${ano_exercicio}_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao gerar CSV", message: error.message });
  }
});

router.post("/api/loa/uniao/precatorios-pendentes/json-export", async (req: Request, res: Response) => {
  try {
    const parsed = estoqueRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Input invalido", details: parsed.error.issues });
    }

    const { ano_exercicio, tribunais, classes, max_por_tribunal } = parsed.data;
    const processId = randomUUID();
    const evidencePack = new EvidencePack(processId);

    const estoqueResult = await fetchEstoque({
      ano_exercicio,
      tribunais,
      classes,
      max_por_tribunal: max_por_tribunal || 2000,
      evidencePack,
    });

    const pendentes = estoqueResult.processos.filter((p) => p.pagamento_pendente);
    const filename = `precatorios_pendentes_${ano_exercicio}_${new Date().toISOString().slice(0, 10)}.json`;

    const exportData = {
      exportado_em: new Date().toISOString(),
      ano_exercicio,
      total_pendentes: pendentes.length,
      total_precatorios: pendentes.filter((p) => p.classe_codigo === 1265).length,
      total_rpvs: pendentes.filter((p) => p.classe_codigo === 1266).length,
      process_id_uuid: processId,
      output_sha256: computeSHA256(JSON.stringify(pendentes)),
      processos: pendentes,
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(exportData, null, 2));
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao gerar JSON", message: error.message });
  }
});

export default router;
