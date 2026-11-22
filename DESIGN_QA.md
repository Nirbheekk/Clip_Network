# Clip Network — Design & Product QA Checklist

## Visual Quality
- [x] Dark mode `#09090B` canvas + `#D4FF00` accent + restrained hairline `#27272A` borders
- [x] Light mode `#FAF9F6` editorial warm-white canvas + crisp charcoal typography
- [x] `Space Grotesk` display + `Inter` UI + `JetBrains Mono` monospace with `tabular-nums`
- [x] Zero neon glow boxes, zero gradient-covered cards, zero emoji UI icons, zero fake social views/reach

## Functional & Commercial Quality
- [x] All 34 product routes implemented with persistent `AppShell` sidebar & `PublicChrome`
- [x] Dedicated `/pricing` and `/` pricing preview read live `SAAS_PLANS` from `/api/v1/billing/plans`
- [x] `/campaigns` runs the exact server-side `evaluateClipCompliance()` engine
- [x] `/clips/[id]` Review Studio displays 9:16 framing metadata, aligned transcript, compliance report, timestamped engine logs, Approve/Reject, Cancel/Retry, and routed publish destinations
- [x] `/analytics` computes operational metrics from PostgreSQL/SQLite and explicitly discloses scope (`OPERATIONAL_METRICS_ONLY`)
- [x] `/admin/*` protected by `SUPER_ADMIN` role (`403` on API + automatic redirect in UI)
