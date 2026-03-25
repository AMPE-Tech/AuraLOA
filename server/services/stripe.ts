import Stripe from "stripe";
import { getPlanByStripePrice } from "../../shared/plans";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY não definida no .env");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});

export async function criarCheckoutSession(params: {
  priceId: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: params.userEmail,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { userId: params.userId },
    subscription_data: {
      metadata: { userId: params.userId },
    },
  });

  if (!session.url) throw new Error("Stripe não retornou URL de checkout");
  return session.url;
}

export async function cancelarAssinatura(subscriptionId: string): Promise<void> {
  await stripe.subscriptions.cancel(subscriptionId);
}

export function extrairPlanoDoPriceId(priceId: string): string {
  const plan = getPlanByStripePrice(priceId);
  return plan?.id ?? "free";
}
