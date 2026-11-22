# Clip Network — Stripe Live Readiness Report

**Timestamp**: `2026-11-22T17:53:00+05:45`  
**Status**: `Sandbox verified` (Code complete for live cutover; `Live verified` is `Blocked` solely on operator Stripe keys).

## Implemented Production Controls
- Official `stripe` SDK (`apps/api/src/integrations/stripe.ts`).
- Exact raw-body HTTP byte preservation (`request.rawBody`) for `stripe.webhooks.constructEvent()` on `POST /api/v1/billing/webhook/stripe`.
- Complete webhook lifecycle:
  - `checkout.session.completed` -> activates plan, updates `monthlyClipLimit`, stores `stripeCustomerId`/`stripeSubscriptionId`, writes idempotent `SubscriptionInvoice`.
  - `invoice.paid` -> resets `clipsUsedThisPeriod = 0`, advances `periodResetAt` (UTC), records paid invoice.
  - `invoice.payment_failed` -> sets `subscriptionStatus = PAST_DUE`, records failed invoice, emails workspace OWNER.
  - `customer.subscription.updated` -> maps Price ID back to `SAAS_PLANS` tier cleanly.
  - `customer.subscription.deleted` -> reverts workspace to `FREE` (`10` clips/mo) and emails OWNER.
- UTC calendar-month billing period rollover (`apps/api/src/billing-period.ts`) tested with zero timezone drift.
- Frontend never activates subscriptions from success redirect URLs.

## Exact Operator Action Required for Live Activation
1. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE` in `.env.production` (start with `sk_test_...` in staging first).
2. Configure Stripe webhook endpoint `https://<api-domain>/api/v1/billing/webhook/stripe`.
3. Execute one Stripe Test Mode checkout + renewal + cancel cycle before switching to `sk_live_...`.
