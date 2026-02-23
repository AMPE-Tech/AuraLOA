import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { EvidencePack, computeSHA256 } from "../services/evidence_pack";
import {
  lockResource,
  unlockResource,
  checkResourceLock,
  listAllLocks,
  getAuditLog,
  getProtectedResources,
  lockAllPipelineResources,
  checkIntegrity,
  authorizeModification,
} from "../services/dpo_guard";
import {
  checkRegression,
  saveBaseline,
  loadBaseline,
  getCurrentMetrics,
} from "../services/anti_regression";
import {
  validateNoHallucination,
  getKnownDomains,
} from "../services/anti_hallucination";
import { fetchExecucaoFromTransparencia } from "../services/transparencia_execucao";
import { fetchDotacaoFromSIOP } from "../services/siop_dotacao";
import { fetchEstoque } from "../services/estoque_tribunais";
import { computeGapAnalysis } from "../services/gap_analysis";
import { ACOES_PRECATORIOS_UNIAO } from "../catalog/acoes_precatorios_uniao";
import type { CruzamentoAcaoItem } from "../../shared/loa_types";

const router = Router();

router.get("/api/loa/uniao/dpo/locks", (_req: Request, res: Response) => {
  const locks = listAllLocks();
  const protectedResources = getProtectedResources();
  return res.json({
    locks,
    protected_resources: protectedResources,
    total_locked: locks.filter(l => l.status === "LOCKED").length,
    total_resources: protectedResources.length,
  });
});

