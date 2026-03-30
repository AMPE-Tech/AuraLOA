import { Express, Request, Response } from "express";
import { stripe, criarCheckoutSession, extrairPlanoDoPriceId } from "../services/stripe";
import { query } from "../db";
import { requireAuth } from "./auth";

export function registerStripeRoutes(app: Express) {

  // POST /api/stripe/create-checkout
  // Cria sessão de pagamento no Stripe e retorna a URL
  // userId no Stripe metadata = email (chave primária de aura_users)
  app.post("/api/stripe/create-checkout", requireAuth, async (req: Request, res: Response) => {
    try {
      const { priceId } = req.body;
      if (!priceId) {
        return res.status(400).json({ error: "priceId obrigatório" });
      }

      const authUser = (req as any).authUser;
      const userEmail: string = authUser?.email;
      if (!userEmail) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const rows = await query<{ email: string }>(
        "SELECT email FROM aura_users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [userEmail],
      );
      if (!rows[0]) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const baseUrl = process.env.BASE_URL || "http://localhost:5000";

      const checkoutUrl = await criarCheckoutSession({
        priceId,
        userId: userEmail,   // email é o identificador em aura_users
        userEmail,
        successUrl: `${baseUrl}/dashboard?upgrade=success`,
        cancelUrl: `${baseUrl}/precos?upgrade=cancelled`,
      });

      return res.json({ url: checkoutUrl });
    } catch (err: any) {
      console.error("Stripe checkout error:", err.message);
      return res.status(500).json({ error: "Erro ao criar sessão de pagamento" });
    }
  });

  // GET /api/stripe/subscription
  // Retorna o status atual do plano do usuário logado
  app.get("/api/stripe/subscription", requireAuth, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).authUser;
      const userEmail: string = authUser?.email;
      if (!userEmail) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const rows = await query<{
        plan: string;
        subscription_status: string;
        plan_expires_at: string | null;
      }>(
        "SELECT plan, subscription_status, plan_expires_at FROM aura_users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [userEmail],
      );

      if (!rows[0]) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      return res.json({
        plan: rows[0].plan || "free",
        subscription_status: rows[0].subscription_status || "free",
        plan_expires_at: rows[0].plan_expires_at || null,
      });
    } catch (err: any) {
      console.error("Subscription status error:", err.message);
      return res.status(500).json({ error: "Erro ao buscar status da assinatura" });
    }
  });

  // POST /api/stripe/webhook
  // Recebe eventos do Stripe e atualiza o banco de dados
  // userId no metadata = email do aura_users
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: any;

    if (!webhookSecret) {
      console.error("[Stripe] STRIPE_WEBHOOK_SECRET não definido — webhook rejeitado por segurança.");
      return res.status(500).json({ error: "Webhook não configurado no servidor." });
    }
    if (!sig) {
      console.error("[Stripe] Requisição sem stripe-signature — rejeitada.");
      return res.status(400).json({ error: "Assinatura stripe-signature ausente." });
    }
    try {
      event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Stripe] Webhook signature inválida:", err.message);
      return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    try {
      switch (event.type) {

        case "checkout.session.completed": {
          const session = event.data.object;
          const userEmail = session.metadata?.userId;  // userId = email
          if (!userEmail) break;

          const subscriptionId = session.subscription;
          const customerId = session.customer;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const priceId = subscription.items?.data[0]?.price?.id;
          const planId = extrairPlanoDoPriceId(priceId);
          const periodEnd = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null;

          await query(
            `UPDATE aura_users SET
               stripe_customer_id = $1,
               stripe_subscription_id = $2,
               plan = $3,
               subscription_status = 'active',
               plan_expires_at = $4
             WHERE LOWER(email) = LOWER($5)`,
            [customerId, subscriptionId, planId, periodEnd, userEmail],
          );

          console.log(`[Stripe] Assinatura ativada: email=${userEmail} plan=${planId}`);
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription;
          if (!subscriptionId) break;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const userEmail = subscription.metadata?.userId;  // userId = email
          if (!userEmail) break;

          const priceId = subscription.items?.data[0]?.price?.id;
          const planId = extrairPlanoDoPriceId(priceId);
          const periodEnd = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null;

          await query(
            `UPDATE aura_users SET
               plan = $1,
               subscription_status = 'active',
               plan_expires_at = $2
             WHERE LOWER(email) = LOWER($3)`,
            [planId, periodEnd, userEmail],
          );

          console.log(`[Stripe] Pagamento renovado: email=${userEmail} plan=${planId}`);
          break;
        }

        case "customer.subscription.deleted":
        case "invoice.payment_failed": {
          const obj = event.data.object;
          const subscriptionId = obj.subscription || obj.id;
          if (!subscriptionId) break;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const userEmail = subscription.metadata?.userId;  // userId = email
          if (!userEmail) break;

          await query(
            `UPDATE aura_users SET
               plan = 'free',
               subscription_status = 'canceled',
               plan_expires_at = NULL
             WHERE LOWER(email) = LOWER($1)`,
            [userEmail],
          );

          console.log(`[Stripe] Assinatura cancelada: email=${userEmail}`);
          break;
        }

        default:
          console.log(`[Stripe] Evento ignorado: ${event.type}`);
      }

      return res.json({ received: true });
    } catch (err: any) {
      console.error("Webhook processing error:", err.message);
      return res.status(500).json({ error: "Erro ao processar webhook" });
    }
  });
}
