# Clip Network — Security Review

**Review Baseline**: Commit `7cd6287` + Hardening Pass

## Verified Controls
- **Authentication**: `scryptSync` + 16-byte random salt + `timingSafeEqual` verification. Opaque 256-bit Bearer session tokens stored exclusively as `SHA-256` hashes in `Session`.
- **Session Revocation**: Logout deletes session immediately; password reset & admin suspension delete all active sessions for the user.
- **Brute-Force Protection**: Sliding-window rate limiter on `/api/v1/auth/register` and `/api/v1/auth/login`.
- **Tenant Isolation**: Every domain table (`CreatorAccount`, `ChannelVideo`, `SocialAccount`, `CreatorRouteRule`, `ClipJob`, `PublishPost`, `PostMetricSnapshot`, `ApiKey`, `SubscriptionInvoice`, `SupportTicket`, `AuditLog`) is indexed and filtered by `workspaceId` on every query and mutation. Cross-tenant access returns `404`.
- **RBAC**: Workspace roles (`VIEWER < MEMBER < ADMIN < OWNER`) enforced server-side via `requireAuth`; `/api/v1/admin/*` strictly gated to `SUPER_ADMIN` (`403 FORBIDDEN_ADMIN_ONLY`).
- **API Keys**: `cn_live_...` secrets displayed once at creation, stored as `SHA-256` hashes, revocable instantly (`401`).
- **Token Encryption**: Third-party social OAuth tokens encrypted at rest via `AES-256-GCM` (`ENCRYPTION_MASTER_KEY`) and never returned to browser clients.
- **Webhook Verification**: Stripe live webhooks verified via `stripe.webhooks.constructEvent()`; sandbox billing webhooks verified via `HMAC-SHA256` + `timingSafeEqual`. Frontend never activates paid plans.
- **SSRF Protection**: `assertSafeExternalUrl()` blocks non-HTTP(S) schemes, `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254` (cloud metadata), and IPv6 loopback `::1` on creator channel URLs and stream ingest URLs.
- **Secret Hygiene**: Verification and password reset tokens are never printed to production logs; dev token helpers are automatically disabled when `NODE_ENV=production`.
- **HTTP Security Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
