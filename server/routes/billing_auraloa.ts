/**
 * Billing AuraLOA Marketplace
 *
 * Modelo de cobrança:
 *   - Assinatura mensal: USD 100,00 com 2 precatórios/mês inclusos
 *   - DD adicional: USD 60,00 por consulta excedente
 *   - Ofício Requisitório: USD 20,00 por download
 *
 * Integração Stripe: checkout + cobrança avulsa + webhook
 * Controle de cotas por cliente em billing_cotas + billing_consumo
 */

import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import jwt from "jsonwebtoken";
import { query } from "../db";

const router = Router();

const SESSION_SECRET = process.env.SESSION_SECRET!;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

if (!STRIPE_SECRET_KEY) {
  throw new Error("[Billing] STRIPE_SECRET_KEY não definido no .env");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });

// ── Produtos AuraLOA Marketplace (price IDs criados sob demanda) ──
// Cache em memória — criados no primeiro uso
let PRICE_SUBSCRIPTION_USD100: string | null = null;
let PRICE_DD_ADICIONAL_USD60: string | null = null;
let PRICE_OFICIO_USD20: string | null = null;

async function garantirProdutosStripe(): Promise<{ subscription: string; ddAdicional: string; oficio: string }> {
  if (PRICE_SUBSCRIPTION_USD100 && PRICE_DD_ADICIONAL_USD60 && PRICE_OFICIO_USD20) {
    return { subscription: PRICE_SUBSCRIPTION_USD100, ddAdicional: PRICE_DD_ADICIONAL_USD60, oficio: PRICE_OFICIO_USD20 };
  }

  // Buscar produtos existentes pelos metadata
  const produtos = await stripe.products.list({ limit: 100, active: true });
  const buscarPrice = async (metaKey: string) => {
    const prod = produtos.data.find((p) => p.metadata?.auraloa === metaKey);
    if (!prod) return null;
    const prices = await stripe.prices.list({ product: prod.id, active: true, limit: 1 });
    return prices.data[0]?.id || null;
  };

  PRICE_SUBSCRIPTION_USD100 = await buscarPrice("subscription_mensal");
  PRICE_DD_ADICIONAL_USD60 = await buscarPrice("dd_adicional");
  PRICE_OFICIO_USD20 = await buscarPrice("oficio_requisitorio");

  // Criar se não existe — todos os produtos padronizados com "AuraTECH"
  if (!PRICE_SUBSCRIPTION_USD100) {
    const prod = await stripe.products.create({
      name: "AuraTECH · AuraLOA · Assinatura Mensal",
      description: "Acesso à plataforma AuraLOA + 2 relatórios Due Diligence/mês inclusos",
      statement_descriptor: "AURATECH AURALOA",
      metadata: { auraloa: "subscription_mensal", plataforma: "AuraTECH" },
    });
    const price = await stripe.prices.create({ product: prod.id, unit_amount: 10000, currency: "usd", recurring: { interval: "month" } });
    PRICE_SUBSCRIPTION_USD100 = price.id;
    console.log(`[Billing] Criado produto subscription: ${price.id}`);
  }
  if (!PRICE_DD_ADICIONAL_USD60) {
    const prod = await stripe.products.create({
      name: "AuraTECH · AuraLOA · Due Diligence Adicional",
      description: "Relatório Due Diligence extra (além dos 2 inclusos no mês)",
      statement_descriptor: "AURATECH DD",
      metadata: { auraloa: "dd_adicional", plataforma: "AuraTECH" },
    });
    const price = await stripe.prices.create({ product: prod.id, unit_amount: 6000, currency: "usd" });
    PRICE_DD_ADICIONAL_USD60 = price.id;
    console.log(`[Billing] Criado produto DD adicional: ${price.id}`);
  }
  if (!PRICE_OFICIO_USD20) {
    const prod = await stripe.products.create({
      name: "AuraTECH · AuraLOA · Ofício Requisitório",
      description: "Download do ofício requisitório oficial do tribunal",
      statement_descriptor: "AURATECH OFICIO",
      metadata: { auraloa: "oficio_requisitorio", plataforma: "AuraTECH" },
    });
    const price = await stripe.prices.create({ product: prod.id, unit_amount: 2000, currency: "usd" });
    PRICE_OFICIO_USD20 = price.id;
    console.log(`[Billing] Criado produto Ofício: ${price.id}`);
  }

  return { subscription: PRICE_SUBSCRIPTION_USD100!, ddAdicional: PRICE_DD_ADICIONAL_USD60!, oficio: PRICE_OFICIO_USD20! };
}

