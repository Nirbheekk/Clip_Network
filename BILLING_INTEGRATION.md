# Clip Network — Stripe Billing Integration Guide

**Status**: `SANDBOX VERIFIED` (Official `stripe` SDK implemented; awaits live Stripe keys for `LIVE VERIFIED`)

## Architecture
- **Source of Truth**: `SAAS_PLANS` in `packages/shared/src/index.ts` (`FREE`, `STARTER` \$29, `PRO` \$99, `ENTERPRISE` \$299).
- **Server-Side Price Mapping** (`apps/api/src/integrations/stripe.ts`):
  - `STARTER` -> `process.env.STRIPE_PRICE_STARTER`
  - `PRO` -> `process.env.STRIPE_PRICE_PRO`
  - `ENTERPRISE` -> `process.env.STRIPE_PRICE_ENTERPRISE`
  - Frontend never stores or sends Stripe Price IDs.
- **Endpoints**:
  - `POST /api/v1/billing/checkout` — Creates/reuses Stripe Customer (`workspace.stripeCustomerId`) and returns a real Stripe Checkout Session URL in `STRIPE_LIVE` mode, or a sandbox HMAC payload in `SANDBOX_WEBHOOK` mode.
  - `POST /api/v1/billing/portal` — Creates a real Stripe Customer Billing Portal session (`STRIPE_LIVE`) for invoice downloads, payment method updates, and self-serve cancellation.
  - `POST /api/v1/billing/webhook/stripe` — Verifies `stripe-signature` via `stripe.webhooks.constructEvent()` using `STRIPE_WEBHOOK_SECRET`, handles `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, and `customer.subscription.deleted` idempotently via `SubscriptionInvoice.externalEventId`.
  - `POST /api/v1/billing/webhook` — Preserves HMAC-SHA256 sandbox webhook verification for CI & local development.
  - `POST /api/v1/billing/cancel` — Cancels active Stripe subscription (if `stripeSubscriptionId` present) and downgrades workspace cleanly to `FREE`.

## Stripe Dashboard Setup Checklist (For Live Cutover)
1. Create 3 recurring monthly products in Stripe Dashboard (`Starter $29`, `Pro $99`, `Enterprise $299`) and copy their `price_...` IDs into `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`.
2. Enable Stripe Customer Portal in Stripe Dashboard -> Settings -> Billing -> Customer portal.
3. Add Webhook endpoint `https://<your-api-domain>/api/v1/billing/webhook/stripe` listening to:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy signing secret `whsec_...` into `STRIPE_WEBHOOK_SECRET` and live secret key `sk_live_...` into `STRIPE_SECRET_KEY`.
