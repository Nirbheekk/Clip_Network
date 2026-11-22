# Clip Network — Production Integration Status

Every integration is classified honestly using strict launch statuses (`NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `SANDBOX VERIFIED`, `LIVE VERIFIED`, `PRODUCTION READY`).

| Integration | Implementation File | Sandbox Mode | Production Provider | Current Status | Blocker for `LIVE VERIFIED` |
|---|---|---|---|---|---|
| **Stripe Billing** | `apps/api/src/integrations/stripe.ts` | `SANDBOX_WEBHOOK` (HMAC-SHA256) | Official `stripe` SDK (Checkout, Billing Portal, `constructEvent`) | `SANDBOX VERIFIED` | Operator must supply `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_*` env vars |
| **Social Publishing** | `apps/api/src/integrations/publishing.ts` | `SANDBOX_SIMULATED` | Postiz REST API + platform duration/format validator + AES-256-GCM token vault | `SANDBOX VERIFIED` | Operator must supply `POSTIZ_API_KEY` + live connected OAuth accounts |
| **Transactional Email** | `apps/api/src/integrations/email.ts` | `SANDBOX_LOG` (tokens redacted from logs) | Resend REST API (`https://api.resend.com/emails`) | `SANDBOX VERIFIED` | Operator must supply `RESEND_API_KEY` & verified `EMAIL_FROM` domain |
| **Object Media Storage** | `apps/api/src/integrations/storage.ts` | `LOCAL_SANDBOX` | S3-Compatible AWS SigV4 Presigned URLs (AWS S3 / Cloudflare R2 / MinIO) | `SANDBOX VERIFIED` | Operator must supply `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| **Channel Upload Monitor** | `apps/api/src/integrations/scheduler.ts` | `CHANNEL_FEED_SCAN` + background scheduler | YouTube public Atom RSS feed + background interval worker | `SANDBOX VERIFIED` | Optional Twitch/Kick API tokens for live VOD polling |
| **Database** | `apps/api/prisma/schema.prisma` | SQLite local dev | PostgreSQL 16 (`docker-compose.prod.yml`) | `SANDBOX VERIFIED` | Switch Prisma datasource provider to `postgresql` & run `prisma migrate deploy` in staging |
