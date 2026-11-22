# Clip Network — Autonomous Stream-to-Clip Distribution System

Standalone TypeScript monorepo that lets operators **tag creator accounts**, **link social clipping accounts**, **automatically extract voice-synced 9:16 viral shorts with procedural SFX**, enforce **campaign compliance & zero-logo rules**, and **route clips to linked accounts** (human approval gate by default, with per-account opt-in auto-publish).

## Architecture
- `packages/shared`: Zod contracts, campaign compliance evaluator (required topics, banned keywords, zero-logo & anti-clickbait checks), and server-only AES-256-GCM token encryption (`@clip-network/shared/crypto`).
- `packages/clip-engine`: Word-synced ASS v4+ karaoke subtitle engine, 6 commercially safe procedural FFmpeg SFX presets (`WHOOSH`, `POP`, `RISER`, `BOOM`, `CHIME`, `GLITCH`) with `-14 LUFS` loudnorm, and 9:16 split-screen/center-crop renderer.
- `apps/api`: Fastify REST API + Prisma SQLite (`CreatorAccount`, `SocialAccount`, `CreatorRouteRule`, `ClipJob`, `PublishPost`, `AuditLog`).
- `apps/web`: Next.js 15 Control Center for Creators, Clipping Accounts & Routing, Stream Ingest, and Publish Queue.

## Quickstart
```bash
pnpm install
cp .env.example apps/api/.env
pnpm run db:push
pnpm run test
pnpm run dev:api   # http://localhost:4100
pnpm run dev:web   # http://localhost:3100
```
