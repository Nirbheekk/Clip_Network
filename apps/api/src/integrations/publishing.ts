import { randomUUID } from 'node:crypto';
import { decryptSecret } from '@clip-network/shared/crypto';

export interface PlatformLimits {
  maxDurationSec: number;
  maxCaptionLength: number;
  requiresVertical: boolean;
}

export const PLATFORM_PUBLISHING_LIMITS: Record<string, PlatformLimits> = {
  INSTAGRAM_REELS: { maxDurationSec: 90, maxCaptionLength: 2200, requiresVertical: true },
  TIKTOK: { maxDurationSec: 600, maxCaptionLength: 2200, requiresVertical: true },
  YOUTUBE_SHORTS: { maxDurationSec: 60, maxCaptionLength: 500, requiresVertical: true },
  X: { maxDurationSec: 140, maxCaptionLength: 280, requiresVertical: false },
};

export function validatePostForPlatform(params: {
  platform: string;
  durationSec: number;
  captionText: string;
}): { valid: boolean; errors: string[] } {
  const limits = PLATFORM_PUBLISHING_LIMITS[params.platform];
  if (!limits) {
    return { valid: false, errors: [`Unsupported social platform: ${params.platform}`] };
  }
  const errors: string[] = [];
  if (params.durationSec > limits.maxDurationSec) {
    errors.push(
      `${params.platform} supports clips up to ${limits.maxDurationSec}s (got ${params.durationSec}s).`,
    );
  }
  if (params.captionText.length > limits.maxCaptionLength) {
    errors.push(
      `${params.platform} captions must be <= ${limits.maxCaptionLength} characters.`,
    );
  }
  return { valid: errors.length === 0, errors };
}

export interface PublishDispatchResult {
  success: boolean;
  status: 'PUBLISHED_LIVE' | 'PUBLISHED_SANDBOX' | 'FAILED';
  executionMode: 'LIVE_OAUTH' | 'SANDBOX_SIMULATED';
  externalPostId?: string;
  errorMessage?: string;
}

export async function dispatchSocialPublish(params: {
  platform: string;
  accountHandle: string;
  encryptedToken: string | null;
  captionText: string;
  idempotencyKey: string;
  mediaUrl?: string | null;
  durationSec: number;
}): Promise<PublishDispatchResult> {
  const validation = validatePostForPlatform({
    platform: params.platform,
    durationSec: params.durationSec,
    captionText: params.captionText,
  });
  if (!validation.valid) {
    return {
      success: false,
      status: 'FAILED',
      executionMode: 'SANDBOX_SIMULATED',
      errorMessage: validation.errors.join(' '),
    };
  }

  const postizKey = process.env['POSTIZ_API_KEY']?.trim();
  const postizBase =
    process.env['POSTIZ_API_BASE_URL']?.trim() || 'https://api.postiz.com/public/v1';

  if (postizKey && postizKey.length > 8 && params.encryptedToken) {
    try {
      const decryptedIntegrationId = decryptSecret(params.encryptedToken);
      const res = await fetch(`${postizBase}/posts`, {
        method: 'POST',
        headers: {
          Authorization: postizKey,
          'Content-Type': 'application/json',
          'Idempotency-Key': params.idempotencyKey,
        },
        body: JSON.stringify({
          type: 'now',
          posts: [
            {
              integration: { id: decryptedIntegrationId },
              value: [
                {
                  content: params.captionText,
                  ...(params.mediaUrl ? { image: [{ path: params.mediaUrl }] } : {}),
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        return {
          success: false,
          status: 'FAILED',
          executionMode: 'LIVE_OAUTH',
          errorMessage: `Postiz publish rejected (${res.status}): ${errText.slice(0, 180)}`,
        };
      }

      const body = (await res.json().catch(() => ({}))) as { id?: string };
      return {
        success: true,
        status: 'PUBLISHED_LIVE',
        executionMode: 'LIVE_OAUTH',
        externalPostId: body.id ?? `live-${params.platform.toLowerCase()}-${randomUUID().slice(0, 8)}`,
      };
    } catch (err) {
      return {
        success: false,
        status: 'FAILED',
        executionMode: 'LIVE_OAUTH',
        errorMessage: err instanceof Error ? err.message : 'External publishing network error',
      };
    }
  }

  // Honest SANDBOX_SIMULATED mode when live provider credentials are absent
  return {
    success: true,
    status: 'PUBLISHED_SANDBOX',
    executionMode: 'SANDBOX_SIMULATED',
    externalPostId: `sandbox-${params.platform.toLowerCase()}-${randomUUID().slice(0, 8)}`,
  };
}
