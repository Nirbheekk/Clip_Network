import Stripe from 'stripe';
import type { PlanTier } from '@clip-network/shared';

let cachedStripe: Stripe | null = null;

export function isStripeLiveConfigured(): boolean {
  const key = process.env['STRIPE_SECRET_KEY']?.trim();
  return Boolean(key && key.startsWith('sk_'));
}

export function getStripeClient(): Stripe | null {
  const key = process.env['STRIPE_SECRET_KEY']?.trim();
  if (!key || !key.startsWith('sk_')) return null;
  if (!cachedStripe) {
    cachedStripe = new Stripe(key);
  }
  return cachedStripe;
}

export function getStripePriceIdForPlan(planTier: PlanTier): string | null {
  if (planTier === 'STARTER') return process.env['STRIPE_PRICE_STARTER']?.trim() || null;
  if (planTier === 'PRO') return process.env['STRIPE_PRICE_PRO']?.trim() || null;
  if (planTier === 'ENTERPRISE') return process.env['STRIPE_PRICE_ENTERPRISE']?.trim() || null;
  return null;
}

export function resolvePlanTierFromPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === process.env['STRIPE_PRICE_STARTER']?.trim()) return 'STARTER';
  if (priceId === process.env['STRIPE_PRICE_PRO']?.trim()) return 'PRO';
  if (priceId === process.env['STRIPE_PRICE_ENTERPRISE']?.trim()) return 'ENTERPRISE';
  return null;
}

export async function createStripeCheckoutSession(params: {
  workspaceId: string;
  workspaceName: string;
  customerEmail: string;
  existingCustomerId?: string | null;
  planTier: PlanTier;
  publicAppUrl: string;
}): Promise<{ checkoutUrl: string; sessionId: string; customerId: string } | null> {
  const stripe = getStripeClient();
  const priceId = getStripePriceIdForPlan(params.planTier);
  if (!stripe || !priceId) return null;

  let customerId = params.existingCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: params.customerEmail,
      name: params.workspaceName,
      metadata: { workspaceId: params.workspaceId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${params.publicAppUrl}/settings/billing?checkout=success`,
    cancel_url: `${params.publicAppUrl}/settings/billing?checkout=cancelled`,
    metadata: {
      workspaceId: params.workspaceId,
      planTier: params.planTier,
    },
    subscription_data: {
      metadata: {
        workspaceId: params.workspaceId,
        planTier: params.planTier,
      },
    },
  });

  if (!session.url) return null;
  return { checkoutUrl: session.url, sessionId: session.id, customerId };
}

export async function createStripeBillingPortalSession(params: {
  customerId: string;
  publicAppUrl: string;
}): Promise<{ portalUrl: string } | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: `${params.publicAppUrl}/settings/billing`,
  });
  return { portalUrl: session.url };
}

export async function cancelStripeSubscriptionIfActive(subscriptionId: string | null | undefined) {
  const stripe = getStripeClient();
  if (!stripe || !subscriptionId) return;
  await stripe.subscriptions.cancel(subscriptionId);
}

export function constructVerifiedStripeEvent(
  rawBody: string | Buffer,
  stripeSignature: string | undefined,
): Stripe.Event | null {
  const stripe = getStripeClient();
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET']?.trim();
  if (!stripe || !webhookSecret || !stripeSignature) return null;
  return stripe.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);
}