// ── Helpers ─────────────────────────────────────────────────────────
function verificarTokenCliente(req: Request): { valid: boolean; cliente_slug?: string } {
  const rawToken = req.query["t"] || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const token = rawToken ? String(rawToken) : undefined;
  if (!token) return { valid: false };
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as any;
    if ((decoded.kycAccess === true || decoded.clienteAccess === true) && decoded.cliente_slug) {
      return { valid: true, cliente_slug: decoded.cliente_slug };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

function verificarAdmin(req: Request): boolean {
  const rawToken = req.query["t"] || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const token = rawToken ? String(rawToken) : undefined;
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as any;
    return decoded.role === "admin";
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ENDPOINTS — CLIENTE
// ═══════════════════════════════════════════════════════════════════

// GET /api/billing/planos — retorna planos e preços
router.get("/api/billing/planos", async (_req: Request, res: Response) => {
  try {
    await garantirProdutosStripe();
    return res.json({
      ok: true,
      planos: {
        assinatura_mensal: {
          nome: "AuraLOA Marketplace",
          valor_usd: 100,
          interval: "month",
          inclui: "2 precatórios/mês (pesquisa + download do relatório DD)",
          features: [
            "Acesso completo à plataforma",
            "2 relatórios Due Diligence por mês",
            "Dashboard com Visão Geral, Análise e Pendentes",
            "Suporte por email",
            "Atualizações automáticas",
          ],
        },
        addons: {
          dd_adicional: { nome: "Due Diligence Adicional", valor_usd: 60, descricao: "Relatório DD além dos 2 inclusos" },
          oficio_requisitorio: { nome: "Ofício Requisitório", valor_usd: 20, descricao: "Download do documento oficial do tribunal" },
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao listar planos", detalhe: err.message });
  }
});

// POST /api/billing/checkout — cria Stripe Checkout para assinatura
router.post("/api/billing/checkout", async (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente_slug) {
    return res.status(401).json({ error: "Token inválido" });
  }

  try {
    // Acesso imediato: só exige NDA assinado (KYC completo é pós-transação)
    const cliente = await query(`SELECT status, email, nome_completo, status_nda FROM kyc_clientes WHERE cliente_slug = $1`, [check.cliente_slug]);
    if (cliente.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });
    if (cliente[0].status_nda !== "assinado") return res.status(403).json({ error: "NDA não assinado" });

    const precos = await garantirProdutosStripe();

    // Buscar ou criar customer Stripe
    let customerId: string | null = null;
    const cotaExistente = await query(`SELECT stripe_customer_id FROM billing_cotas WHERE cliente_slug = $1 AND stripe_customer_id IS NOT NULL ORDER BY id DESC LIMIT 1`, [check.cliente_slug]);
    if (cotaExistente[0]?.stripe_customer_id) {
      customerId = cotaExistente[0].stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: cliente[0].email,
        name: cliente[0].nome_completo,
        description: `AuraTECH · Cliente AuraLOA`,
        metadata: { cliente_slug: check.cliente_slug, plataforma: "AuraTECH", produto: "AuraLOA" },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId!,
      line_items: [{ price: precos.subscription, quantity: 1 }],
      success_url: `${BASE_URL}/api/billing/checkout-success?session_id={CHECKOUT_SESSION_ID}&slug=${check.cliente_slug}`,
      cancel_url: `${BASE_URL}/onboarding/assinatura.html?t=${req.query.t}&checkout=cancelled`,
      metadata: { cliente_slug: check.cliente_slug, tipo: "assinatura_mensal_auraloa" },
      subscription_data: {
        metadata: { cliente_slug: check.cliente_slug, plataforma: "auraloa" },
        description: "AuraTECH · Assinatura Mensal AuraLOA",
      },
    });

    return res.json({ ok: true, url: session.url, session_id: session.id });
  } catch (err: any) {
    console.error("[Billing] Erro checkout:", err);
    return res.status(500).json({ error: "Erro ao criar checkout", detalhe: err.message });
  }
});

// POST /api/billing/cobrar-extra — cobra DD adicional ou Ofício
router.post("/api/billing/cobrar-extra", async (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente_slug) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const { tipo, numero_precatorio, consentimento } = req.body;

  if (!["dd_adicional", "oficio_requisitorio"].includes(tipo)) {
    return res.status(400).json({ error: "tipo deve ser 'dd_adicional' ou 'oficio_requisitorio'" });
  }
  if (!numero_precatorio) return res.status(400).json({ error: "numero_precatorio obrigatório" });
  if (!consentimento) return res.status(400).json({ error: "Consentimento explícito obrigatório" });

  try {
    const cotaResult = await query(
      `SELECT stripe_customer_id, subscription_status FROM billing_cotas
       WHERE cliente_slug = $1 AND subscription_status = 'active'
       ORDER BY periodo_inicio DESC LIMIT 1`,
      [check.cliente_slug]
    );
    if (cotaResult.length === 0) {
      return res.status(403).json({ error: "Assinatura ativa necessária para cobranças avulsas" });
    }
    const customerId = cotaResult[0].stripe_customer_id;

    const precos = await garantirProdutosStripe();
    const priceId = tipo === "dd_adicional" ? precos.ddAdicional : precos.oficio;
    const valorUsd = tipo === "dd_adicional" ? 60 : 20;

    // Criar sessão Checkout avulsa (one-time)
    const statementDesc = tipo === "dd_adicional" ? "AURATECH DD" : "AURATECH OFICIO";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer: customerId!,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${BASE_URL}/portal-cliente?t=${req.query.t}&extra=success`,
      cancel_url: `${BASE_URL}/portal-cliente?t=${req.query.t}&extra=cancelled`,
      metadata: {
        cliente_slug: check.cliente_slug,
        tipo,
        numero_precatorio,
        valor_usd: String(valorUsd),
      },
      payment_intent_data: {
        statement_descriptor_suffix: statementDesc,
        description: `AuraTECH · ${tipo === "dd_adicional" ? "Due Diligence Adicional" : "Ofício Requisitório"} · Precatório ${numero_precatorio}`,
      },
    });

    // Registrar intenção de consumo (será confirmada no webhook)
    await query(
      `INSERT INTO billing_consumo (cliente_slug, numero_precatorio, tipo, valor_usd, stripe_payment_status, consentimento_registrado, ip)
       VALUES ($1, $2, $3, $4, 'pending', TRUE, $5)`,
      [check.cliente_slug, numero_precatorio, tipo, valorUsd, req.ip]
    );

    return res.json({ ok: true, url: session.url, valor_usd: valorUsd });
  } catch (err: any) {
    console.error("[Billing] Erro cobrança extra:", err);
    return res.status(500).json({ error: "Erro ao processar cobrança", detalhe: err.message });
  }
});

// GET /api/billing/checkout-success — pós-checkout Stripe, gera token cliente e redireciona para portal
// Acesso imediato: cliente já tem acesso após pagamento confirmado (webhook ativa cota).
// Aqui geramos o token JWT do portal cliente e redirecionamos.
router.get("/api/billing/checkout-success", async (req: Request, res: Response) => {
  const { session_id, slug } = req.query;
  if (!session_id || !slug) {
    return res.status(400).send("session_id e slug obrigatórios");
  }

  try {
    // Confirmar sessão no Stripe (segurança)
    const session = await stripe.checkout.sessions.retrieve(String(session_id));
    const clienteSlug = String(slug);

    if (session.metadata?.cliente_slug !== clienteSlug) {
      return res.status(403).send("Sessão não pertence a este cliente");
    }

    // Aguardar webhook processar (tenta 3x com delay)
    let cotaAtiva = false;
    for (let i = 0; i < 3; i++) {
      const cotas = await query(
        `SELECT id FROM billing_cotas WHERE cliente_slug = $1 AND subscription_status = 'active' LIMIT 1`,
        [clienteSlug]
      );
      if (cotas.length > 0) { cotaAtiva = true; break; }
      await new Promise(r => setTimeout(r, 1000));
    }

    // Gerar token cliente (portal)
    const tokenCliente = jwt.sign(
      { clienteAccess: true, cliente_slug: clienteSlug, cliente: clienteSlug, kycAccess: true },
      SESSION_SECRET,
      { expiresIn: "8h" }
    );

    // Criar pasta do cliente em relatorios-cliente (para portal cliente funcionar)
    const path = await import("path");
    const fs = await import("fs");
    const pastaCliente = path.resolve("dist/public/relatorios-cliente", clienteSlug);
    if (!fs.existsSync(pastaCliente)) {
      fs.mkdirSync(pastaCliente, { recursive: true });
    }

    // Redirecionar para dashboard cliente (visão restrita) com token + flag de boas-vindas
    return res.redirect(`/dashboard-cliente?t=${tokenCliente}&welcome=true${cotaAtiva ? '' : '&activating=true'}`);
  } catch (err: any) {
    console.error("[Billing] Erro checkout-success:", err);
    return res.status(500).send(`Erro ao processar sucesso do checkout: ${err.message}`);
  }
});

// POST /api/billing/consumir — consome 1 cota (DD incluso) — só se tiver cota
router.post("/api/billing/consumir", async (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente_slug) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const { numero_precatorio, relatorio_gerado } = req.body;
  if (!numero_precatorio) return res.status(400).json({ error: "numero_precatorio obrigatório" });

  try {
    const cotaResult = await query(
      `SELECT id, cota_inclusa, cota_usada FROM billing_cotas
       WHERE cliente_slug = $1 AND subscription_status = 'active' AND periodo_fim >= CURRENT_DATE
       ORDER BY periodo_inicio DESC LIMIT 1`,
      [check.cliente_slug]
    );

    if (cotaResult.length === 0) {
      return res.status(403).json({ error: "Assinatura ativa necessária", requer_assinatura: true });
    }

    const cota = cotaResult[0];
    if (cota.cota_usada >= cota.cota_inclusa) {
      return res.status(402).json({
        error: "Cota mensal esgotada",
        requer_pagamento_extra: true,
        tipo_sugerido: "dd_adicional",
        valor_usd: 60,
      });
    }

    // Consumir 1 cota
    await query(`UPDATE billing_cotas SET cota_usada = cota_usada + 1, atualizado_em = NOW() WHERE id = $1`, [cota.id]);
    await query(
      `INSERT INTO billing_consumo (cliente_slug, numero_precatorio, tipo, valor_usd, stripe_payment_status, relatorio_gerado, ip)
       VALUES ($1, $2, 'dd_incluso', 0, 'included', $3, $4)`,
      [check.cliente_slug, numero_precatorio, relatorio_gerado || null, req.ip]
    );

    return res.json({
      ok: true,
      cota_restante: cota.cota_inclusa - cota.cota_usada - 1,
      mensagem: "DD liberado. 1 cota consumida.",
    });
  } catch (err: any) {
    console.error("[Billing] Erro consumir:", err);
    return res.status(500).json({ error: "Erro ao consumir cota" });
  }
});

// GET /api/billing/status — status atual do cliente (cota + assinatura)
router.get("/api/billing/status", async (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente_slug) {
    return res.status(401).json({ error: "Token inválido" });
  }

  try {
    const cotaResult = await query(
      `SELECT * FROM billing_cotas WHERE cliente_slug = $1 ORDER BY periodo_inicio DESC LIMIT 1`,
      [check.cliente_slug]
    );
    const consumoMes = await query(
      `SELECT COUNT(*)::int AS total, COALESCE(SUM(valor_usd), 0)::numeric AS total_usd
       FROM billing_consumo WHERE cliente_slug = $1 AND consumido_em >= date_trunc('month', CURRENT_DATE)`,
      [check.cliente_slug]
    );

    const cota = cotaResult[0] || null;
    return res.json({
      ok: true,
      assinatura: cota ? {
        status: cota.subscription_status,
        periodo_inicio: cota.periodo_inicio,
        periodo_fim: cota.periodo_fim,
        cota_inclusa: cota.cota_inclusa,
        cota_usada: cota.cota_usada,
        cota_restante: cota.cota_inclusa - cota.cota_usada,
        excedentes_cobrados: cota.excedentes_cobrados,
        oficios_baixados: cota.oficios_baixados,
        total_pago_mes_usd: cota.total_pago_mes_usd,
      } : null,
      consumo_mes: consumoMes[0],
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao consultar status" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// WEBHOOK STRIPE — processar eventos de pagamento
// ═══════════════════════════════════════════════════════════════════

router.post("/api/billing/webhook", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;
  if (!STRIPE_WEBHOOK_SECRET) return res.status(500).send("Webhook secret não configurado");

  let event: Stripe.Event;
  try {
    const rawBody = (req as any).rawBody || req.body;
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[Billing Webhook] Assinatura inválida:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const cliente_slug = session.metadata?.cliente_slug;
        const tipo = session.metadata?.tipo;

        if (!cliente_slug) break;

        if (tipo === "assinatura_mensal_auraloa" && session.subscription) {
          // Ativar assinatura — criar/atualizar cota
          const subscriptionId = String(session.subscription);
          const customerId = String(session.customer);
          const hoje = new Date();
          const proximoMes = new Date(hoje);
          proximoMes.setMonth(proximoMes.getMonth() + 1);

          await query(
            `INSERT INTO billing_cotas
             (cliente_slug, stripe_customer_id, stripe_subscription_id, subscription_status, periodo_inicio, periodo_fim, cota_inclusa, cota_usada, total_pago_mes_usd)
             VALUES ($1, $2, $3, 'active', $4, $5, 2, 0, 100)
             ON CONFLICT (cliente_slug, periodo_inicio) DO UPDATE
             SET subscription_status = 'active', stripe_subscription_id = $3, total_pago_mes_usd = 100, atualizado_em = NOW()`,
            [cliente_slug, customerId, subscriptionId, hoje.toISOString().slice(0, 10), proximoMes.toISOString().slice(0, 10)]
          );
          console.log(`[Billing] Assinatura ativada: ${cliente_slug}`);
        } else if (tipo === "dd_adicional" || tipo === "oficio_requisitorio") {
          // Confirmar cobrança extra
          const numero_precatorio = session.metadata?.numero_precatorio;
          const valor_usd = parseFloat(session.metadata?.valor_usd || "0");

          await query(
            `UPDATE billing_consumo
             SET stripe_payment_status = 'paid', stripe_charge_id = $1
             WHERE cliente_slug = $2 AND numero_precatorio = $3 AND tipo = $4 AND stripe_payment_status = 'pending'`,
            [String(session.payment_intent), cliente_slug, numero_precatorio, tipo]
          );

          // Atualizar contadores na cota ativa
          if (tipo === "dd_adicional") {
            await query(
              `UPDATE billing_cotas SET excedentes_cobrados = excedentes_cobrados + 1,
               excedentes_valor_usd = excedentes_valor_usd + $1, total_pago_mes_usd = total_pago_mes_usd + $1
               WHERE cliente_slug = $2 AND subscription_status = 'active'`,
              [valor_usd, cliente_slug]
            );
          } else {
            await query(
              `UPDATE billing_cotas SET oficios_baixados = oficios_baixados + 1,
               oficios_valor_usd = oficios_valor_usd + $1, total_pago_mes_usd = total_pago_mes_usd + $1
               WHERE cliente_slug = $2 AND subscription_status = 'active'`,
              [valor_usd, cliente_slug]
            );
          }
          console.log(`[Billing] Cobrança extra confirmada: ${cliente_slug} / ${tipo} / USD ${valor_usd}`);
        }
        break;
      }

      case "customer.subscription.deleted":
      case "customer.subscription.canceled": {
        const sub = event.data.object as Stripe.Subscription;
        const cliente_slug = sub.metadata?.cliente_slug;
        if (cliente_slug) {
          await query(
            `UPDATE billing_cotas SET subscription_status = 'canceled' WHERE cliente_slug = $1 AND stripe_subscription_id = $2`,
            [cliente_slug, sub.id]
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (subscriptionId) {
          await query(`UPDATE billing_cotas SET subscription_status = 'past_due' WHERE stripe_subscription_id = $1`, [subscriptionId]);
        }
        break;
      }
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error("[Billing Webhook] Erro processamento:", err);
    return res.status(500).send("Webhook processing error");
  }
});

// ═══════════════════════════════════════════════════════════════════
// ENDPOINTS ADMIN
// ═══════════════════════════════════════════════════════════════════

// GET /api/admin/billing/overview — visão geral financeira
router.get("/api/admin/billing/overview", async (req: Request, res: Response) => {
  if (!verificarAdmin(req)) return res.status(403).json({ error: "Acesso restrito ao administrador" });

  try {
    const assinantes = await query(
      `SELECT c.cliente_slug, c.nome_completo, c.email,
        b.subscription_status, b.cota_inclusa, b.cota_usada,
        b.excedentes_cobrados, b.oficios_baixados, b.total_pago_mes_usd,
        b.periodo_inicio, b.periodo_fim
       FROM kyc_clientes c
       LEFT JOIN billing_cotas b ON b.cliente_slug = c.cliente_slug AND b.subscription_status = 'active'
       WHERE c.status = 'aprovado'
       ORDER BY b.total_pago_mes_usd DESC NULLS LAST`
    );

    const totais = await query(
      `SELECT
        COUNT(DISTINCT cliente_slug) FILTER (WHERE subscription_status = 'active')::int AS ativos,
        COALESCE(SUM(total_pago_mes_usd) FILTER (WHERE subscription_status = 'active'), 0)::numeric AS receita_mes_usd,
        COALESCE(SUM(excedentes_cobrados), 0)::int AS total_excedentes,
        COALESCE(SUM(oficios_baixados), 0)::int AS total_oficios
       FROM billing_cotas
       WHERE periodo_fim >= CURRENT_DATE`
    );

    return res.json({ ok: true, assinantes, totais: totais[0] });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao consultar overview" });
  }
});

export default router;
