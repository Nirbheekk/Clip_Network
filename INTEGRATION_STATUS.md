# Clip Network — External Integration Status

| Integration | Mode When Unconfigured | Live Configuration Env Vars | Status |
|---|---|---|---|
| **Core Clip Engine** (`@clip-network/clip-engine`) | Live deterministic local execution | FFmpeg (optional for raw MP4) | Live & Verified |
| **Database** (Prisma) | SQLite (`apps/api/data/clip-network.db`) | `DATABASE_URL` (PostgreSQL-ready) | Live & Verified |
| **Billing & Webhooks** | `SANDBOX_WEBHOOK` (real HMAC-SHA256 verification) | `STRIPE_SECRET_KEY`, `BILLING_WEBHOOK_SECRET` | Verified in Sandbox; Stripe-ready |
| **Social Publishing** | `SANDBOX_SIMULATED` (AES-256-GCM token vault + idempotency) | `POSTIZ_API_KEY`, `ENCRYPTION_MASTER_KEY` | Verified in Sandbox; Postiz-ready |
| **Transactional Email** | Dev token helper (`NODE_ENV !== production`) | `RESEND_API_KEY` / SMTP | Dev-verified; Provider-ready |
