# Clip Network — Complete Route & Page Inventory

## 1. Existing State (Commit `7ae451f`)
Previously, `apps/web` rendered a single Next.js route (`/`) acting as an SPA shell that conditionally switched between Landing/Auth, Onboarding, and a tabbed Studio view (`Studio`, `Creators`, `Routing`, `Queue`, `Billing`, `Settings`, `Support`, `Admin`).

### Existing Route Assessment
| Route | Status Before Directive | Assessment |
|---|---|---|
| `/` | Monolithic SPA | Mixed public marketing, auth modals, onboarding, and authenticated studio into one route; lacked deep links, editorial sections (FAQ, Problem/Solution, Workflow, Use Cases, Footer), and dedicated sub-routes. |

## 2. Target Multi-Route Architecture (34 Product Routes)

### A. Public Website & Authentication
| Route | Purpose | Priority |
|---|---|---|
| `/` | Editorial Landing Page (12 sections: Nav, Hero + real pipeline visualizer, Platform Support, Problem/Solution, 5-step Workflow, Differentiated Core Features, Approval & Compliance, Use Cases, Live Pricing Preview, FAQ, Final CTA, Footer) | P0 |
| `/pricing` | Dedicated 4-tier Pricing page fetched live from `/api/v1/billing/plans` with quota matrix & checkout | P0 |
| `/product` | End-to-end pipeline architecture walkthrough (`Source -> Moments -> Engine -> Compliance -> Approval -> Publish`) | P1 |
| `/login` | Split-screen desktop / single-column mobile auth with show/hide password, remember-me, real error & rate-limit handling | P0 |
| `/register` | Full registration with password requirements, confirm password, Terms consent, duplicate email handling | P0 |
| `/verify-email` | Dedicated verification state (pending, success, invalid token, resend) | P0 |
| `/forgot-password` | Password recovery request (non-enumerating email confirmation) | P1 |
| `/reset-password` | Token validation & new password confirmation | P1 |
| `/docs` | Real documentation & API quickstart referencing actual implemented endpoints | P1 |

### B. Authenticated SaaS Application (Persistent Left Sidebar Shell)
| Route | Purpose | Priority |
|---|---|---|
| `/onboarding` | 7-step guided resumable onboarding (Welcome, Workspace, Workflow Role, Add First Creator, Connect Social/Skip, First Campaign/Skip, Complete) | P0 |
| `/dashboard` | Operational home (greeting, plan/quota bar, real KPIs, recent clips, approval & publishing previews, quick actions) | P0 |
| `/creators` | Searchable/filterable creator table + Add Creator modal | P0 |
| `/creators/[id]` | Creator detail page (identity, compliance rules, routes, recent clips, edit/delete with confirmation) | P0 |
| `/campaigns` | Campaign compliance rule center + live `evaluateClipCompliance()` tester | P0 |
| `/social-accounts` | Connected social destinations with honest `SANDBOX_SIMULATED` vs `LIVE_OAUTH` badges, connect/disconnect, auto-publish toggle | P0 |
| `/routes` | Visual `Creator -> Campaign -> Destination -> Policy` routing manager (create, toggle, delete) | P0 |
| `/clips/new` | Focused Clip Ingestion Studio (real caption/SFX/framing presets, quota impact preview, redirects to `/clips/[id]`) | P0 |
| `/clips` | Visual Clip Library (grid/list toggle, search, creator/status/compliance filters) | P0 |
| `/clips/[id]` | Flagship Clip Review Studio (9:16 preview surface, compliance breakdown, engine logs & duration, Approve/Reject, Cancel/Retry, Publishing) | P0 |
| `/approvals` | Fast editorial Approval Queue for pending clips | P0 |
| `/publishing` | Publishing Queue (status, idempotency key, safe manual publish/retry, honest sandbox vs live label) | P0 |
| `/analytics` | Operational analytics computed strictly from DB (zero fabricated social views/reach) | P1 |
| `/activity` | Execution History table (ID, creator, started, duration, status, compliance score, detail link) | P1 |
| `/settings/billing` | Subscription management, 4-tier upgrade/downgrade, verified webhook checkout, cancel, invoice history | P0 |
| `/settings/usage` | Monthly clip, creator, social account, and API key quota meters with upgrade CTAs | P1 |
| `/settings/api-keys` | Developer API key management (`cn_live_...` shown once, revoke, `X-Api-Key` curl guide) | P0 |
| `/settings/workspace` | Workspace name, slug, ownership, RBAC summary | P1 |
| `/settings/team` | Workspace members & RBAC role matrix (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) | P1 |
| `/settings/profile` | Personal profile & password change | P1 |
| `/settings/notifications` | Notification preferences (honestly scoped to persisted workspace/account state) | P2 |
| `/support` | Support ticket submission & history | P1 |

### C. Super-Admin Application (`SUPER_ADMIN` Only)
| Route | Purpose | Priority |
|---|---|---|
| `/admin` | Platform overview KPIs, plan distribution, integration health | P1 |
| `/admin/users` | User search, status, suspend/reactivate | P1 |
| `/admin/subscriptions` | Workspace plans, subscription statuses, paid invoices | P1 |
| `/admin/operations` | Engine failures, API health, billing & publishing integration modes | P1 |
