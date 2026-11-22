# Clip Network — Commercial Launch Plan

**Baseline Commit**: `7cd6287`  
**Target**: Commercial Launch Readiness (Real Stripe, Resend Email, S3 Storage, Postiz Social Publishing, Background Scheduler, SSRF Hardening, Production Docker/PostgreSQL)

## Phased Launch Roadmap
| Phase | Scope | Status |
|---|---|---|
| Phase 1 | Repository audit & production gap analysis | `SANDBOX VERIFIED` |
| Phase 2 | Production infrastructure (`docker-compose.prod.yml`, PostgreSQL + Redis + MinIO, `.env.example`) | `IN PROGRESS` |
| Phase 3 | Real Stripe SDK integration (Checkout, Billing Portal, Webhook signature verification, Plan->Price ID mapping) | `IN PROGRESS` |
| Phase 4 | Real Email Delivery (Resend API + responsive HTML/text templates + token redaction) | `IN PROGRESS` |
| Phase 5 | Production Media Storage (S3-compatible SigV4 presigned GET/PUT URLs, tenant-isolated keys) | `IN PROGRESS` |
| Phase 6 | Real Social Publishing Provider (Postiz REST adapter + platform validation + retry/idempotency) | `IN PROGRESS` |
| Phase 7 | Background Channel Monitor Scheduler (non-overlapping interval worker + YouTube Atom RSS support) | `IN PROGRESS` |
| Phase 8–10 | SSRF hardening, security & integration test suite, Billing Portal UI wiring | `IN PROGRESS` |
| Phase 11–12 | Staging & Production live credential cutover | `BLOCKED` (awaiting operator live API keys) |
