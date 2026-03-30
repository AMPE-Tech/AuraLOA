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
      r.valor_rs ? parseFloat(String(r.valor_rs).replace(/[^0-9,]/g, "").replace(",", ".")) : null,
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

export default router;
