import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { query } from "../db";
import { a2RequestSchema, SCHEMA_VERSION } from "../../shared/loa_types";
import type {
  A2Response,
  KPIItem,
  SourceInfo,
  A2HistoryEntry,
  CruzamentoAcaoItem,
} from "../../shared/loa_types";
import { EvidencePack, computeSHA256 } from "../services/evidence_pack";
import { fetchExecucaoFromTransparencia } from "../services/transparencia_execucao";
import { fetchDotacaoFromSIOP } from "../services/siop_dotacao";
import { buildDespesasZipUrl, downloadZipToEvidencePack, buildZipEvidencia } from "../services/transparencia_download";
import { computeExecucaoPagoPorAcaoPoFromZip } from "../services/a2_execucao_from_zip";
import type { ExecucaoPagoPorAcaoPoRow } from "../services/a2_execucao_from_zip";
import { validateOutput } from "../services/validate_output";
import { ACOES_PRECATORIOS_UNIAO } from "../catalog/acoes_precatorios_uniao";
import { downloadAllMonths, startMonthlyCron, stopMonthlyCron, getCronStatus } from "../services/cron_download";

const router = Router();

router.post("/api/loa/uniao/a2", async (req: Request, res: Response) => {
  const processId = randomUUID();
  const evidencePack = new EvidencePack(processId);

  try {
    const parsed = a2RequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Input invalido",
        details: parsed.error.issues,
      });
    }

    const { ano_exercicio, mes } = parsed.data;
    evidencePack.log(`start process_id=${processId} year=${ano_exercicio}${mes ? ` mes=${mes}` : ''}`);
    evidencePack.saveRequest(req.body);

    let zipDownloadResult: import("../../shared/loa_types").ZipDownloadInfo | undefined;
    let zipExecucaoResult: import("../../shared/loa_types").ZipExecucaoResult | undefined;
    let zipEvidences: { source_name: string; source_url: string | null; captured_at_iso: string; raw_payload_path: string; raw_payload_sha256: string; bytes: number; note?: string }[] = [];

    if (mes) {
      const zipUrl = buildDespesasZipUrl(ano_exercicio, mes);
      evidencePack.log(`downloading ZIP from ${zipUrl}`);
      try {
        const dl = await downloadZipToEvidencePack({ processId, url: zipUrl });
        evidencePack.log(`ZIP download status=${dl.status} bytes=${dl.bytes} sha256=${dl.sha256}`);
        zipDownloadResult = {
          url: dl.url,
          status: dl.status,
          ok: dl.ok,
          sha256: dl.sha256,
          bytes: dl.bytes,
          filePath: dl.filePath,
          contentType: dl.contentType,
          captured_at_iso: dl.captured_at_iso,
        };
        if (!dl.ok) {
          evidencePack.log(`ZIP download FAILED (HTTP ${dl.status}) - will NOT parse execution values from ZIP`);
        } else {
          evidencePack.log(`parsing CSV from ZIP for execution data (Pagamento_EmpenhosImpactados + Empenho join)`);
          try {
            const zipExec = await computeExecucaoPagoPorAcaoPoFromZip({
              processId,
              zipPath: dl.filePath,
              sourceUrlZip: dl.url,
              ano: ano_exercicio,
            });
            zipExecucaoResult = zipExec.result;
            zipEvidences = zipExec.evidences;
            evidencePack.log(`ZIP parse OK: ${zipExec.result.stats.empenhos_com_pagamento} empenhos com pagamento, ${zipExec.result.stats.chaves_acao_po} chaves acao/PO`);
          } catch (parseErr: any) {
            evidencePack.log(`ZIP CSV parse error: ${parseErr.message} - falling back to API-only execution data`);
          }
        }
      } catch (err: any) {
        evidencePack.log(`ZIP download error: ${err.message}`);
        zipDownloadResult = {
          url: zipUrl,
          status: 0,
          ok: false,
          sha256: "",
          bytes: 0,
          filePath: "",
          contentType: null,
          captured_at_iso: new Date().toISOString(),
        };
      }
    }

    const [execucaoResults, dotacaoResults] = await Promise.all([
      fetchExecucaoFromTransparencia(ano_exercicio, evidencePack),
      fetchDotacaoFromSIOP(ano_exercicio, evidencePack),
    ]);

    evidencePack.log(
      `fetched execution count=${execucaoResults.length} dotation count=${dotacaoResults.length}`
    );

    const zipByAcao = new Map<string, { pago: number; empenhado: number; liquidado: number; qtd: number }>();
    if (zipExecucaoResult) {
      for (const ea of zipExecucaoResult.execucao_por_acao) {
        zipByAcao.set(ea.codigo_acao, {
          pago: ea.total_pago,
          empenhado: ea.total_empenhado,
          liquidado: ea.total_liquidado,
          qtd: ea.qtd_empenhos,
        });
      }
      evidencePack.log(`ZIP execucao by acao: ${Array.from(zipByAcao.entries()).map(([k, v]) => `${k}: emp=${v.empenhado.toFixed(2)} liq=${v.liquidado.toFixed(2)} pago=${v.pago.toFixed(2)}`).join(', ')}`);
    }

    const kpis: KPIItem[] = ACOES_PRECATORIOS_UNIAO.map((acao) => {
      const exec = execucaoResults.find((e) => e.codigo_acao === acao.codigo_acao);
      const dot = dotacaoResults.find((d) => d.codigo_acao === acao.codigo_acao);
      const zipData = zipByAcao.get(acao.codigo_acao);

      const dotacaoAtual = dot?.dotacao_atual ?? null;
      const empenhado = exec?.empenhado ?? (zipData?.empenhado || null);
      const liquidado = exec?.liquidado ?? (zipData?.liquidado || null);

      const apiPago = exec?.pago ?? null;
      const zipPago = zipData?.pago ?? null;
      const pago = apiPago ?? (zipPago && zipPago > 0 ? zipPago : null);

      let percentualExecucao: number | null = null;
      if (dotacaoAtual && dotacaoAtual > 0 && pago !== null) {
        percentualExecucao = (pago / dotacaoAtual) * 100;
      } else if (empenhado && empenhado > 0 && pago !== null) {
        percentualExecucao = (pago / empenhado) * 100;
      }

      let status: "OK" | "PARCIAL" | "NAO_LOCALIZADO" = "OK";
      if (
        exec?.status === "NAO_LOCALIZADO" &&
        dot?.status === "NAO_LOCALIZADO" &&
        !zipData
      ) {
        status = "NAO_LOCALIZADO";
      } else if (
        exec?.status !== "OK" ||
        dot?.status !== "OK"
      ) {
        status = "PARCIAL";
      }

      return {
        codigo_acao: acao.codigo_acao,
        descricao_acao: acao.descricao,
        dotacao_atual: dotacaoAtual,
        empenhado,
        liquidado,
        pago,
        percentual_execucao: percentualExecucao,
        status,
      };
    });

    const cruzamento: CruzamentoAcaoItem[] = ACOES_PRECATORIOS_UNIAO.map((acao) => {
      const exec = execucaoResults.find((e) => e.codigo_acao === acao.codigo_acao);
      const dot = dotacaoResults.find((d) => d.codigo_acao === acao.codigo_acao);
      const zipData = zipByAcao.get(acao.codigo_acao);

      const dotInicial = dot?.dotacao_inicial ?? null;
      const dotAtual = dot?.dotacao_atual ?? null;

      const empApi = exec?.empenhado ?? null;
      const liqApi = exec?.liquidado ?? null;
      const pagApi = exec?.pago ?? null;

      const empZip = zipData?.empenhado ?? null;
      const liqZip = zipData?.liquidado ?? null;
      const pagZip = zipData?.pago ?? null;

      const empFinal = empApi ?? (empZip && empZip > 0 ? empZip : null);
      const liqFinal = liqApi ?? (liqZip && liqZip > 0 ? liqZip : null);
      const pagFinal = pagApi ?? (pagZip && pagZip > 0 ? pagZip : null);

      let pctExec: number | null = null;
      if (dotAtual && dotAtual > 0 && pagFinal !== null) {
        pctExec = (pagFinal / dotAtual) * 100;
      } else if (empFinal && empFinal > 0 && pagFinal !== null) {
        pctExec = (pagFinal / empFinal) * 100;
      }

      const fonteDot = dotAtual !== null ? (dot?.observacoes?.includes("SIOP") ? "SIOP SPARQL" : "Orcamento SPARQL") : "Indisponivel";
      let fonteExec = "Indisponivel";
      if (empApi !== null || pagApi !== null) fonteExec = "API REST Portal Transparencia";
      else if (empZip !== null || pagZip !== null) fonteExec = "ZIP CSV Portal Transparencia";

      let status: "OK" | "PARCIAL" | "NAO_LOCALIZADO" = "OK";
      const hasDot = dotAtual !== null;
      const hasExec = empFinal !== null || pagFinal !== null;
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
        empenhado_zip: empZip && empZip > 0 ? empZip : null,
        liquidado_zip: liqZip && liqZip > 0 ? liqZip : null,
        pago_zip: pagZip && pagZip > 0 ? pagZip : null,
        empenhado_final: empFinal,
        liquidado_final: liqFinal,
        pago_final: pagFinal,
        percentual_execucao: pctExec,
        fonte_dotacao: fonteDot,
        fonte_execucao: fonteExec,
        status,
        qtd_empenhos_zip: zipData?.qtd ?? 0,
      };
    });

    evidencePack.log(`cruzamento built: ${cruzamento.filter(c => c.status === 'OK').length} OK, ${cruzamento.filter(c => c.status === 'PARCIAL').length} PARCIAL, ${cruzamento.filter(c => c.status === 'NAO_LOCALIZADO').length} NAO_LOCALIZADO`);

    const allNAO =
      execucaoResults.every((e) => e.status === "NAO_LOCALIZADO") &&
      dotacaoResults.every((d) => d.status === "NAO_LOCALIZADO");

    let statusGeral: "OK" | "PARCIAL" | "NAO_LOCALIZADO";
    if (allNAO) {
      statusGeral = "NAO_LOCALIZADO";
    } else if (
      execucaoResults.every((e) => e.status === "OK") &&
      dotacaoResults.every((d) => d.status === "OK")
    ) {
      statusGeral = "OK";
    } else {
      statusGeral = "PARCIAL";
    }

    const sources: SourceInfo[] = [
      {
        name: "Portal da Transparencia",
        url: "https://portaldatransparencia.gov.br/download-de-dados/despesas",
        type: "CSV",
      },
      {
        name: "SIOP Acesso Publico",
        url: "https://www1.siop.planejamento.gov.br/acessopublico/",
        type: "SPARQL",
      },
    ];

    const zipEvidenciasAsItems: import("../../shared/loa_types").EvidenciaItem[] = zipEvidences.map((ev) => ({
      source_name: ev.source_name,
      source_url: ev.source_url ?? "",
      captured_at_iso: ev.captured_at_iso,
      raw_payload_sha256: ev.raw_payload_sha256,
      raw_payload_path: ev.raw_payload_path,
    }));

    const allEvidencias = [
      ...execucaoResults.flatMap((e) => e.evidencias),
      ...dotacaoResults.flatMap((d) => d.evidencias),
      ...(zipDownloadResult ? [buildZipEvidencia({
        ok: zipDownloadResult.ok,
        status: zipDownloadResult.status,
        statusText: String(zipDownloadResult.status),
        url: zipDownloadResult.url,
        filePath: zipDownloadResult.filePath,
        sha256: zipDownloadResult.sha256,
        bytes: zipDownloadResult.bytes,
        captured_at_iso: zipDownloadResult.captured_at_iso,
        contentType: zipDownloadResult.contentType,
      })] : []),
      ...zipEvidenciasAsItems,
    ];

    const responseObj: A2Response = {
      schema_version: SCHEMA_VERSION,
      process_id_uuid: processId,
      ano_exercicio,
      ...(mes ? { mes } : {}),
      generated_at_iso: new Date().toISOString(),
      status_geral: statusGeral,
      sources,
      data: {
        dotacao: dotacaoResults,
        execucao: execucaoResults,
        kpis,
        cruzamento,
        ...(zipExecucaoResult ? { execucao_zip: zipExecucaoResult } : {}),
      },
      ...(zipDownloadResult ? { zip_download: zipDownloadResult } : {}),
      evidencias_count: allEvidencias.length,
      hashes: {
        output_sha256: "PLACEHOLDER",
      },
      evidence_pack_path: evidencePack.getBasePath(),
    };

    const preHashContent = JSON.stringify(responseObj, null, 2);
    const outputHash = computeSHA256(preHashContent);
    responseObj.hashes.output_sha256 = outputHash;

    evidencePack.saveResponse(responseObj);

    const allHashes: Record<string, string> = {
      output: outputHash,
    };
    for (const ev of allEvidencias) {
      if (ev.raw_payload_sha256 && ev.raw_payload_path) {
        allHashes[ev.raw_payload_path] = ev.raw_payload_sha256;
      }
    }
    evidencePack.saveHashes(allHashes);

    const validation = validateOutput(responseObj);
    if (!validation.valid) {
      evidencePack.log(`validation errors: ${validation.errors.join("; ")}`);
    }

    evidencePack.log(`end status=${statusGeral}`);
    evidencePack.saveLog();

    const totalPago = execucaoResults.reduce((s, e) => s + (e.pago || 0), 0);
    const totalDot = dotacaoResults.reduce((s, d) => s + (d.dotacao_atual || 0), 0);

    await query(
      `INSERT INTO loa_history
         (id, process_id_uuid, ano_exercicio, mes, status_geral, generated_at_iso,
          evidencias_count, execucao_total_pago, dotacao_total, zip_downloaded)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        processId,
        processId,
        ano_exercicio,
        mes ?? null,
        statusGeral,
        responseObj.generated_at_iso,
        allEvidencias.length,
        totalPago || null,
        totalDot || null,
        zipDownloadResult ? zipDownloadResult.ok : null,
      ],
    );

    return res.json(responseObj);
  } catch (error: any) {
    evidencePack.log(`fatal error: ${error.message}`);
    evidencePack.saveLog();

    return res.status(500).json({
      error: "Erro interno no processamento A2",
      message: error.message,
      process_id_uuid: processId,
    });
  }
});

router.get("/api/loa/uniao/a2/history", async (_req: Request, res: Response) => {
  try {
    const rows = await query<{
      id: string; process_id_uuid: string; ano_exercicio: number; mes: number | null;
      status_geral: string; generated_at_iso: string; evidencias_count: number;
      execucao_total_pago: number | null; dotacao_total: number | null; zip_downloaded: boolean | null;
    }>(
      "SELECT * FROM loa_history ORDER BY created_at DESC LIMIT 50",
    );
    const history = rows.map((r) => ({
      id: r.id,
      process_id_uuid: r.process_id_uuid,
      ano_exercicio: r.ano_exercicio,
      ...(r.mes != null ? { mes: r.mes } : {}),
      status_geral: r.status_geral as "OK" | "PARCIAL" | "NAO_LOCALIZADO",
      generated_at_iso: r.generated_at_iso,
      evidencias_count: r.evidencias_count,
      execucao_total_pago: r.execucao_total_pago,
      dotacao_total: r.dotacao_total,
      ...(r.zip_downloaded != null ? { zip_downloaded: r.zip_downloaded } : {}),
    }));
    return res.json(history);
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao buscar historico", message: err.message });
  }
});

router.get("/api/loa/uniao/a2/catalog", (_req: Request, res: Response) => {
  return res.json({
    acoes: ACOES_PRECATORIOS_UNIAO,
    total: ACOES_PRECATORIOS_UNIAO.length,
  });
});

router.post("/api/loa/uniao/a2/batch-download", async (req: Request, res: Response) => {
  try {
    const { ano_exercicio } = req.body;
    const ano = Number(ano_exercicio) || new Date().getFullYear();

    const result = await downloadAllMonths(ano);

    const okCount = result.results.filter(r => r.ok).length;
    const failCount = result.results.filter(r => !r.ok).length;

    return res.json({
      process_id: result.processId,
      ano_exercicio: ano,
      summary: {
        total: 12,
        downloaded: okCount,
        failed: failCount,
      },
      results: result.results,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Erro no batch download",
      message: error.message,
    });
  }
});

router.get("/api/loa/uniao/a2/cron/status", (_req: Request, res: Response) => {
  return res.json(getCronStatus());
});

router.post("/api/loa/uniao/a2/cron/start", (req: Request, res: Response) => {
  const ano = req.body?.ano_exercicio ? Number(req.body.ano_exercicio) : undefined;
  startMonthlyCron(ano);
  return res.json({ status: "started", message: "Download automatico agendado para dia 1 de cada mes as 03:00" });
});

router.post("/api/loa/uniao/a2/cron/stop", (_req: Request, res: Response) => {
  stopMonthlyCron();
  return res.json({ status: "stopped" });
});

startMonthlyCron();

export default router;
