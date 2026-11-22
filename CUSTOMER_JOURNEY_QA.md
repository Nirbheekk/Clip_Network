# Clip Network — Customer Journey QA

| Workflow | Path Verified | Automated Test | Browser E2E | Status |
|---|---|---|---|---|
| **W1: Register -> Verify -> Login -> Onboard -> Creator** | `/register` -> `/onboarding` -> `/dashboard` | Pass (`clip-network-api.test.ts`) | Pass (`0` errors) | `SANDBOX VERIFIED` |
| **W2: Monitor -> Detect Video -> Clip -> Compliance -> Approval** | `POST /api/v1/monitor/scan` -> `/clips/[id]` | Pass (`clip-network-api.test.ts`) | Pass (`0` errors) | `SANDBOX VERIFIED` |
| **W3: Approve -> Publish -> Sync Metrics -> Recharts Insights** | `/approvals` -> `/publishing` -> `/analytics` | Pass (`clip-network-api.test.ts`) | Pass (`0` errors) | `SANDBOX VERIFIED` |
| **W4: Plan -> Checkout -> Verified Webhook -> Quota Enforcement** | `/pricing` -> `/settings/billing` -> `402` -> `200` | Pass (`clip-network-api.test.ts`) | Pass (`0` errors) | `SANDBOX VERIFIED` |
| **W5: Platform Validation, SSRF Guard, Email & S3 Storage** | Unit & Integration Tests | Pass (`production-integrations.test.ts`) | N/A (server-side) | `SANDBOX VERIFIED` |
| **W6: Multi-Tenant Isolation & Super-Admin RBAC** | Tenant B `404`, Non-Admin `403`, Admin `200` | Pass (`clip-network-api.test.ts`) | Verified | `SANDBOX VERIFIED` |
