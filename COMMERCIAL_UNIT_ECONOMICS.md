# Clip Network — Commercial Unit Economics & Margin Analysis

**Timestamp**: `2026-11-22T17:53:00+05:45`

## 1. Estimated Variable Cost Per Clip (Full Production Media Pipeline)
| Cost Component | Estimated Unit Cost / Clip (60s Short) | Basis |
|---|---|---|
| FFmpeg CPU Render & Procedural SFX | `\$0.004` | Self-hosted container CPU (~8–15s compute on 4 vCPU node) |
| Speech Transcription (Whisper API / Local) | `\$0.006` | `\$0.006/min` OpenAI Whisper API (or `\$0.001` self-hosted Faster-Whisper) |
| Object Storage + Egress (S3 / Cloudflare R2) | `\$0.002` | ~25MB MP4 + thumbnail stored 90 days (R2 zero egress) |
| Publishing API & Telemetry Sync | `\$0.001` | Amortized Postiz / social API requests |
| **Total Direct Variable Cost / Clip** | **`\$0.013`** | Conservative cloud estimate (`\$0.008` with self-hosted Whisper) |

## 2. Gross Margin Model Across Commercial Plans
*Assumes 70% average monthly quota utilization per active paying customer plus Stripe processing fee (`2.9% + \$0.30`).*

| Plan | Monthly Price | Clip Quota | Expected Clips (70% Util) | Direct Clip COGS | Stripe Fee | Gross Profit / User | Gross Margin |
|---|---|---|---|---|---|---|---|
| **FREE** | `\$0` | 10 | 5 | `\$0.07` | `\$0.00` | `-\$0.07` | Acquisition CAC |
| **STARTER** | `\$29` | 100 | 70 | `\$0.91` | `\$1.14` | **`\$26.95`** | **92.9%** |
| **PRO** | `\$99` | 500 | 350 | `\$4.55` | `\$3.17` | **`\$91.28`** | **92.2%** |
| **ENTERPRISE** | `\$299` | 5,000 | 3,500 | `\$45.50` | `\$8.97` | **`\$244.53`** | **81.8%** |

*Even at 100% full quota utilization on Enterprise (`5,000` clips = `\$65.00` COGS + `\$8.97` Stripe), gross margin remains **75.3%** (`\$225.03`/mo).*
