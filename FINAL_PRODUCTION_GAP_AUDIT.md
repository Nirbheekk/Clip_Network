# Clip Network — Final Production Gap Audit (Phase 1)

**Audit Timestamp**: `2026-11-22T17:47:00+05:45`  
**Repository**: `C:\Users\user\Desktop\clip-network` | Branch: `main` | Baseline Commit: `0f70669`

## 1. Environment & Infrastructure Empirical Findings
- **Git**: Clean working tree at `0f70669`.
- **Docker Engine**: Available locally (`29.9.3`) with cached images (`postgres:16-alpine`, `redis:7-alpine`, `elestio/minio:latest`, `nginx:alpine`, `node:22-alpine`).
- **Configured Local `.env` (`apps/api/.env`)**: `PORT`, `HOST`, `DATABASE_URL` (SQLite), `ENCRYPTION_MASTER_KEY`, `POSTIZ_BASE_URL`, `NEXT_PUBLIC_API_URL` are set.
- **Unset Live Provider Credentials (Honest Blockers for `LIVE VERIFIED`)**:
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`
  - `RESEND_API_KEY`, `EMAIL_FROM`
  - `POSTIZ_API_KEY` (empty)
  - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (will be verified live locally against ephemeral `elestio/minio:latest`!)
- **Dependency Audit (`pnpm audit --prod`)**: 5 transitive advisories (2 moderate, 3 high) inside Next.js 15 / PostCSS / transitive deps — documented in `SECURITY_FINAL_AUDIT.md`.

## 2. Subsystem-by-Subsystem Gap Matrix
| Subsystem | Current Implementation | Verified Defect / Gap Found | Action In This Cutover | Readiness Before Cutover |
|---|---|---|---|---|
| **Billing Period & Quotas** | `Workspace.clipsUsedThisPeriod` + `periodResetAt` | `periodResetAt` never rolled over monthly in UTC; quota never reset automatically on new billing month | Implement `ensureCurrentBillingPeriod()` (UTC calendar month boundary) + unit tests | `Locally verified` |
| **Stripe Billing** | `apps/api/src/integrations/stripe.ts` + raw-body `/webhook/stripe` | Missing `invoice.paid` (renewal quota reset + receipt email) & `invoice.payment_failed` (`PAST_DUE` + dunning email) handlers in live Stripe webhook | Add complete `invoice.paid` & `invoice.payment_failed` handlers + emails; keep honest `BLOCKED` status for real Stripe charges until operator supplies `sk_test_`/`sk_live_` keys | `Sandbox verified` |
| **Background Worker** | `startBackgroundMonitorScheduler` inside `index.ts` only updated `lastPolledAt` | Coupled to API process and did not actually run channel scan pipeline | Extract shared `scanWorkspaceChannels()` service + create standalone `apps/api/src/worker.ts` + add `worker` service to `docker-compose.prod.yml` | `Implemented` |
| **Object Storage (S3)** | `createPresignedS3Url()` GET endpoint only | Missing presigned `PUT` upload URL endpoint & live S3 round-trip verification | Add `POST /api/v1/clips/:clipId/upload-url` + run **live MinIO container round-trip** (PUT upload, GET download, invalid signature 403, expired URL 403) | `Sandbox verified` |
| **PostgreSQL 16 Production** | `schema.postgresql.prisma` generated | `Dockerfile.api` built SQLite schema instead of Postgres; no backup/restore scripts; never live-tested against Postgres 16 | Update `Dockerfile.api` with `PRISMA_SCHEMA` arg, add `scripts/backup-postgres.sh` & `restore-postgres.sh`, run **live Postgres 16 schema push + `pg_dump` backup/restore verification** | `Implemented` |
| **Logging & Error Hygiene** | `Fastify({ logger: false })`, default error handler | No structured production JSON logging redaction; default 500 error could expose internals | Add redacted JSON logger in prod + sanitized global `setErrorHandler` | `Implemented` |
| **Resend Email** | `apps/api/src/integrations/email.ts` | No retry on transient 5xx from Resend API | Add bounded exponential retry (2 retries) on Resend HTTP 5xx; `LIVE VERIFIED` blocked on `RESEND_API_KEY` | `Sandbox verified` |
| **Postiz Social Publishing** | `apps/api/src/integrations/publishing.ts` | Properly validates platform limits & uses `Idempotency-Key` | Preserve Human Approval Gate; `LIVE VERIFIED` blocked on `POSTIZ_API_KEY` + authorized social account | `Sandbox verified` |
