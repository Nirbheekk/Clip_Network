# Clip Network — Commercial SaaS Architecture & Roadmap

## Layered Architecture
1. **Presentation Layer (`apps/web`)**: Next.js 15 + Tailwind CSS + `shadcn/ui` (Higgsfield Obsidian Dark + Lovable Editorial Light), public landing/pricing, auth/onboarding, authenticated workspace studio, billing, settings/API keys, support, and Super-Admin panel.
2. **Authentication & Session Layer (`apps/api/src/auth.ts`)**: `crypto.scryptSync` + per-user random salt, SHA-256 hashed DB `Session` tokens & `ApiKey`s (`X-Api-Key`), expiring email verification & password reset tokens, sliding-window login rate limiter.
3. **Tenant & RBAC Layer**: Every domain entity (`CreatorAccount`, `SocialAccount`, `CreatorRouteRule`, `ClipJob`, `PublishPost`, `ApiKey`, `SubscriptionInvoice`, `SupportTicket`, `AuditLog`) is strictly scoped by `workspaceId` with role checks (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) and separate `SUPER_ADMIN` gate.
4. **Core Engine Layer (`packages/clip-engine`)**: Voice-synced ASS karaoke captions, 6 procedural FFmpeg SFX presets, 9:16 split-screen/center-crop rendering, and structured execution lifecycle (`PENDING`→`RUNNING`→`COMPLETED`/`FAILED`/`CANCELLED`) with logs, duration, retry, and cancel.
5. **Billing & Entitlements Layer**: Configurable 4-tier plans (`FREE`, `STARTER`, `PRO`, `ENTERPRISE`), server-side quota checks before every clip ingest (`402 QUOTA_EXCEEDED`), HMAC-SHA256 webhook verification (`STRIPE_WEBHOOK_SECRET` / sandbox webhook secret), invoice history, upgrade/downgrade/cancel.
6. **Infrastructure & CI**: Multi-stage Dockerfiles, `docker-compose.yml`, GitHub Actions CI (`typecheck` + `build` + `test`).
