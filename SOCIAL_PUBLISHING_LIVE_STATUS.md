# Clip Network — Social Publishing Live Status

**Timestamp**: `2026-11-22T17:53:00+05:45`  
**Status**: `Sandbox verified` (`Live verified` is `Blocked` on operator `POSTIZ_API_KEY` + authorized social OAuth account).

## Platform Verification Matrix
| Platform | Duration / Caption Validator | Token Vault (AES-256-GCM) | Idempotency & Retry | Human Approval Gate | Live Post Status |
|---|---|---|---|---|---|
| **Instagram Reels** | `<= 90s`, `<= 2,200 chars` | Verified | Verified | Enforced default | `Blocked` (needs `POSTIZ_API_KEY` + IG OAuth) |
| **TikTok** | `<= 600s`, `<= 2,200 chars` | Verified | Verified | Enforced default | `Blocked` (needs `POSTIZ_API_KEY` + TikTok OAuth) |
| **YouTube Shorts** | `<= 60s`, `<= 500 chars` | Verified | Verified | Enforced default | `Blocked` (needs `POSTIZ_API_KEY` + YouTube OAuth) |
| **X** | `<= 140s`, `<= 280 chars` | Verified | Verified | Enforced default | `Blocked` (needs `POSTIZ_API_KEY` + X OAuth) |

## Governance Guarantees
- Simulated posts are strictly tagged `PUBLISHED_SANDBOX` / `SANDBOX_SIMULATED` and never reported as `PUBLISHED_LIVE`.
- Rejected or non-compliant clips cannot be published under any path (`BLOCKED`).
- Auto-publishing remains strictly opt-in per connected social account.
