# Clip Network — Production Deployment Report

**Timestamp**: `2026-11-22T17:53:14+05:45`  
**Status**: `Locally verified` (`docker-compose.prod.yml` validated with exit code `0`; PostgreSQL 16 + MinIO S3 live-verified in Docker; `Production deployed` awaits operator cloud host, domain TLS & live secrets).

## Production Topology (`docker-compose.prod.yml`)
1. `postgres` (`postgres:16-alpine`) — persistent `postgres_data` volume, `pg_isready` healthcheck.
2. `redis` (`redis:7-alpine`) — AOF persistent `redis_data` volume, `redis-cli ping` healthcheck.
3. `minio` (`elestio/minio:latest`) — S3-compatible object storage (`minio_data` volume) or swap `S3_ENDPOINT` for AWS S3 / Cloudflare R2.
4. `api` (`Dockerfile.api` built with `PRISMA_SCHEMA=prisma/schema.postgresql.prisma`) — non-root UID, redacted JSON logging, sanitized global 500 error handler, `/api/health` readiness probe (`CHANNEL_MONITOR_INTERVAL_MS=0` so worker owns background polling).
5. `worker` (`node apps/api/dist/worker.js`) — dedicated non-overlapping background channel monitor & auto-clipping worker.
6. `web` (`Dockerfile.web`) — Next.js 15 production server (`36/36` routes).
7. `nginx` (`nginx:alpine` + `nginx/nginx.prod.conf`) — reverse proxy with security headers and 250MB media upload ceiling.

## Backup, Restore & Rollback
- **Backup Script**: `scripts/backup-postgres.sh` (gzipped `pg_dump --clean --if-exists`) — verified live (`85,750` bytes).
- **Restore Script**: `scripts/restore-postgres.sh` (verified live: `17/17` tables restored).
- **Rollback**: Re-pin `api`/`worker`/`web` image tags to previous Git SHA and run `docker compose -f docker-compose.prod.yml up -d`.
