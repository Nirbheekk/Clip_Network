# Clip Network — End-to-End Customer Pilot Report

**Timestamp**: `2026-11-22T17:53:00+05:45`  
**Environment**: Local Stack (`http://localhost:3100` & `http://localhost:4100`) + Live Docker PostgreSQL 16 + Live Docker MinIO S3

## Customer Journey Step-by-Step Evidence
| Step | Action | Status | Evidence |
|---|---|---|---|
| 1 | Visit Landing Page & Pricing (`/`, `/pricing`) | `Locally verified` | 4 live plans from `/api/v1/billing/plans`, 0 console errors |
| 2 | Register & Email Verification (`/register`, `/verify-email`) | `Sandbox verified` | Account created, verification token accepted (`emailVerified: true`); live inbox delivery `Blocked` on `RESEND_API_KEY` |
| 3 | Login & Workspace Creation (`/login`, `/onboarding`) | `Locally verified` | Isolated workspace created, 5-step onboarding persisted |
| 4 | Add Creator & Connect Destination Account | `Sandbox verified` | Creator `Lacy` + `@lacy.reels` linked & auto-routed; live OAuth `Blocked` on `POSTIZ_API_KEY` |
| 5 | Channel Scan -> Clip Engine -> Compliance -> ASS/SFX | `Locally verified` | `COMPLETED` in ~1ms, `100/100` compliance, word-synced `{\kf...}` ASS & procedural SFX verified |
| 6 | Review Studio & Human Approval Gate (`/clips/[id]`) | `Locally verified` | 9:16 preview, S3 storage key, compiled ASS inspector, Approve/Reject confirmation verified |
| 7 | Media Storage (Presigned PUT/GET) | `Live verified` | Verified live against MinIO S3 (`200` PUT/GET, byte-exact match, `403` on unauth/tampered/expired) |
| 8 | Social Publishing & Telemetry Sync (`/publishing`, `/analytics`) | `Sandbox verified` | Idempotent `PUBLISHED_SANDBOX` + Recharts `AreaChart`/`BarChart` + `Sync Post Metrics` verified; live post `Blocked` on `POSTIZ_API_KEY` |
| 9 | Subscription Upgrade, Quota `402` & Billing Period Reset | `Sandbox verified` | `402 QUOTA_EXCEEDED` enforced, HMAC webhook upgraded to `PRO` (`500` clips), UTC rollover tested; live Stripe charge `Blocked` on `STRIPE_SECRET_KEY` |
| 10 | Team Invite, Role RBAC (`403` -> `201`) & Logout (`401`) | `Locally verified` | `VIEWER` blocked `403`, promoted to `MEMBER` `201`, session revoked on logout `401` |
