# Clip Network — Final Commercial Launch Checklist

**Timestamp**: `2026-11-22T17:53:14+05:45`

## Completed & Verified (Zero Code Blockers Remaining)
- [x] `pnpm run build` (`36/36` Next.js routes + `api` + `worker` + `shared` + `clip-engine`) — `Locally verified`
- [x] `pnpm run typecheck` (`0` TypeScript strict errors) — `Locally verified`
- [x] `pnpm run test` (`20/20` Vitest tests passing) — `Locally verified`
- [x] Browser E2E verified across Landing, Pricing, Register, Onboarding, Dashboard, Review Studio, Recharts Analytics, Billing, Team RBAC, Notifications, Publishing (`0` console errors, `0` HTTP 4xx/5xx) — `Sandbox verified`
- [x] Live PostgreSQL 16 schema push (`17` tables) + `pg_dump` backup (`85,750` bytes) + restore verified — `Live verified`
- [x] Live MinIO S3 presigned PUT upload + GET download + `403` rejection on unauth/tampered/expired URLs — `Live verified`
- [x] Production `docker-compose.prod.yml` (`postgres`, `redis`, `minio`, `api`, `worker`, `web`, `nginx`) schema validated (`exit 0`) — `Locally verified`
- [x] UTC monthly billing period rollover, Stripe raw-body webhook + `invoice.paid` / `invoice.payment_failed`, redacted JSON logging, sanitized 500 error handler — `Sandbox verified`

## Operator Live Cutover Steps Required Before Public Launch (`Blocked` on Operator Credentials)
1. Provision production Linux VM / cloud host + DNS (`app.<domain>`, `api.<domain>`) + TLS certificate (Caddy/Cloudflare/Let's Encrypt).
2. Populate `.env.production` with strong random `ENCRYPTION_MASTER_KEY`, `BILLING_WEBHOOK_SECRET`, `POSTGRES_PASSWORD`, and live keys:
   - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`
   - Email: `RESEND_API_KEY`, `EMAIL_FROM` (with SPF/DKIM/DMARC verified)
   - Social Publishing: `POSTIZ_API_KEY` + authorized social OAuth accounts
   - Storage: `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
3. Deploy: `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`.
4. Run one controlled Stripe Test Mode transaction, one real Resend verification email, and one authorized private/unlisted social post before opening public signups.
