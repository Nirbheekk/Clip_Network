# Clip Network — Production Deployment Guide

**Status**: `SANDBOX VERIFIED` (Production Docker Compose with PostgreSQL 16, Redis 7, MinIO S3, API, and Web ready; staging/prod cutover awaits operator secrets & domain)

## Production Stack (`docker-compose.prod.yml`)
- **Database**: PostgreSQL 16 (`postgres:16-alpine`) with persistent named volume `postgres_data` and `pg_isready` healthcheck.
- **Cache / Queue**: Redis 7 (`redis:7-alpine`) with AOF persistence and `redis-cli ping` healthcheck.
- **Object Storage**: MinIO (`minio/minio`) or managed AWS S3 / Cloudflare R2 via `S3_*` env vars.
- **API**: Multi-stage non-root `Dockerfile.api` on port `4100` with `/api/health` readiness probe.
- **Web**: Multi-stage non-root `Dockerfile.web` on port `3100` depending on healthy API.

## Environment Cutover Steps
1. Copy `.env.example` to `.env.production` and populate strong secrets (`ENCRYPTION_MASTER_KEY`, `BILLING_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `RESEND_API_KEY`, `POSTIZ_API_KEY`, `S3_*`, `PUBLIC_APP_URL`, `NEXT_PUBLIC_API_BASE_URL`).
2. Switch `apps/api/prisma/schema.prisma` datasource provider from `sqlite` to `postgresql` and run `npx prisma migrate deploy`.
3. Launch stack: `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`.
4. Place TLS-terminating reverse proxy (Nginx / Caddy / Cloudflare) in front of `:3100` (app) and `:4100` (API).

## Rollback Strategy
- Tag every production Docker image by Git SHA (`clip-network-api:<sha>`, `clip-network-web:<sha>`).
- Use additive-only Prisma migrations; before applying schema changes, run `pg_dump` snapshot to object storage.
- On regression, re-pin Compose image tags to the previous SHA and run `docker compose up -d`.
