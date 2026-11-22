import { z } from 'zod';

export const CreatorPlatformSchema = z.enum(['TWITCH', 'YOUTUBE', 'KICK']);
export type CreatorPlatform = z.infer<typeof CreatorPlatformSchema>;

export const SocialPlatformSchema = z.enum([
  'INSTAGRAM_REELS',
  'TIKTOK',
  'YOUTUBE_SHORTS',
  'X',
]);
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

export const CaptionStyleIdSchema = z.enum([
  'HIGH_ENERGY',
  'BOLD_CREATOR',
  'CLEAN_MINIMAL',
  'PODCAST_PREMIUM',
]);
export type CaptionStyleId = z.infer<typeof CaptionStyleIdSchema>;

export const LayoutModeSchema = z.enum(['SPLIT_FACECAM_BOTTOM', 'CENTER_CROP_9_16']);
export type LayoutMode = z.infer<typeof LayoutModeSchema>;

export const SfxPresetIdSchema = z.enum(['WHOOSH', 'POP', 'RISER', 'BOOM', 'CHIME', 'GLITCH']);
export type SfxPresetId = z.infer<typeof SfxPresetIdSchema>;

export const CreateCreatorRequestSchema = z.object({
  handle: z.string().min(2).max(80),
  displayName: z.string().min(2).max(120),
  platform: CreatorPlatformSchema,
  channelUrl: z.string().url(),
  tags: z.array(z.string().min(1).max(40)).default([]),
  requiredTopics: z.array(z.string().min(1).max(120)).default([]),
  bannedKeywords: z.array(z.string().min(1).max(120)).default([]),
  disallowLogos: z.boolean().default(true),
  defaultLayout: LayoutModeSchema.default('SPLIT_FACECAM_BOTTOM'),
  defaultCaptionStyle: CaptionStyleIdSchema.default('HIGH_ENERGY'),
  enableSfx: z.boolean().default(true),
  facecamCrop: z
    .object({
      x: z.number().int().nonnegative().default(0),
      y: z.number().int().nonnegative().default(0),
      width: z.number().int().positive().default(494),
      height: z.number().int().positive().default(278),
    })
    .optional(),
});
export type CreateCreatorRequest = z.infer<typeof CreateCreatorRequestSchema>;

export const CreateSocialAccountRequestSchema = z.object({
  platform: SocialPlatformSchema,
  accountName: z.string().min(2).max(120),
  accountHandle: z.string().min(2).max(80),
  accessToken: z.string().min(4).max(2048).optional(),
  autoPublishApproved: z.boolean().default(false),
  timezone: z.string().min(2).max(64).default('UTC'),
});
export type CreateSocialAccountRequest = z.infer<typeof CreateSocialAccountRequestSchema>;

export const ToggleAutoPublishRequestSchema = z.object({
  autoPublishApproved: z.boolean(),
});
export type ToggleAutoPublishRequest = z.infer<typeof ToggleAutoPublishRequestSchema>;

export const CreateRouteRuleRequestSchema = z.object({
  creatorId: z.string().uuid(),
  socialAccountId: z.string().uuid(),
  minComplianceScore: z.number().int().min(0).max(100).default(75),
  captionTemplate: z.string().max(1500).default('{hook} {tags}'),
  hashtags: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});
export type CreateRouteRuleRequest = z.infer<typeof CreateRouteRuleRequestSchema>;

export const IngestStreamRequestSchema = z.object({
  creatorId: z.string().uuid(),
  sourceUrl: z.string().url(),
  title: z.string().min(2).max(200).optional(),
  startSec: z.number().nonnegative().default(0),
  endSec: z.number().positive().default(60),
  transcriptText: z.string().min(10).max(20000).optional(),
  layout: LayoutModeSchema.optional(),
  captionStyle: CaptionStyleIdSchema.optional(),
  enableSfx: z.boolean().optional(),
  renderVideo: z.boolean().default(false),
});
export type IngestStreamRequest = z.infer<typeof IngestStreamRequestSchema>;

export const ClipDecisionRequestSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(500).optional(),
});
export type ClipDecisionRequest = z.infer<typeof ClipDecisionRequestSchema>;

export interface CampaignComplianceResult {
  passed: boolean;
  score: number;
  matchedTopics: string[];
  disqualifiersTriggered: string[];
  reasons: string[];
}

const GENERIC_CLICKBAIT_PATTERNS: readonly RegExp[] = [
  /i can'?t believe that happened/i,
  /wait until the end.*crazy/i,
  /you won'?t believe what happened/i,
];

/**
 * Evaluates a candidate clip against a creator's campaign requirements & disqualifiers.
 */
export function evaluateClipCompliance(params: {
  transcript: string;
  caption: string;
  requiredTopics: readonly string[];
  bannedKeywords: readonly string[];
  disallowLogos: boolean;
  hasAddedLogos: boolean;
}): CampaignComplianceResult {
  const haystack = `${params.transcript} ${params.caption}`.toLowerCase();
  const matchedTopics: string[] = [];
  const disqualifiersTriggered: string[] = [];
  const reasons: string[] = [];

  if (params.disallowLogos && params.hasAddedLogos) {
    disqualifiersTriggered.push('LOGO_DETECTED');
    reasons.push('Added logos or watermarks are strictly prohibited by creator campaign rules.');
  }

  for (const kw of params.bannedKeywords) {
    const clean = kw.trim().toLowerCase();
    if (clean && haystack.includes(clean)) {
      disqualifiersTriggered.push(`BANNED_KEYWORD:${kw}`);
      reasons.push(`Contains banned keyword "${kw}".`);
    }
  }

  for (const pat of GENERIC_CLICKBAIT_PATTERNS) {
    if (pat.test(params.caption)) {
      disqualifiersTriggered.push('LOW_VALUE_CLICKBAIT');
      reasons.push('Caption contains generic clickbait phrasing that adds no editorial value.');
      break;
    }
  }

  for (const topic of params.requiredTopics) {
    const clean = topic.trim().toLowerCase();
    if (clean && haystack.includes(clean)) {
      matchedTopics.push(topic);
    }
  }

  if (params.requiredTopics.length > 0 && matchedTopics.length === 0) {
    disqualifiersTriggered.push('MISSING_REQUIRED_TOPIC');
    reasons.push(
      `Clip does not match any required campaign topic (${params.requiredTopics.join(', ')}).`,
    );
  }

  let score = 100;
  if (params.requiredTopics.length > 0 && matchedTopics.length === 0) score -= 50;
  if (disqualifiersTriggered.includes('LOGO_DETECTED')) score -= 60;
  if (disqualifiersTriggered.includes('LOW_VALUE_CLICKBAIT')) score -= 35;
  score -= disqualifiersTriggered.filter((d) => d.startsWith('BANNED_KEYWORD:')).length * 30;
  score = Math.max(0, Math.min(100, score));

  return {
    passed: disqualifiersTriggered.length === 0 && score >= 70,
    score,
    matchedTopics,
    disqualifiersTriggered,
    reasons,
  };
}
