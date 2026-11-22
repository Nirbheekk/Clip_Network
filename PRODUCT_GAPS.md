# Clip Network — Product, Functional & Monetization Gap Analysis

## 1. Verified Working Capabilities (Preserved)
- Multi-tenant Prisma schema (`User`, `Session`, `Workspace`, `WorkspaceMember`, `ApiKey`, `SubscriptionInvoice`, `SupportTicket`, `CreatorAccount`, `SocialAccount`, `CreatorRouteRule`, `ClipJob`, `PublishPost`, `AuditLog`).
- Auth (`scrypt` password hashing, DB sessions, rate limiting, email verification, forgot/reset/change password, `X-Api-Key`).
- Core engine (`alignTranscriptToSpeechWindows`, `buildWordSyncedAss`, `buildAutoSfxCuesForCuts`, `evaluateClipCompliance`).
- Server-side `402 QUOTA_EXCEEDED` enforcement + HMAC-SHA256 verified `/api/v1/billing/webhook` + `SUPER_ADMIN` RBAC.

## 2. Functional API Gaps Identified & Closing Plan
To power all 34 pages with **100% real backend state** and zero fake UI:
1. **Creator Detail CRUD (`/creators/[id]`)**: Add `GET /api/v1/creators/:id`, `PATCH /api/v1/creators/:id`, `DELETE /api/v1/creators/:id` (strictly tenant-scoped).
2. **Clip Review Studio (`/clips/[id]`)**: Add `GET /api/v1/clips/:clipId` returning full clip metadata, `assScript`, `sfxCues`, `complianceReport`, `executionLogs`, and linked `publishPosts`.
3. **Campaign Compliance Live Evaluator (`/campaigns`)**: Add `POST /api/v1/compliance/evaluate` invoking the real `@clip-network/shared` `evaluateClipCompliance()` so users can test rules before ingesting clips.
4. **Social Account Disconnect (`/social-accounts`)**: Add `DELETE /api/v1/social-accounts/:id`.
5. **Routing Rule Toggle & Delete (`/routes`)**: Add `PATCH /api/v1/routes/:id` and `DELETE /api/v1/routes/:id`.
6. **Operational Analytics (`/analytics`)**: Add `GET /api/v1/analytics` computing real DB metrics (total clips, approval rate, compliance pass rate, publish success rate, avg execution `durationMs`, per-creator breakdown). Never fabricates external social views/reach.
7. **Workspace Members (`/settings/team`, `/settings/workspace`)**: Add `GET /api/v1/workspace/members`.
8. **Resend Verification (`/verify-email`)**: Add `POST /api/v1/auth/resend-verification`.

## 3. Monetization Readiness & External Integration Boundaries
- **Stripe**: Checkout route supports live Stripe API wiring when `STRIPE_SECRET_KEY` is configured and transparently operates in `SANDBOX_WEBHOOK` mode (using real HMAC-SHA256 signature verification) when unset.
- **Social Publishing**: Encrypted AES-256-GCM token vault + idempotent `PublishPost` queue; transparently labeled `SANDBOX_SIMULATED` until `POSTIZ_API_KEY` + live OAuth credentials are configured.
- **Email Delivery**: Configurable SMTP/Resend hook boundary; returns `devVerificationToken` / `devResetToken` only in non-production environments so local workflows remain testable end-to-end.