router.post("/api/loa/uniao/dpo/lock", (req: Request, res: Response) => {
  const schema = z.object({
    resource: z.string(),
    locked_by: z.string(),
    reason: z.string(),
    content_hash: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Input invalido", details: parsed.error.issues });

  const { resource, locked_by, reason, content_hash } = parsed.data;
  const hash = content_hash || computeSHA256(resource + ":" + new Date().toISOString());
  const entry = lockResource(resource, locked_by, reason, hash);
  return res.json({
    status: "LOCKED",
    message: `Recurso "${resource}" travado pelo DPO. Token de desbloqueio gerado.`,
    lock: { ...entry },
    aviso: "GUARDE O TOKEN DE DESBLOQUEIO EM LOCAL SEGURO. Sem ele nao sera possivel alterar este recurso.",
  });
});

router.post("/api/loa/uniao/dpo/unlock", (req: Request, res: Response) => {
  const schema = z.object({
    resource: z.string(),
    token: z.string(),
    unlocked_by: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Input invalido", details: parsed.error.issues });

  const { resource, token, unlocked_by } = parsed.data;
  const result = unlockResource(resource, token, unlocked_by);
  const status = result.success ? 200 : 403;
  return res.status(status).json(result);
});

router.post("/api/loa/uniao/dpo/check-integrity", (req: Request, res: Response) => {
  const schema = z.object({
    resource: z.string(),
    current_hash: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Input invalido", details: parsed.error.issues });

  const result = checkIntegrity(parsed.data.resource, parsed.data.current_hash);
  return res.json(result);
});

router.get("/api/loa/uniao/dpo/audit-log", (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 100;
  const log = getAuditLog(limit);
  return res.json({ entries: log, total: log.length });
});

router.post("/api/loa/uniao/dpo/lock-all", (req: Request, res: Response) => {
  const schema = z.object({
    locked_by: z.string(),
    reason: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Input invalido", details: parsed.error.issues });

  const result = lockAllPipelineResources(parsed.data.locked_by, parsed.data.reason);
  return res.json({
    status: "ALL_LOCKED",
    message: `${result.locked.length} recursos travados pelo DPO.`,
    locked_resources: result.locked,
    tokens: result.tokens,
    aviso: "GUARDE TODOS OS TOKENS EM LOCAL SEGURO. Sem eles alteracoes serao bloqueadas.",
  });
});

router.post("/api/loa/uniao/regression/check", (_req: Request, res: Response) => {
  const ano = Number(_req.body?.ano_exercicio) || new Date().getFullYear();
  const current = getCurrentMetrics();
  const result = checkRegression(ano, current);
  return res.json(result);
});

router.post("/api/loa/uniao/regression/baseline", (req: Request, res: Response) => {
  const ano = Number(req.body?.ano_exercicio) || new Date().getFullYear();
  const current = getCurrentMetrics();
  const baseline = saveBaseline(ano, current as any);
  return res.json({
    status: "BASELINE_SAVED",
    baseline,
    message: `Baseline salvo para ano ${ano}. Futuras execucoes serao comparadas com este baseline.`,
  });
});

router.post("/api/loa/uniao/cruzamento-completo", async (req: Request, res: Response) => {
  const processId = randomUUID();
  const evidencePack = new EvidencePack(processId);

  try {
    const ano_exercicio = Number(req.body?.ano_exercicio) || new Date().getFullYear();
    evidencePack.log(`start cruzamento-completo process_id=${processId} year=${ano_exercicio}`);
    evidencePack.saveRequest(req.body);

    const [execucaoResults, dotacaoResults, estoqueResult] = await Promise.all([
      fetchExecucaoFromTransparencia(ano_exercicio, evidencePack),
      fetchDotacaoFromSIOP(ano_exercicio, evidencePack),
      fetchEstoque({
        ano_exercicio,
        max_por_tribunal: 2000,
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
      if (dotAtual && dotAtual > 0 && pagApi !== null) pctExec = (pagApi / dotAtual) * 100;
      else if (empApi && empApi > 0 && pagApi !== null) pctExec = (pagApi / empApi) * 100;

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

    const pendentes = estoqueResult.processos.filter(p => p.pagamento_pendente);
    const pdfSummaries = estoqueResult.pdf_orcamento_summaries || [];

    const BOM = "\uFEFF";
    const sep = ";";

    let csv = BOM;
    csv += "=== CRUZAMENTO COMPLETO DOTACAO x EXECUCAO x ESTOQUE x VALORES ===\n";
    csv += `Ano Exercicio: ${ano_exercicio}\n`;
    csv += `Gerado em: ${new Date().toISOString()}\n`;
    csv += `Process ID: ${processId}\n\n`;

    csv += "=== CAMADA 1: DOTACAO (LOA/SIOP) ===\n";
    csv += ["Codigo Acao", "Descricao", "Dotacao Inicial (R$)", "Dotacao Atual (R$)", "Fonte", "Status"].join(sep) + "\n";
    for (const c of cruzamento) {
      csv += [
        c.codigo_acao,
        `"${c.descricao_acao}"`,
        c.dotacao_inicial !== null ? c.dotacao_inicial.toFixed(2) : "",
        c.dotacao_atual !== null ? c.dotacao_atual.toFixed(2) : "",
        c.fonte_dotacao,
        c.status,
      ].join(sep) + "\n";
    }

    csv += "\n=== CAMADA 2: EXECUCAO (Portal da Transparencia) ===\n";
    csv += ["Codigo Acao", "Descricao", "Empenhado (R$)", "Liquidado (R$)", "Pago (R$)", "% Execucao", "Fonte", "Status"].join(sep) + "\n";
    for (const c of cruzamento) {
      csv += [
        c.codigo_acao,
        `"${c.descricao_acao}"`,
        c.empenhado_final !== null ? c.empenhado_final.toFixed(2) : "",
        c.liquidado_final !== null ? c.liquidado_final.toFixed(2) : "",
        c.pago_final !== null ? c.pago_final.toFixed(2) : "",
        c.percentual_execucao !== null ? c.percentual_execucao.toFixed(2) + "%" : "",
        c.fonte_execucao,
        c.status,
      ].join(sep) + "\n";
    }

    csv += "\n=== CAMADA 3: ESTOQUE (CNJ DataJud) ===\n";
    csv += ["Tribunal", "Total Processos", "Precatorios", "RPVs", "Provider", "Status"].join(sep) + "\n";
    for (const t of estoqueResult.por_tribunal) {
      csv += [t.tribunal, String(t.total_processos), String(t.precatorios), String(t.rpvs), t.provider, t.status].join(sep) + "\n";
    }

    csv += `\nTotal Processos: ${estoqueResult.total_processos}\n`;
    csv += `Total Precatorios: ${estoqueResult.total_precatorios}\n`;
    csv += `Total RPVs: ${estoqueResult.total_rpvs}\n`;
    csv += `Pendentes Pagamento: ${pendentes.length}\n`;

    if (pdfSummaries.length > 0) {
      csv += "\n=== VALORES OFICIAIS (PDF Tribunal) ===\n";
      for (const pdf of pdfSummaries) {
        csv += `Tribunal: ${pdf.tribunal}\n`;
        csv += `Ano Orcamento: ${pdf.ano_orcamento}\n`;
        csv += `Total Precatorios PDF: ${pdf.total_precatorios_pdf}\n`;
        csv += `Valor Total Orcamento: R$ ${pdf.valor_total_orcamento.toFixed(2)}\n`;
        csv += `Valor Alimentar: R$ ${pdf.valor_alimentar.toFixed(2)}\n`;
        csv += `Valor Comum: R$ ${pdf.valor_comum.toFixed(2)}\n`;
        csv += `Idosos: ${pdf.total_idoso}\n`;
        csv += `PcD: ${pdf.total_deficiencia}\n`;
        csv += `Fonte URL: ${pdf.fonte_url}\n`;
        csv += `SHA-256: ${pdf.sha256}\n`;
      }
    }

    csv += "\n=== CAMADA 4: GAP ANALYSIS (Cruzamento) ===\n";
    csv += ["Codigo Acao", "Descricao", "Dotacao Atual (R$)", "Pago (R$)", "Gap (R$)", "Cobertura %", "Fonte Dot", "Fonte Exec", "Status"].join(sep) + "\n";
    for (const c of cruzamento) {
      const gap = (c.dotacao_atual !== null && c.pago_final !== null) ? (c.dotacao_atual - c.pago_final).toFixed(2) : "";
      csv += [
        c.codigo_acao,
        `"${c.descricao_acao}"`,
        c.dotacao_atual !== null ? c.dotacao_atual.toFixed(2) : "",
        c.pago_final !== null ? c.pago_final.toFixed(2) : "",
        gap,
        c.percentual_execucao !== null ? c.percentual_execucao.toFixed(2) + "%" : "",
        c.fonte_dotacao,
        c.fonte_execucao,
        c.status,
      ].join(sep) + "\n";
    }

    csv += "\n=== PRECATORIOS PENDENTES (com valores) ===\n";
    const pHeaders = [
      "Numero CNJ", "Numero Formatado", "Tribunal", "Classe", "Situacao",
      "Valor Causa (R$)", "Fonte Valor", "Data Ajuizamento", "Orgao Julgador",
      "Pagamento Pendente", "URL PJe", "URL eProc",
    ];
    csv += pHeaders.join(sep) + "\n";

    const formatCnj = (n: string) => {
      if (!n || n.length < 20) return n;
      return `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13, 14)}.${n.slice(14, 16)}.${n.slice(16, 20)}`;
    };

    for (const p of pendentes) {
      csv += [
        p.numero_cnj,
        formatCnj(p.numero_cnj),
        p.tribunal_alias.toUpperCase(),
        p.classe_nome,
        p.situacao,
        p.valor_causa !== null ? p.valor_causa.toFixed(2) : "",
        p.valor_fonte || "",
        p.data_ajuizamento || "",
        `"${p.orgao_julgador?.nome || ""}"`,
        p.pagamento_pendente ? "SIM" : "NAO",
        p.url_consulta || "",
        p.url_consulta_eproc || "",
      ].join(sep) + "\n";
    }

    csv += "\n=== FONTES DE DADOS ===\n";
    csv += ["Nome", "URL", "Tipo"].join(sep) + "\n";
    const allSources = [
      { name: "Portal da Transparencia REST API", url: "https://portaldatransparencia.gov.br/api-de-dados/despesas/por-funcional-programatica", type: "API" },
      { name: "SIOP Acesso Publico", url: "https://www1.siop.planejamento.gov.br/acessopublico/", type: "SPARQL" },
      { name: "CNJ DataJud API Publica", url: "https://api-publica.datajud.cnj.jus.br", type: "API" },
      { name: "ZIP Despesas Portal Transparencia", url: "https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/despesas/", type: "CSV" },
      ...estoqueResult.sources,
    ];
    for (const s of allSources) {
      csv += [s.name, s.url, s.type].join(sep) + "\n";
    }

    csv += "\n=== EVIDENCIAS ===\n";
    csv += `Process ID: ${processId}\n`;
    csv += `Evidence Pack: ${evidencePack.getBasePath()}\n`;
    const outputHash = computeSHA256(csv);
    csv += `Output SHA-256: ${outputHash}\n`;

    evidencePack.saveLog();

    const filename = `cruzamento_completo_${ano_exercicio}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (error: any) {
    evidencePack.log(`fatal error: ${error.message}`);
    evidencePack.saveLog();
    return res.status(500).json({ error: "Erro ao gerar cruzamento completo", message: error.message });
  }
});

router.get("/api/loa/uniao/contrato-tecnico", (_req: Request, res: Response) => {
  const contratoTecnico = generateContratoTecnico();
  return res.json(contratoTecnico);
});

function generateContratoTecnico() {
  const now = new Date().toISOString();
  const contentHash = computeSHA256(JSON.stringify({
    version: "1.0.0",
    generated: now,
    module: "AuraLOA",
  }));

  return {
    contrato_tecnico_master: {
      titulo: "Contrato Tecnico Master - Modulo AuraLOA A2",
      versao: "1.0.0",
      data_geracao: now,
      sha256: contentHash,
      modulo: "AuraLOA - Pesquisa de Precatorios na LOA",
      escopo: "Modulo Federal (Uniao) com 4 camadas de dados cruzados",
    },

    clausulas_anti_regressao: {
      descricao: "Clausulas que impedem degradacao do sistema entre versoes",
      regras: [
        {
          id: "AR-001",
          titulo: "Preservacao do Catalogo de Acoes",
          descricao: "O catalogo de 7 acoes orcamentarias de precatorios (0005, 0EC7, 0EC8, 0625, 00WU, 00G5, 0022) NAO pode ser reduzido sem autorizacao DPO.",
          severidade: "CRITICA",
          verificacao: "Automatica via checkRegression()",
          codigo_referencia: "server/catalog/acoes_precatorios_uniao.ts",
        },
        {
          id: "AR-002",
          titulo: "Preservacao de Fontes de Dados",
          descricao: "As fontes ativas (Portal da Transparencia, SIOP, CNJ DataJud, PDF Oficial) NAO podem ser removidas.",
          severidade: "CRITICA",
          verificacao: "Automatica via checkRegression()",
          codigo_referencia: "server/services/transparencia_execucao.ts, server/services/siop_dotacao.ts, server/services/estoque_datajud.ts, server/services/valor_precatorio_pdf.ts",
        },
        {
          id: "AR-003",
          titulo: "Preservacao de Endpoints",
          descricao: "Nenhum endpoint da API pode ser removido sem autorizacao DPO.",
          severidade: "CRITICA",
          verificacao: "Automatica via checkRegression()",
          codigo_referencia: "server/routes/loa_uniao_a2.ts, server/routes/loa_estoque.ts, server/routes/loa_dpo.ts",
        },
        {
          id: "AR-004",
          titulo: "Evidence Pack Obrigatorio",
          descricao: "Toda consulta deve gerar evidence pack completo com request.json, response.json, raw/, hashes.json e run.log.",
          severidade: "CRITICA",
          verificacao: "Automatica via validateEvidenceFiles()",
          codigo_referencia: "server/services/evidence_pack.ts",
        },
        {
          id: "AR-005",
          titulo: "SHA-256 Hashing Obrigatorio",
          descricao: "Todo output e artefato raw deve ter hash SHA-256 computado e registrado.",
          severidade: "CRITICA",
          verificacao: "Automatica via validateOutput()",
          codigo_referencia: "server/services/evidence_pack.ts:computeSHA256()",
        },
      ],
    },

    clausulas_anti_alucinacao: {
      descricao: "Clausulas que impedem insercao de dados ficticios ou fabricados",
      regras: [
        {
          id: "AH-001",
          titulo: "Zero Mock Data",
          descricao: "PROIBIDO usar dados mock, fake, dummy, placeholder ou sample em qualquer saida do sistema.",
          severidade: "CRITICA",
          verificacao: "Automatica via validateNoHallucination() - regex scan",
          codigo_referencia: "server/services/anti_hallucination.ts",
          padroes_bloqueados: ["mock", "fake", "dummy", "placeholder_value", "test_data", "sample_data", "lorem ipsum", "example.com"],
        },
        {
          id: "AH-002",
          titulo: "Fontes Governamentais Exclusivas",
          descricao: "Apenas URLs de dominios governamentais oficiais (.gov.br, .jus.br) sao aceitas como fonte de dados.",
          severidade: "CRITICA",
          verificacao: "Automatica via validateSourceURL()",
          dominios_aceitos: [
            "portaldatransparencia.gov.br",
            "dadosabertos-download.cgu.gov.br",
            "orcamento.dados.gov.br",
            "siop.planejamento.gov.br",
            "api-publica.datajud.cnj.jus.br",
            "portal.trf6.jus.br",
            "processual.trf1.jus.br",
            "eproc2g.trf6.jus.br",
          ],
        },
        {
          id: "AH-003",
          titulo: "Valor com Evidencia",
          descricao: "Todo valor numerico (R$) com status OK deve ter trilha de evidencias com hash SHA-256.",
          severidade: "CRITICA",
          verificacao: "Automatica via validateNoHallucination() + validateOutput()",
          codigo_referencia: "server/services/validate_output.ts, server/services/anti_hallucination.ts",
        },
        {
          id: "AH-004",
          titulo: "Degradacao Graceful",
          descricao: "Quando uma fonte nao esta disponivel, o sistema DEVE retornar NAO_LOCALIZADO ou PARCIAL, NUNCA inventar valores.",
          severidade: "CRITICA",
          verificacao: "Por design - status tri-state (OK/PARCIAL/NAO_LOCALIZADO)",
          codigo_referencia: "shared/loa_types.ts",
        },
        {
          id: "AH-005",
          titulo: "Formato CNJ Valido",
          descricao: "Numeros de processo devem ter entre 15 e 25 digitos no padrao CNJ.",
          severidade: "WARNING",
          verificacao: "Automatica via validateNoHallucination()",
        },
        {
          id: "AH-006",
          titulo: "Valores Nao-Negativos",
          descricao: "Valores monetarios (valor_causa, dotacao, pago, etc) devem ser >= 0.",
          severidade: "CRITICA",
          verificacao: "Automatica via validateNoHallucination()",
        },
      ],
    },

    clausula_dpo: {
      descricao: "Sistema de trava contra alteracoes sem autorizacao expressa do DPO",
      regras: [
        {
          id: "DPO-001",
          titulo: "Lock de Recursos",
          descricao: "Todo recurso critico (pipeline, catalogo, config, output) pode ser travado pelo DPO. Alteracoes bloqueadas sem token valido.",
          severidade: "CRITICA",
          codigo_referencia: "server/services/dpo_guard.ts",
          endpoint: "POST /api/loa/uniao/dpo/lock",
        },
        {
          id: "DPO-002",
          titulo: "Auditoria Completa",
          descricao: "Todas as tentativas de lock/unlock/modificacao/verificacao sao registradas em log de auditoria JSONL.",
          severidade: "CRITICA",
          codigo_referencia: "server/services/dpo_guard.ts:appendAuditLog()",
          endpoint: "GET /api/loa/uniao/dpo/audit-log",
        },
        {
          id: "DPO-003",
          titulo: "Verificacao de Integridade",
          descricao: "SHA-256 do recurso no momento do lock e comparado com hash atual para detectar alteracoes nao autorizadas.",
          severidade: "CRITICA",
          codigo_referencia: "server/services/dpo_guard.ts:checkIntegrity()",
          endpoint: "POST /api/loa/uniao/dpo/check-integrity",
        },
        {
          id: "DPO-004",
          titulo: "Token de Autorizacao",
          descricao: "Desbloqueio requer token criptografico (32 bytes random, SHA-256 hashed) gerado no momento do lock.",
          severidade: "CRITICA",
          codigo_referencia: "server/services/dpo_guard.ts:generateToken()",
        },
        {
          id: "DPO-005",
          titulo: "Lock Global",
          descricao: "DPO pode travar todos os recursos protegidos de uma vez com um unico comando.",
          endpoint: "POST /api/loa/uniao/dpo/lock-all",
        },
      ],
      recursos_protegidos: getProtectedResources(),
    },

    pipeline_tecnico: {
      descricao: "Pipeline de dados do modulo AuraLOA com 4 camadas",
      camadas: [
        {
          numero: 1,
          nome: "Dotacao / LOA (SIOP)",
          descricao: "Consulta orcamento aprovado via SPARQL em orcamento.dados.gov.br e SIOP",
          fonte_primaria: "https://orcamento.dados.gov.br/sparql",
          fonte_fallback: "https://www1.siop.planejamento.gov.br/acessopublico/",
          codigo: "server/services/siop_dotacao.ts",
          output: "DotacaoItem[] - dotacao_inicial, dotacao_atual por acao",
          limitacoes: "SIOP bloqueado por Cloudflare WAF; dados publicos ate ~2016",
        },
        {
          numero: 2,
          nome: "Execucao / Portal da Transparencia",
          descricao: "Consulta empenho/liquidacao/pagamento via REST API e ZIP CSVs",
          fonte_api: "https://portaldatransparencia.gov.br/api-de-dados/despesas/por-funcional-programatica",
          fonte_zip: "https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/despesas/YYYYMM01_Despesas.zip",
          codigo_api: "server/services/transparencia_execucao.ts",
          codigo_zip: "server/services/a2_execucao_from_zip.ts",
          autenticacao: "Header chave-api-dados (env: PORTAL_TRANSPARENCIA_API_KEY)",
          output: "ExecucaoItem[] - empenhado, liquidado, pago por acao",
        },
        {
          numero: 3,
          nome: "Estoque / CNJ DataJud",
          descricao: "Consulta estoque judicial de precatorios e RPVs via API publica Elasticsearch",
          fonte: "https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal}/_search",
          classes: "1265 (Precatorio), 1266 (RPV)",
          tribunais: "TRF1, TRF2, TRF3, TRF4, TRF5, TRF6",
          codigo: "server/services/estoque_datajud.ts, server/services/estoque_tribunais.ts",
          output: "EstoqueProcesso[] - numero_cnj, valor_causa, situacao, movimentos",
          enriquecimento: {
            pdf_oficial: {
              descricao: "Relacao oficial de precatorios para orcamento (PDF do tribunal)",
              url_trf6: "https://portal.trf6.jus.br/wp-content/uploads/2024/05/precatorios-federias-trf6-orcamento-2025.pdf",
              codigo: "server/services/valor_precatorio_pdf.ts",
              output: "PrecatorioValorEntry[] - numero_precatorio, valor, preferencia (IDOSO/PcD)",
              cache: "./Saida/cache/pdf_valores/",
            },
            consulta_trf6: {
              pje: "https://processual.trf1.jus.br/consultaProcessual/processo.php?secao=TRF6&proc={numero}",
              eproc: "https://eproc2g.trf6.jus.br/eproc/controlador.php?acao=processo_selecionar&num_processo={numero}",
            },
          },
        },
        {
          numero: 4,
          nome: "Gap Analysis (Cruzamento)",
          descricao: "Cruzamento das 3 camadas por acao orcamentaria com metricas de cobertura",
          codigo: "server/services/gap_analysis.ts",
          output: "GapAcaoItem[] - gap_dotacao_vs_pago, cobertura_pct por acao",
          metricas: "dotacao_total, pago_total, gap, cobertura_pct, estoque_total",
        },
      ],
    },

    catalogo_acoes: {
      descricao: "7 acoes orcamentarias de precatorios da Uniao monitoradas",
      codigo_referencia: "server/catalog/acoes_precatorios_uniao.ts",
      acoes: ACOES_PRECATORIOS_UNIAO.map(a => ({
        codigo: a.codigo_acao,
        descricao: a.descricao,
        planos_orcamentarios: a.planos_orcamentarios || [],
      })),
    },

    endpoints_api: [
      { metodo: "POST", path: "/api/loa/uniao/a2", descricao: "Analise completa Dotacao x Execucao" },
      { metodo: "GET", path: "/api/loa/uniao/a2/history", descricao: "Historico de consultas" },
      { metodo: "GET", path: "/api/loa/uniao/a2/catalog", descricao: "Catalogo de acoes precatorias" },
      { metodo: "POST", path: "/api/loa/uniao/a2/batch-download", descricao: "Download batch dos 12 ZIPs" },
      { metodo: "GET", path: "/api/loa/uniao/a2/cron/status", descricao: "Status do cron automatico" },
      { metodo: "POST", path: "/api/loa/uniao/a2/cron/start", descricao: "Iniciar cron mensal" },
      { metodo: "POST", path: "/api/loa/uniao/a2/cron/stop", descricao: "Parar cron mensal" },
      { metodo: "POST", path: "/api/loa/uniao/estoque", descricao: "Consulta estoque CNJ DataJud" },
      { metodo: "POST", path: "/api/loa/uniao/gap-analysis", descricao: "Gap Analysis 4 camadas" },
      { metodo: "POST", path: "/api/loa/uniao/precatorios-pendentes", descricao: "Precatorios pendentes" },
      { metodo: "POST", path: "/api/loa/uniao/precatorios-pendentes/csv", descricao: "Export CSV pendentes" },
      { metodo: "POST", path: "/api/loa/uniao/precatorios-pendentes/json-export", descricao: "Export JSON pendentes" },
      { metodo: "POST", path: "/api/loa/uniao/cruzamento-completo", descricao: "Planilha cruzamento 4 camadas com valores" },
      { metodo: "GET", path: "/api/loa/uniao/dpo/locks", descricao: "Listar locks DPO ativos" },
      { metodo: "POST", path: "/api/loa/uniao/dpo/lock", descricao: "Travar recurso (requer DPO)" },
      { metodo: "POST", path: "/api/loa/uniao/dpo/unlock", descricao: "Destravar recurso (requer token)" },
      { metodo: "POST", path: "/api/loa/uniao/dpo/check-integrity", descricao: "Verificar integridade SHA-256" },
      { metodo: "GET", path: "/api/loa/uniao/dpo/audit-log", descricao: "Log de auditoria DPO" },
      { metodo: "POST", path: "/api/loa/uniao/dpo/lock-all", descricao: "Travar todos recursos" },
      { metodo: "GET", path: "/api/loa/uniao/contrato-tecnico", descricao: "Contrato Tecnico Master" },
      { metodo: "POST", path: "/api/loa/uniao/regression/check", descricao: "Verificacao anti-regressao" },
      { metodo: "POST", path: "/api/loa/uniao/regression/baseline", descricao: "Salvar baseline" },
    ],

    sistema_evidencias: {
      descricao: "Sistema de evidencias com rastreabilidade completa",
      componentes: [
        { nome: "Evidence Pack", descricao: "Pacote completo por consulta com request.json, response.json, raw/, hashes.json, run.log", codigo: "server/services/evidence_pack.ts" },
        { nome: "SHA-256 Hashing", descricao: "Todo artefato tem hash SHA-256 para verificacao de integridade", funcao: "computeSHA256()" },
        { nome: "DPO Audit Log", descricao: "Log JSONL de todas as operacoes DPO (lock/unlock/check)", arquivo: "./Saida/dpo_audit.jsonl" },
        { nome: "Baselines", descricao: "Snapshots de metricas para comparacao anti-regressao", diretorio: "./Saida/baselines/" },
        { nome: "Cache PDF", descricao: "Cache de PDFs parseados com SHA-256", diretorio: "./Saida/cache/pdf_valores/" },
      ],
      diretorio_raiz: "./Saida/evidence/{process_id_uuid}/",
    },

    urls_fontes_oficiais: [
      { nome: "Portal da Transparencia API", url: "https://portaldatransparencia.gov.br/api-de-dados", tipo: "REST API" },
      { nome: "Portal da Transparencia Downloads", url: "https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/despesas/", tipo: "CSV/ZIP" },
      { nome: "SIOP Acesso Publico", url: "https://www1.siop.planejamento.gov.br/acessopublico/", tipo: "SPARQL" },
      { nome: "Orcamento Dados Abertos", url: "https://orcamento.dados.gov.br/sparql", tipo: "SPARQL" },
      { nome: "CNJ DataJud API Publica", url: "https://api-publica.datajud.cnj.jus.br", tipo: "Elasticsearch" },
      { nome: "TRF6 Portal", url: "https://portal.trf6.jus.br", tipo: "WEB" },
      { nome: "TRF6 PDF Precatorios Orcamento 2025", url: "https://portal.trf6.jus.br/wp-content/uploads/2024/05/precatorios-federias-trf6-orcamento-2025.pdf", tipo: "PDF" },
      { nome: "TRF1 Consulta Processual (PJe)", url: "https://processual.trf1.jus.br/consultaProcessual/processo.php", tipo: "WEB" },
      { nome: "TRF6 eProc", url: "https://eproc2g.trf6.jus.br/eproc/controlador.php", tipo: "WEB" },
    ],

    arquivos_codigo: {
      frontend: [
        "client/src/pages/loa-dashboard.tsx",
        "client/src/pages/precatorios-pendentes.tsx",
        "client/src/App.tsx",
      ],
      backend_routes: [
        "server/routes/loa_uniao_a2.ts",
        "server/routes/loa_estoque.ts",
        "server/routes/loa_dpo.ts",
      ],
      backend_services: [
        "server/services/transparencia_execucao.ts",
        "server/services/transparencia_download.ts",
        "server/services/a2_execucao_from_zip.ts",
        "server/services/siop_dotacao.ts",
        "server/services/estoque_datajud.ts",
        "server/services/estoque_tribunais.ts",
        "server/services/valor_precatorio_pdf.ts",
        "server/services/gap_analysis.ts",
        "server/services/evidence_pack.ts",
        "server/services/validate_output.ts",
        "server/services/dpo_guard.ts",
        "server/services/anti_regression.ts",
        "server/services/anti_hallucination.ts",
        "server/services/cron_download.ts",
      ],
      shared: [
        "shared/loa_types.ts",
      ],
      catalog: [
        "server/catalog/acoes_precatorios_uniao.ts",
      ],
    },

    assinatura_tecnica: {
      sistema: "AuraLOA A2",
      versao_schema: "br.gov.orcamento.precatorios.uniao.a2.v1",
      gerado_em: now,
      sha256_contrato: contentHash,
      nota: "Este contrato tecnico e gerado automaticamente e reflete o estado atual do sistema. Qualquer alteracao nos componentes protegidos requer autorizacao expressa do DPO.",
    },
  };
}

export default router;
