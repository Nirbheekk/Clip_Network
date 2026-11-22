export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4100';

export interface SaasUser {
  id: string;
  email: string;
  name: string;
  systemRole: 'USER' | 'SUPER_ADMIN';
  status?: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  onboardingStep: number;
}

export interface SaasWorkspace {
  id: string;
  name: string;
  slug: string;
  planTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  subscriptionStatus: string;
  billingProviderMode: string;
  monthlyClipLimit: number;
  clipsUsedThisPeriod: number;
  primaryPlatform: string;
}

export interface PlanDef {
  id: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  name: string;
  tagline: string;
  priceMonthlyUsd: number;
  monthlyClipLimit: number;
  maxCreators: number;
  maxSocialAccounts: number;
  apiKeysAllowed: number;
  features: string[];
  highlighted?: boolean;
}

export interface Creator {
  id: string;
  handle: string;
  displayName: string;
  platform: string;
  channelUrl: string;
  tags: string[];
  requiredTopics: string[];
  bannedKeywords: string[];
  disallowLogos: boolean;
  defaultLayout: string;
  defaultCaptionStyle: string;
  enableSfx: boolean;
}

export interface SocialAccount {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string;
  autoPublishApproved: boolean;
  integrationMode: string;
  hasEncryptedToken: boolean;
}

export interface RouteRule {
  id: string;
  creatorId: string;
  socialAccountId: string;
  minComplianceScore: number;
  captionTemplate: string;
  hashtags: string[];
  enabled: boolean;
  creator?: Creator;
  socialAccount?: SocialAccount;
}

export interface ClipJob {
  id: string;
  title: string;
  sourceUrl: string;
  durationSec: number;
  layout: string;
  captionStyle: string;
  enableSfx: boolean;
  executionStatus: string;
  executionLogs: string[];
  durationMs: number;
  compliancePassed: boolean;
  complianceScore: number;
  approvalStatus: string;
  complianceReport: {
    matchedTopics: string[];
    disqualifiersTriggered: string[];
    reasons: string[];
  };
  creator?: Creator;
}

export interface PublishPost {
  id: string;
  platform: string;
  captionText: string;
  status: string;
  executionMode: string;
  externalPostId?: string | null;
  errorMessage?: string | null;
  clipJob?: { title: string; creator?: { displayName: string } };
  socialAccount?: { accountHandle: string; accountName: string };
}

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  externalEventId: string;
  planTier: string;
  amountCents: number;
  currency: string;
  status: string;
  providerMode: string;
  createdAt: string;
}

export interface SupportTicketItem {
  id: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  createdAt: string;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    extraHeaders?: Record<string, string>;
  } = {},
): Promise<{ ok: boolean; status: number; json: { success?: boolean; data?: T; error?: unknown; errorCode?: string } }> {
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.extraHeaders ?? {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: unknown;
    errorCode?: string;
  };
  return { ok: res.ok, status: res.status, json };
}
