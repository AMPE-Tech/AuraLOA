import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { a2RequestSchema, SCHEMA_VERSION } from "../../shared/loa_types";
import type {
  A2Response,
  KPIItem,
  SourceInfo,
  A2HistoryEntry,
} from "../../shared/loa_types";
import { EvidencePack, computeSHA256 } from "../services/evidence_pack";
import { fetchExecucaoFromTransparencia } from "../services/transparencia_execucao";
import { fetchDotacaoFromSIOP } from "../services/siop_dotacao";
import { validateOutput } from "../services/validate_output";
import { ACOES_PRECATORIOS_UNIAO } from "../catalog/acoes_precatorios_uniao";

const router = Router();

const history: A2HistoryEntry[] = [];

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

    const { ano_exercicio } = parsed.data;
    evidencePack.log(`start process_id=${processId} year=${ano_exercicio}`);
    evidencePack.saveRequest(req.body);

    const [execucaoResults, dotacaoResults] = await Promise.all([
      fetchExecucaoFromTransparencia(ano_exercicio, evidencePack),
      fetchDotacaoFromSIOP(ano_exercicio, evidencePack),
    ]);

    evidencePack.log(
      `fetched execution count=${execucaoResults.length} dotation count=${dotacaoResults.length}`
    );

    const kpis: KPIItem[] = ACOES_PRECATORIOS_UNIAO.map((acao) => {
      const exec = execucaoResults.find((e) => e.codigo_acao === acao.codigo_acao);
      const dot = dotacaoResults.find((d) => d.codigo_acao === acao.codigo_acao);

      const dotacaoAtual = dot?.dotacao_atual ?? null;
      const empenhado = exec?.empenhado ?? null;
      const liquidado = exec?.liquidado ?? null;
      const pago = exec?.pago ?? null;

      let percentualExecucao: number | null = null;
      if (dotacaoAtual && dotacaoAtual > 0 && pago !== null) {
        percentualExecucao = (pago / dotacaoAtual) * 100;
      } else if (empenhado && empenhado > 0 && pago !== null) {
        percentualExecucao = (pago / empenhado) * 100;
      }

      let status: "OK" | "PARCIAL" | "NAO_LOCALIZADO" = "OK";
      if (
        exec?.status === "NAO_LOCALIZADO" &&
        dot?.status === "NAO_LOCALIZADO"
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

    const allEvidencias = [
      ...execucaoResults.flatMap((e) => e.evidencias),
      ...dotacaoResults.flatMap((d) => d.evidencias),
    ];

    const responseObj: A2Response = {
      schema_version: SCHEMA_VERSION,
      process_id_uuid: processId,
      ano_exercicio,
      generated_at_iso: new Date().toISOString(),
      status_geral: statusGeral,
      sources,
      data: {
        dotacao: dotacaoResults,
        execucao: execucaoResults,
        kpis,
      },
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

    history.unshift({
      id: processId,
      process_id_uuid: processId,
      ano_exercicio,
      status_geral: statusGeral,
      generated_at_iso: responseObj.generated_at_iso,
      evidencias_count: allEvidencias.length,
      execucao_total_pago: totalPago || null,
      dotacao_total: totalDot || null,
    });

    if (history.length > 50) history.pop();

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

router.get("/api/loa/uniao/a2/history", (_req: Request, res: Response) => {
  return res.json(history);
});

router.get("/api/loa/uniao/a2/catalog", (_req: Request, res: Response) => {
  return res.json({
    acoes: ACOES_PRECATORIOS_UNIAO,
    total: ACOES_PRECATORIOS_UNIAO.length,
  });
});

export default router;
