# Clip Network — SaaS Production Readiness Report

## Architecture Summary
Clip Network has been transformed from a single-tenant tool into a full multi-tenant commercial SaaS platform:

1. **Identity & Authentication (`apps/api/src/auth.ts`)**:
   - Registration with password strength validation, Terms/Privacy consent, duplicate email prevention (`409`), and `scrypt` salted password hashing (`timingSafeEqual`).
   - Database-backed opaque Bearer sessions (`SHA-256` hashed at rest), `rememberMe` TTL support, Logout session revocation, Email Verification, Forgot/Reset Password with expiring tokens, Change Password, and Sliding-Window brute-force rate limiting.
   - Workspace API Keys (`cn_live_...`, `SHA-256` hashed at rest) supporting `X-Api-Key` programmatic access and instant revocation.
2. **Resumable User Onboarding (`apps/web/src/components/OnboardingFlow.tsx`)**:
   - 3-step onboarding (Workspace setup & primary stream platform -> Email verification -> Plan selection) tracked in `User.onboardingCompleted`.
3. **Multi-Tenancy & RBAC (`apps/api/prisma/schema.prisma`)**:
   - Strict `workspaceId` foreign keys and indexed query scoping across `CreatorAccount`, `SocialAccount`, `CreatorRouteRule`, `ClipJob`, `PublishPost`, `ApiKey`, `SubscriptionInvoice`, `SupportTicket`, and `AuditLog`.
   - Workspace RBAC (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) plus platform-level `SUPER_ADMIN` governance (`403` for standard users).
4. **Core Engine Integration & Execution Lifecycle**:
   - Full lifecycle tracking (`executionStatus`, `executionLogs`, `durationMs`), cancellation (`/cancel`), retry (`/retry`), voice-aligned subtitle generation, procedural SFX cues, campaign compliance scoring, and Human Approval Gate.
5. **Commercial Billing & Quota Enforcement**:
   - Configurable 4-tier `SAAS_PLANS` (`FREE`, `STARTER`, `PRO`, `ENTERPRISE`).
   - Hard server-side quota enforcement returning `402 QUOTA_EXCEEDED` when `clipsUsedThisPeriod >= monthlyClipLimit`.
   - Frontend never mutates subscription plans directly; `/api/v1/billing/webhook` verifies `x-billing-signature` via HMAC-SHA256 (`BILLING_WEBHOOK_SECRET`), deduplicates events via `externalEventId`, and records `SubscriptionInvoice` rows.
6. **Honest External Integration Boundaries**:
   - Without `STRIPE_SECRET_KEY`, billing runs explicitly in `SANDBOX_WEBHOOK` mode using real HMAC-SHA256 webhook verification.
   - Without `POSTIZ_API_KEY`, social publishing runs explicitly in `SANDBOX_SIMULATED` mode with AES-256-GCM encrypted token storage ready for live OAuth.
7. **Deployment & CI**:
   - Multi-stage non-root `Dockerfile.api` & `Dockerfile.web`, `docker-compose.yml` with healthchecks, and `.github/workflows/ci.yml`.

## Pre-Production Checklist
- Set strong random `ENCRYPTION_MASTER_KEY` and `BILLING_WEBHOOK_SECRET` in production secrets.
- Configure `DATABASE_URL` to a managed PostgreSQL instance (switching Prisma provider from `sqlite` to `postgresql` for horizontal scaling).
- Connect live `STRIPE_SECRET_KEY` and `POSTIZ_API_KEY` when going live.
- Set `NODE_ENV=production` to disable `devVerificationToken` / `devResetToken` / sandbox webhook signature helpers in API responses.
