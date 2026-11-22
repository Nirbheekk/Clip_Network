# Clip Network — Social Publishing Integration Guide

**Status**: `SANDBOX VERIFIED` (Real Postiz REST adapter + platform validation + AES-256-GCM token vault implemented; awaits `POSTIZ_API_KEY` + live connected OAuth accounts for `LIVE VERIFIED`)

## Supported Destinations & Platform Validation (`apps/api/src/integrations/publishing.ts`)
| Platform | Max Clip Duration | Max Caption Length | Framing Requirement |
|---|---|---|---|
| `INSTAGRAM_REELS` | 90s | 2,200 chars | 9:16 vertical |
| `TIKTOK` | 600s | 2,200 chars | 9:16 vertical |
| `YOUTUBE_SHORTS` | 60s | 500 chars | 9:16 vertical |
| `X` | 140s | 280 chars | 9:16 or 16:9 |

## Security & Publishing Pipeline
1. **Token Encryption**: OAuth tokens are encrypted via `AES-256-GCM` (`ENCRYPTION_MASTER_KEY`) and decrypted strictly server-side inside the publishing adapter. Browser code never receives tokens.
2. **Pre-Publish Eligibility Checks**: Verifies `clipJob.compliancePassed === true`, `approvalStatus !== 'REJECTED'`, platform duration/caption limits, and idempotency (`PublishPost.idempotencyKey`).
3. **Provider Execution**:
   - When `POSTIZ_API_KEY` and an encrypted account token are present, dispatches to `POSTIZ_API_BASE_URL` (default `https://api.postiz.com/public/v1/posts`) with idempotency header and records `PUBLISHED_LIVE` only upon confirmed `2xx` provider response.
   - Otherwise, runs cleanly in `SANDBOX_SIMULATED` mode (`PUBLISHED_SANDBOX`), never falsely reporting live social publication.
