import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { fetchPrecatorioByNumero } from "../services/estoque_datajud";
import { validateToken, getUserPlan } from "./auth";

import { query } from "../db";

async function salvarPesquisa(opts: {
  numero_processo: string;
  numero_oficio?: string;
  resultado: any;
  ip: string;
  user_plan: string;
  fonte_cache: boolean;
}) {
  const r = opts.resultado;
  await query(
    `INSERT INTO pesquisas_validador
      (numero_processo, numero_oficio, tribunal,
       encontrado, status_datajud, valor_rs,
       data_autuacao, data_transito, pagamento_pendente,
       url_consulta, url_origem,
       ip_origem, user_plan, fonte_cache, resultado_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      opts.numero_processo,
      opts.numero_oficio ?? null,
      r.tribunal ?? null,
      r.encontrado ?? false,
      r.status ?? null,
      r.valor_causa ?? (r.valor_rs ? parseFloat(String(r.valor_rs).replace(/[^0-9,]/g, "").replace(",", ".")) : null),
      r.data_autuacao ?? null,
      r.data_transito ?? null,
      r.pagamento_pendente ?? null,
      r.url_consulta ?? null,
      r.url_origem ?? null,
      opts.ip,
      opts.user_plan,
      opts.fonte_cache,
      JSON.stringify(r),
    ]
  );
}

const router = Router();

const validarSchema = z.object({
  numero_oficio: z.string().min(1).max(100),
  numero_processo: z.string().min(10).max(50),
  // URL de verificação extraída do próprio documento — tem prioridade sobre DataJud
  url_verificacao_documento: z.string().url().max(500).optional(),
});

// ── Rate limiting em memória (por IP) ────────────────────────────────────────
// Máximo de 10 consultas por IP a cada 60 segundos
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateEntry { count: number; resetAt: number }
const rateMap = new Map<string, RateEntry>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

// Limpa entradas expiradas a cada 5 minutos para não vazar memória
setInterval(() => {
  const now = Date.now();
  rateMap.forEach((entry, ip) => {
    if (now > entry.resetAt) rateMap.delete(ip);
  });
}, 5 * 60_000);

// ── Cache de resultados por CNJ (TTL 5 minutos) ───────────────────────────────
const CACHE_TTL_MS = 5 * 60_000;
interface CacheEntry { result: any; expiresAt: number }
const resultCache = new Map<string, CacheEntry>();

function getCached(cnj: string): any | null {
  const entry = resultCache.get(cnj);
  if (!entry || Date.now() > entry.expiresAt) {
    resultCache.delete(cnj);
    return null;
  }
  return entry.result;
}

function setCache(cnj: string, result: any) {
  resultCache.set(cnj, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Endpoint público ──────────────────────────────────────────────────────────
router.post("/api/validador/verificar", async (req: Request, res: Response) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim()
    || req.socket.remoteAddress
    || "unknown";

  const { allowed, retryAfterSec } = checkRateLimit(ip);
  if (!allowed) {
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      error: "Limite de consultas atingido. Tente novamente em breve.",
      retry_after_sec: retryAfterSec,
    });
  }

  // ── Controle de plano para usuários autenticados ──────────────────────────
  // Usuários não autenticados ficam limitados a 3 consultas por sessão (sessionStorage no frontend)
  // Usuários autenticados têm limite definido pelo plano
  const authHeader = req.headers.authorization;
  let userPlanInfo: { plan: string; subscription_status: string; consultas_limite: number } | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const tokenData = validateToken(token);
    if (tokenData.valid && tokenData.email) {
      userPlanInfo = await getUserPlan(tokenData.email);
      // Informa o plano e limite ao frontend via headers
      res.setHeader("X-Plan", userPlanInfo.plan);
      res.setHeader("X-Plan-Limit", String(userPlanInfo.consultas_limite));
    }
  }
  // ── fim controle de plano ─────────────────────────────────────────────────

  const parsed = validarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Campos obrigatorios: numero_oficio e numero_processo",
      details: parsed.error.issues,
    });
  }

  const { numero_oficio, numero_processo, url_verificacao_documento } = parsed.data;

  // Verifica cache antes de consultar a API externa
  const cached = getCached(numero_processo);
  if (cached) {
    const resultadoCache = url_verificacao_documento && !cached.url_consulta
      ? { ...cached, url_consulta: url_verificacao_documento, url_origem: "documento" }
      : cached;

    salvarPesquisa({
      numero_processo,
      numero_oficio,
      resultado: resultadoCache,
      ip,
      user_plan: userPlanInfo?.plan ?? "anonimo",
      fonte_cache: true,
    }).catch((err) =>
      console.error("[validador] erro ao salvar cache:", err.message)
    );

    return res.json({ ...resultadoCache, _cache: true });
  }

  // Informa ao frontend quantas consultas ainda restam na janela atual
  const currentEntry = rateMap.get(ip);
  const remaining = currentEntry ? Math.max(0, RATE_LIMIT_MAX - currentEntry.count) : RATE_LIMIT_MAX - 1;
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX));

  try {
    const resultado = await fetchPrecatorioByNumero(
      numero_processo,
      numero_oficio,
      url_verificacao_documento,
    );
    setCache(numero_processo, resultado);
    return res.json(resultado);
  } catch (err: any) {
    return res.status(500).json({
      error: "Não foi possível completar a consulta nas bases oficiais.",
    });
  }
});

// ── Classificação de crédito ────────────────────────────────────────────────

function classificarCredito(resultado: any): {
  tipo_requisicao: string;
  natureza: string;
  fila_prioridade: string;
  limite_rpv: string | null;
  explicacao: string;
} {
  const tipo = resultado.tipo || "DESCONHECIDO";
  const valor = resultado.valor_causa;
  const assuntos: string[] = (resultado.assuntos || []).map((a: any) => (a.nome || "").toLowerCase());

  // Determinar natureza alimentar vs comum
  const palavrasAlimentar = ["alimentar", "salário", "salario", "pensão", "pensao", "previdenci", "aposentadoria", "invalidez", "morte", "vencimento"];
  const ehAlimentar = assuntos.some((a: string) => palavrasAlimentar.some(p => a.includes(p)));

  // RPV vs Precatório
  let tipoRequisicao = tipo;
  let limiteRpv: string | null = null;
  let explicacao = "";

  if (tipo === "RPV") {
    tipoRequisicao = "RPV — Requisição de Pequeno Valor";
    limiteRpv = "Federal: até 60 SM (~R$ 84.720) | Estadual: até 40 SM (~R$ 56.480) | Municipal: até 30 SM (~R$ 42.360)";
    explicacao = "Pagamento em até 60 dias após requisição. Não entra na fila cronológica de precatórios.";
  } else if (tipo === "PRECATORIO") {
    tipoRequisicao = "Precatório";
    explicacao = ehAlimentar
      ? "Precatório de natureza alimentar — tem preferência sobre precatórios comuns na ordem cronológica."
      : "Precatório de natureza comum — segue ordem cronológica de apresentação.";
  } else {
    tipoRequisicao = "Tipo não identificado";
    explicacao = "Não foi possível classificar o tipo de requisição com os dados disponíveis.";
  }

  const natureza = tipo === "RPV" ? "Pequeno valor" : ehAlimentar ? "Alimentar" : "Comum";
  const fila = tipo === "RPV"
    ? "Fora da fila — pagamento direto em 60 dias"
    : ehAlimentar
      ? "Preferencial — antes dos precatórios comuns"
      : "Ordem cronológica";

  return { tipo_requisicao: tipoRequisicao, natureza, fila_prioridade: fila, limite_rpv: limiteRpv, explicacao };
}

// ── Gerador de relatório HTML ───────────────────────────────────────────────

function gerarRelatorioHTML(pesquisa: any, plano: string): string {
  const r = pesquisa.resultado_json ? (typeof pesquisa.resultado_json === "string" ? JSON.parse(pesquisa.resultado_json) : pesquisa.resultado_json) : {};
  const classificacao = classificarCredito(r);
  const isFree = !plano || plano === "free" || plano === "anonimo";
  const dataConsulta = pesquisa.created_at ? new Date(pesquisa.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
  const dataRelatorio = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const situacaoLabel: Record<string, string> = {
    em_tramitacao: "Em Tramitação",
    baixado: "Baixado / Arquivado",
    pagamento_parcial: "Pagamento Parcial Identificado",
    desconhecido: "Situação Desconhecida",
    nao_localizado: "Não Localizado",
    consulta_manual_necessaria: "Consulta Manual Necessária",
  };

  const situacaoCor: Record<string, string> = {
    em_tramitacao: "#22d3ee",
    baixado: "#6b7280",
    pagamento_parcial: "#fbbf24",
    desconhecido: "#94a3b8",
    nao_localizado: "#ef4444",
  };

  const formatarValor = (v: number | null | undefined) => {
    if (v === null || v === undefined) return "Não informado";
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const movimentos = r.movimentos || [];
  const ultimosMovimentos = movimentos.slice(-10).reverse();

  const marcaDagua = isFree ? `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;pointer-events:none;display:flex;align-items:center;justify-content:center;">
      <div style="transform:rotate(-35deg);font-size:72px;font-weight:900;color:rgba(239,68,68,0.08);white-space:nowrap;letter-spacing:8px;text-transform:uppercase;user-select:none;">
        VERSÃO DE AVALIAÇÃO GRATUITA
      </div>
    </div>
  ` : "";

  const cadeiaHTML = isFree ? `
    <div style="background:#1e293b;border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:24px;text-align:center;">
      <p style="color:#f87171;font-size:14px;font-weight:600;margin:0 0 8px;">Cadeia de Custódia SHA-256 — Disponível nos planos pagos</p>
      <p style="color:#64748b;font-size:12px;margin:0;">Assine um plano para obter evidência criptográfica com rastreabilidade jurídica completa.</p>
    </div>
  ` : `
    <div style="background:#0f2818;border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#10b981;"></div>
        <span style="color:#10b981;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Cadeia de Custódia Digital — Íntegra</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#64748b;font-size:12px;padding:6px 0;">SHA-256 Evidência</td>
          <td style="color:#34d399;font-size:12px;font-family:monospace;padding:6px 0;word-break:break-all;">${r.sha256_evidencia || "—"}</td>
        </tr>
        <tr>
          <td style="color:#64748b;font-size:12px;padding:6px 0;">Timestamp ISO</td>
          <td style="color:#e2e8f0;font-size:12px;font-family:monospace;padding:6px 0;">${r.consultado_em || "—"}</td>
        </tr>
        <tr>
          <td style="color:#64748b;font-size:12px;padding:6px 0;">Conformidade</td>
          <td style="color:#34d399;font-size:12px;padding:6px 0;">Lei 13.964/2019 (Pacote Anticrime)</td>
        </tr>
      </table>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório AuraLOA — ${pesquisa.numero_processo || "Pesquisa"}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0d1117; color: #e2e8f0; font-family: 'DM Sans', system-ui, sans-serif; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
    .card { background: #162032; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 24px; margin-bottom: 16px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .label { color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .value { color: #e2e8f0; font-size: 14px; font-weight: 500; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 20px 0; }
    table.movimentos { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.movimentos th { color: #64748b; text-align: left; padding: 8px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    table.movimentos td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); color: #94a3b8; }
    @media print {
      body { background: #fff; color: #1e293b; }
      .card { border-color: #e2e8f0; background: #f8fafc; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${marcaDagua}
  <div class="container">

    <!-- Cabeçalho institucional -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid rgba(34,211,238,0.2);">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#06b6d4,#7c3aed);display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22"><path d="M12 2L4 6v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6l-8-4z" stroke="white" stroke-width="1.5"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div>
          <div style="font-size:18px;font-weight:700;color:#e2e8f0;">AuraLOA</div>
          <div style="font-size:11px;color:#64748b;">Análise Inteligente de Precatórios</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:#64748b;">Relatório gerado em</div>
        <div style="font-size:13px;color:#e2e8f0;font-weight:500;">${dataRelatorio}</div>
        ${isFree ? '<div style="margin-top:4px;"><span class="badge" style="background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.2);">VERSÃO DE AVALIAÇÃO</span></div>' : '<div style="margin-top:4px;"><span class="badge" style="background:rgba(16,185,129,0.12);color:#34d399;border:1px solid rgba(16,185,129,0.2);">✓ Verificado por AuraLOA</span></div>'}
      </div>
    </div>

    <!-- Status principal -->
    <div class="card" style="border-color:${r.encontrado ? 'rgba(34,211,238,0.3)' : 'rgba(239,68,68,0.3)'};">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <span class="badge" style="background:${r.encontrado ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'};color:${r.encontrado ? '#34d399' : '#f87171'};border:1px solid ${r.encontrado ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};">
          ${r.encontrado ? '✓ PROCESSO LOCALIZADO' : '✗ PROCESSO NÃO LOCALIZADO'}
        </span>
        <span class="badge mono" style="background:rgba(34,211,238,0.08);color:#22d3ee;border:1px solid rgba(34,211,238,0.15);">
          ${r.tipo || "—"}
        </span>
      </div>

      <div class="grid-2">
        <div>
          <div class="label">Número CNJ</div>
          <div class="value mono" style="color:#22d3ee;font-size:15px;">${r.numero_cnj || pesquisa.numero_processo || "—"}</div>
        </div>
        <div>
          <div class="label">Nº Ofício / Requisição</div>
          <div class="value mono">${r.numero_oficio || pesquisa.numero_oficio || "—"}</div>
        </div>
      </div>
    </div>

    <!-- Dados do Processo -->
    <div class="card">
      <h3 style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <span style="color:#22d3ee;">◆</span> Dados do Processo
      </h3>
      <div class="grid-2" style="gap:20px;">
        <div>
          <div class="label">Tribunal</div>
          <div class="value">${r.tribunal || "—"}</div>
        </div>
        <div>
          <div class="label">Grau</div>
          <div class="value">${r.grau || "—"}</div>
        </div>
        <div>
          <div class="label">Classe Processual</div>
          <div class="value">${r.classe_nome || r.tipo || "—"}</div>
        </div>
        <div>
          <div class="label">Situação</div>
          <div class="value" style="color:${situacaoCor[r.situacao] || '#94a3b8'};">${situacaoLabel[r.situacao] || r.situacao || "—"}</div>
        </div>
        <div>
          <div class="label">Data de Ajuizamento</div>
          <div class="value">${r.data_ajuizamento ? new Date(r.data_ajuizamento).toLocaleDateString("pt-BR") : "—"}</div>
        </div>
        <div>
          <div class="label">Última Atualização</div>
          <div class="value">${r.data_ultima_atualizacao ? new Date(r.data_ultima_atualizacao).toLocaleDateString("pt-BR") : "—"}</div>
        </div>
        <div>
          <div class="label">Valor da Causa</div>
          <div class="value" style="font-size:16px;font-weight:700;color:#22d3ee;">${formatarValor(r.valor_causa)}</div>
        </div>
        <div>
          <div class="label">Órgão Julgador</div>
          <div class="value">${r.orgao_julgador?.nome || "—"}</div>
        </div>
      </div>
      ${r.assuntos && r.assuntos.length > 0 ? `
        <hr class="divider">
        <div class="label" style="margin-bottom:8px;">Assuntos</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${r.assuntos.map((a: any) => `<span class="badge" style="background:rgba(124,58,237,0.1);color:#a78bfa;border:1px solid rgba(124,58,237,0.2);">${a.nome || a.codigo}</span>`).join("")}
        </div>
      ` : ""}
    </div>

    <!-- Classificação do Crédito -->
    <div class="card" style="border-color:rgba(251,191,36,0.2);">
      <h3 style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <span style="color:#fbbf24;">◆</span> Classificação do Crédito
      </h3>
      <div class="grid-2" style="gap:20px;">
        <div>
          <div class="label">Tipo de Requisição</div>
          <div class="value">${classificacao.tipo_requisicao}</div>
        </div>
        <div>
          <div class="label">Natureza</div>
          <div class="value">
            <span class="badge" style="background:${classificacao.natureza === 'Alimentar' ? 'rgba(16,185,129,0.1)' : classificacao.natureza === 'Pequeno valor' ? 'rgba(34,211,238,0.1)' : 'rgba(148,163,184,0.1)'};color:${classificacao.natureza === 'Alimentar' ? '#34d399' : classificacao.natureza === 'Pequeno valor' ? '#22d3ee' : '#94a3b8'};border:1px solid ${classificacao.natureza === 'Alimentar' ? 'rgba(16,185,129,0.2)' : classificacao.natureza === 'Pequeno valor' ? 'rgba(34,211,238,0.2)' : 'rgba(148,163,184,0.2)'};">
              ${classificacao.natureza}
            </span>
          </div>
        </div>
        <div>
          <div class="label">Posição na Fila</div>
          <div class="value">${classificacao.fila_prioridade}</div>
        </div>
        <div>
          <div class="label">Pagamento Pendente</div>
          <div class="value" style="color:${r.pagamento_pendente ? '#fbbf24' : '#10b981'};">
            ${r.pagamento_pendente ? '⚠ Sim — pagamento pendente' : '✓ Sem pendência identificada'}
          </div>
        </div>
      </div>
      ${classificacao.limite_rpv ? `
        <hr class="divider">
        <div class="label" style="margin-bottom:4px;">Limites RPV (Salário Mínimo 2026: R$ 1.412)</div>
        <div style="color:#94a3b8;font-size:12px;">${classificacao.limite_rpv}</div>
      ` : ""}
      <hr class="divider">
      <div style="background:rgba(251,191,36,0.06);border-radius:8px;padding:12px;border:1px solid rgba(251,191,36,0.1);">
        <p style="color:#fbbf24;font-size:12px;font-weight:500;margin:0;">ℹ ${classificacao.explicacao}</p>
      </div>
    </div>

    <!-- Status Detalhado -->
    <div class="card">
      <h3 style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <span style="color:#a78bfa;">◆</span> Status Detalhado
      </h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        <div style="background:${r.tem_pagamento ? 'rgba(16,185,129,0.08)' : 'rgba(148,163,184,0.05)'};border:1px solid ${r.tem_pagamento ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)'};border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:${r.tem_pagamento ? '#10b981' : '#475569'};">${r.tem_pagamento ? 'SIM' : 'NÃO'}</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Pagamento Detectado</div>
        </div>
        <div style="background:${r.tem_baixa ? 'rgba(107,114,128,0.08)' : 'rgba(34,211,238,0.08)'};border:1px solid ${r.tem_baixa ? 'rgba(107,114,128,0.15)' : 'rgba(34,211,238,0.15)'};border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:${r.tem_baixa ? '#6b7280' : '#22d3ee'};">${r.tem_baixa ? 'SIM' : 'NÃO'}</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Baixa / Arquivamento</div>
        </div>
        <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.15);border-radius:10px;padding:14px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#fbbf24;">${r.total_movimentos || 0}</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Movimentações</div>
        </div>
      </div>
    </div>

    <!-- Últimas Movimentações -->
    ${ultimosMovimentos.length > 0 ? `
    <div class="card">
      <h3 style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <span style="color:#06b6d4;">◆</span> Últimas Movimentações (${Math.min(ultimosMovimentos.length, 10)} de ${r.total_movimentos || 0})
      </h3>
      <table class="movimentos">
        <thead>
          <tr>
            <th style="width:120px;">Data</th>
            <th style="width:80px;">Código</th>
            <th>Descrição</th>
          </tr>
        </thead>
        <tbody>
          ${ultimosMovimentos.map((m: any) => `
            <tr>
              <td class="mono" style="font-size:11px;color:#94a3b8;">${m.data ? new Date(m.data).toLocaleDateString("pt-BR") : "—"}</td>
              <td class="mono" style="font-size:11px;color:#64748b;">${m.codigo || "—"}</td>
              <td style="color:#e2e8f0;">${m.nome || "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    ` : ""}

    <!-- Cadeia de Custódia -->
    ${cadeiaHTML}

    <!-- Link de consulta -->
    ${r.url_consulta ? `
    <div class="card" style="margin-top:16px;">
      <div class="label" style="margin-bottom:8px;">Link de Consulta no Portal do Tribunal</div>
      <a href="${r.url_consulta}" target="_blank" rel="noopener" style="color:#22d3ee;font-size:13px;word-break:break-all;">${r.url_consulta}</a>
    </div>
    ` : ""}

    <!-- Metadados da pesquisa -->
    <div style="margin-top:24px;padding:16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:8px;">
      <div class="grid-2" style="gap:12px;">
        <div>
          <div class="label">Data da Consulta</div>
          <div class="value" style="font-size:12px;">${dataConsulta}</div>
        </div>
        <div>
          <div class="label">Plano</div>
          <div class="value" style="font-size:12px;">${plano === "free" || plano === "anonimo" ? "Free (Avaliação)" : plano.charAt(0).toUpperCase() + plano.slice(1)}</div>
        </div>
      </div>
    </div>

    <!-- Disclaimer -->
    <div style="margin-top:24px;padding:16px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:#475569;font-size:10px;line-height:1.6;margin-bottom:8px;">
        <strong>Disclaimer:</strong> Este relatório foi gerado automaticamente pela plataforma AuraLOA com base em dados obtidos de fontes oficiais governamentais e judiciais. As informações apresentadas refletem o estado dos dados no momento da consulta e podem sofrer alterações. Este documento não constitui parecer jurídico. Para decisões de investimento ou jurídicas, consulte um advogado especializado.
      </p>
      <p style="color:#475569;font-size:10px;margin-bottom:8px;">
        A classificação do crédito (alimentar/comum, RPV/precatório) é inferida automaticamente com base nos dados disponíveis e pode requerer confirmação junto ao tribunal de origem.
      </p>
      ${isFree ? '<p style="color:#f87171;font-size:11px;font-weight:600;margin:0;">Esta é uma versão de avaliação gratuita. Para relatórios com cadeia de custódia SHA-256 e rastreabilidade jurídica completa, assine um plano em loa.auradue.com</p>' : ""}
    </div>

    <!-- Rodapé -->
    <div style="margin-top:32px;padding-top:16px;border-top:2px solid rgba(34,211,238,0.15);display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#06b6d4,#7c3aed);display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 2L4 6v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6l-8-4z" stroke="white" stroke-width="1.5"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <span style="color:#64748b;font-size:11px;">AuraLOA — AuraTECH</span>
      </div>
      <div style="display:flex;gap:12px;">
        ${!isFree ? '<span class="badge" style="background:rgba(16,185,129,0.08);color:#34d399;border:1px solid rgba(16,185,129,0.15);font-size:9px;">SHA-256 ✓</span>' : ''}
        <span class="badge" style="background:rgba(34,211,238,0.08);color:#22d3ee;border:1px solid rgba(34,211,238,0.15);font-size:9px;">Lei 13.964/2019</span>
      </div>
      <span style="color:#475569;font-size:10px;">© 2026 AuraTECH</span>
    </div>

  </div>
</body>
</html>`;
}

// ── Endpoint: gerar relatório HTML ──────────────────────────────────────────

router.get("/api/validador/relatorio/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  // Determinar plano do usuário
  let plano = "anonimo";
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const tokenData = validateToken(authHeader.slice(7));
    if (tokenData.valid && tokenData.email) {
      const planInfo = await getUserPlan(tokenData.email);
      plano = planInfo.plan;
    }
  }

  try {
    const rows = await query<any>(
      "SELECT * FROM pesquisas_validador WHERE id = $1 LIMIT 1",
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "Pesquisa não encontrada" });
    }

    const html = gerarRelatorioHTML(rows[0], plano);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch {
    return res.status(500).json({ error: "Erro ao gerar relatório" });
  }
});

// ── Endpoint: download PDF ──────────────────────────────────────────────────

router.get("/api/validador/relatorio/:id/pdf", async (req: Request, res: Response) => {
  const { id } = req.params;

  let plano = "anonimo";
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const tokenData = validateToken(authHeader.slice(7));
    if (tokenData.valid && tokenData.email) {
      const planInfo = await getUserPlan(tokenData.email);
      plano = planInfo.plan;
    }
  }

  try {
    const rows = await query<any>(
      "SELECT * FROM pesquisas_validador WHERE id = $1 LIMIT 1",
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "Pesquisa não encontrada" });
    }

    const html = gerarRelatorioHTML(rows[0], plano);

    // Renderizar HTML → PDF via Playwright
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
    });
    await browser.close();

    const cnj = rows[0].numero_processo || "pesquisa";
    const filename = `AuraLOA_Relatorio_${cnj.replace(/[^a-zA-Z0-9.-]/g, "_")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("[PDF] Erro ao gerar PDF:", err);
    return res.status(500).json({ error: "Erro ao gerar PDF" });
  }
});

// ── Endpoint: Due Diligence ao vivo (legado — busca simples) ─────────────────
// Pipeline completo está em dd_pipeline.ts → POST /api/duediligence/pipeline

router.post("/api/duediligence/iniciar", async (req: Request, res: Response) => {
  const { numero_precatorio, tribunal, valor, ano, uo_devedora, assunto } = req.body;

  if (!numero_precatorio || !tribunal) {
    return res.status(400).json({ error: "numero_precatorio e tribunal são obrigatórios" });
  }

  try {
    const tribunalAlias = tribunal.toLowerCase()
      .replace(/superior tribunal de justiça/i, "stj")
      .replace(/supremo tribunal federal/i, "stf")
      .replace(/trf - (\d)a?\. região/i, "trf$1")
      .replace(/trt - (\d{2})a?\. região.*/i, "trt$1")
      .replace(/\s+/g, "");

    const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
    const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY;

    let datajudResult: any = null;
    let datajudStatus = "nao_consultado";

    if (DATAJUD_API_KEY) {
      try {
        const endpoint = `${DATAJUD_BASE}/api_publica_${tribunalAlias}/_search`;
        const esQuery = {
          query: { bool: { must: [{ terms: { "classe.codigo": [1265, 1266] } }] } },
          size: 5,
          sort: [{ dataAjuizamento: "desc" }],
          track_total_hits: true,
        };

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `APIKey ${DATAJUD_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(esQuery),
          signal: AbortSignal.timeout(15000),
        });

        if (resp.ok) {
          const data = await resp.json();
          const total = data.hits?.total?.value || 0;
          const hits = data.hits?.hits || [];

          datajudResult = {
            total_encontrados: total,
            amostra: hits.slice(0, 3).map((h: any) => ({
              cnj: h._source.numeroProcesso,
              classe: h._source.classe?.nome,
              orgao: h._source.orgaoJulgador?.nome,
              grau: h._source.grau,
              ajuizamento: h._source.dataAjuizamento,
              valor_causa: h._source.valorCausa,
              movimentos: (h._source.movimentos || []).length,
              ultima_mov: h._source.movimentos?.slice(-1)[0]?.nome || null,
            })),
          };
          datajudStatus = total > 0 ? "encontrado" : "nao_encontrado";
        } else {
          datajudStatus = "erro_http_" + resp.status;
        }
      } catch (err: any) {
        datajudStatus = "erro_timeout";
      }
    }

    const resultado = {
      precatorio: {
        numero: numero_precatorio,
        tribunal,
        tribunal_alias: tribunalAlias,
        valor: valor || null,
        ano: ano || null,
        uo_devedora: uo_devedora || null,
        assunto: assunto || null,
      },
      datajud: {
        status: datajudStatus,
        resultado: datajudResult,
      },
      cnj: datajudResult?.amostra?.[0]?.cnj || "pendente_consulta_tribunal",
      fases_concluidas: ["consulta_datajud"],
      fases_pendentes: ["raspagem_web", "score_heuristico", "consulta_tribunal_direto", "parecer", "cadeia_custodia"],
      timestamp: new Date().toISOString(),
      sha256: require("crypto").createHash("sha256").update(JSON.stringify({ numero_precatorio, tribunal, timestamp: Date.now() })).digest("hex"),
    };

    return res.json(resultado);
  } catch {
    return res.status(500).json({ error: "Erro ao iniciar due diligence" });
  }
});

export default router;
