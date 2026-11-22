# Clip Network — Live Integration Verification Report

**Timestamp**: `2026-11-22T17:53:00+05:45`

## Verification Summary
| Integration | Status | Empirical Evidence | Exact Remaining Blocker |
|---|---|---|---|
| **PostgreSQL 16 + Backup/Restore** | `Live verified` | Pushed `schema.postgresql.prisma` to live `postgres:16-alpine` (`17` tables in `575ms`), ran `pg_dump` (`85,750` bytes), restored cleanly (`17` tables verified). | Provision managed cloud PostgreSQL & run `prisma migrate deploy` in staging |
| **S3-Compatible Object Storage (SigV4)** | `Live verified` | Verified `createPresignedS3Url()` live against `elestio/minio:latest`: Create bucket `200`, Presigned PUT `200`, Presigned GET `200`, `BYTES_MATCH=true`, Unauth direct GET `403`, Tampered signature `403`, Expired URL `403`. | Set cloud S3/R2/MinIO production credentials in `.env.production` |
| **Stripe Billing (Official SDK)** | `Sandbox verified` / `Blocked` (Live) | Raw-body JSON parser + `stripe.webhooks.constructEvent()` + Checkout + Billing Portal + `invoice.paid` / `invoice.payment_failed` + UTC monthly quota reset verified in Vitest (`20/20`). | Operator must supply `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_{STARTER,PRO,ENTERPRISE}` |
| **Resend Transactional Email** | `Sandbox verified` / `Blocked` (Live) | 6 responsive HTML + plain-text templates + 3-attempt bounded 5xx/429 retry verified in Vitest (`20/20`). | Operator must supply `RESEND_API_KEY` + SPF/DKIM/DMARC verified `EMAIL_FROM` domain |
| **Postiz Social Publishing** | `Sandbox verified` / `Blocked` (Live) | Platform validators (`IG Reels`, `TikTok`, `YT Shorts`, `X`), AES-256-GCM vault, `Idempotency-Key`, Human Approval Gate verified in Vitest (`20/20`). | Operator must supply `POSTIZ_API_KEY` + authorized OAuth social account |
| **Standalone Worker (`worker.ts`)** | `Locally verified` | Built cleanly (`apps/api/dist/worker.js`), uses shared `scanWorkspaceChannels()`, graceful `SIGINT`/`SIGTERM`, wired as dedicated service in `docker-compose.prod.yml`. | Deploy container in staging/prod |
