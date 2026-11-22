# Clip Network — Editorial Creator-Tech Design System

## 1. Visual Identity & Palette
- **Dark Mode (Default — Studio Obsidian)**:
  - Canvas: `#09090B` (`--background`)
  - Elevated Surface: `#111114` (`--card`)
  - Subtle Surface / Input: `#18181B` (`--secondary`)
  - Accent: `#D4FF00` (`--primary`) with `#09090B` high-contrast foreground
  - Borders: Restrained 1px hairline `#27272A` (`--border`)
  - Text: `#FAFAFA` primary, `#A1A1AA` muted
- **Light Mode (Editorial Warm-White)**:
  - Canvas: `#FAF9F6` (`--background`)
  - Surface: `#FFFFFF` (`--card`)
  - Subtle Surface: `#F2EFE9` (`--secondary`)
  - Primary Action: `#111114` charcoal with crisp `#D4FF00` controlled editorial highlights
  - Borders: `#E4E2DC` (`--border`)

## 2. Typography
- **Display**: `Space Grotesk` (`--font-display`) — tight tracking (`-0.03em`), restrained semibold/bold weights for editorial authority.
- **UI Body**: `Inter` (`--font-sans`) — clean 14px/15px readable body copy, `tabular-nums` for quotas and metrics.
- **Monospace**: `JetBrains Mono` / `ui-monospace` (`--font-mono`) — execution logs, timestamps, API key prefixes, idempotency keys, and compliance scores.

## 3. Anti-AI-Slop Enforcement
- **No** gradient backgrounds behind cards or glowing neon boxes.
- **No** generic 3-column identical card grids repeated down the page.
- **No** emoji icons in UI controls (strictly crisp 1.5px `lucide-react` strokes).
- **No** fake social views/engagement charts, invented testimonials, or fake partner logos.
- **Purposeful layout variety**: Editorial split heroes, structured horizontal pipelines, dense operational data tables, asymmetric Review Studio (60% vertical media & logs / 40% compliance & approval inspector).

## 4. Core Shell & Reusable Components
- `AuthProvider`: Persistent Bearer session + `/api/v1/auth/me` hydration + theme state + global toast notifications.
- `PublicChrome`: Sticky editorial navigation bar + structured footer for all public marketing & docs routes.
- `AppShell`: Persistent 248px left sidebar (Brand, Workspace badge + quota bar, categorized navigation, Settings, Support/Docs, Admin when `SUPER_ADMIN`, User profile + Logout) + responsive mobile drawer + top breadcrumb bar.
- Reusable UI Primitives: `Button`, `Card`, `Badge`, `Input`, `Label`, `Switch`, `Tabs`, `ConfirmDialog`, `EmptyState`, `StatusBadge`, `QuotaBar`.
