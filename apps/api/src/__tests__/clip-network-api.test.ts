import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildServer } from '../server.js';
import { computeWebhookSignature } from '../auth.js';

const TEST_DB_PATH = join(process.cwd(), 'data', 'test-saas-e2e.db');
const TEST_DB_URL = `file:${TEST_DB_PATH.replace(/\\/g, '/')}`;

describe('Clip Network Commercial SaaS — End-to-End Integration Suite', () => {
  let prisma: PrismaClient;
  let app: ReturnType<typeof buildServer>;

  let tenantAToken = '';
  let tenantAWorkspaceId = '';
  let tenantAUserId = '';
  let tenantAVerificationToken = '';
  let tenantBToken = '';
  let adminToken = '';

  let creatorId = '';
  let manualAccountId = '';
  let autoAccountId = '';
  let compliantClipId = '';
  let apiKeyId = '';
  let rawApiKey = '';

  beforeAll(async () => {
    try {
      rmSync(TEST_DB_PATH, { force: true });
    } catch {
      // ignore if missing
    }
    process.env['DATABASE_URL'] = TEST_DB_URL;
    process.env['SUPER_ADMIN_EMAIL'] = 'admin@clipnetwork.io';
    execSync('npx prisma db push --skip-generate', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await prisma.$connect();
    app = buildServer(prisma);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    try {
      rmSync(TEST_DB_PATH, { force: true });
    } catch {
      // ignore
    }
  });

  it('1. Public health & 4-tier pricing catalog work without auth', async () => {
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json().database).toBe('connected');

    const plans = await app.inject({ method: 'GET', url: '/api/v1/billing/plans' });
    expect(plans.statusCode).toBe(200);
    expect(plans.json().data.length).toBe(4);
  });

  it('2. Blocks unauthenticated access to protected SaaS routes (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/creators' });
    expect(res.statusCode).toBe(401);
    expect(res.json().errorCode).toBe('UNAUTHORIZED');
  });

  it('3. Registers Tenant A, enforces duplicate email (409) & verifies email', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        name: 'Alex Founder',
        email: 'alex@studio-a.io',
        password: 'Password123',
        workspaceName: 'Studio A Network',
        termsAccepted: true,
      },
    });
    expect(reg.statusCode).toBe(201);
    const body = reg.json().data;
    tenantAToken = body.token;
    tenantAWorkspaceId = body.workspace.id;
    tenantAUserId = body.user.id;
    tenantAVerificationToken = body.devVerificationToken;
    expect(body.user.emailVerified).toBe(false);
    expect(body.workspace.planTier).toBe('FREE');

    const dup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        name: 'Duplicate',
        email: 'alex@studio-a.io',
        password: 'Password123',
        termsAccepted: true,
      },
    });
    expect(dup.statusCode).toBe(409);

    const verify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: tenantAVerificationToken },
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().data.emailVerified).toBe(true);
  });

  it('4. Completes onboarding and persists workspace setup', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/complete',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        workspaceName: 'Studio A Pro Clips',
        primaryPlatform: 'TWITCH',
        selectedPlan: 'FREE',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.onboardingCompleted).toBe(true);

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.user.onboardingCompleted).toBe(true);
    expect(me.json().data.workspace.name).toBe('Studio A Pro Clips');
  });

  it('5. Creates & authenticates with X-Api-Key, then revokes it cleanly', async () => {
    const createKey = await app.inject({
      method: 'POST',
      url: '/api/v1/api-keys',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { name: 'CI Automation Key' },
    });
    expect(createKey.statusCode).toBe(201);
    apiKeyId = createKey.json().data.id;
    rawApiKey = createKey.json().data.rawKey;
    expect(rawApiKey.startsWith('cn_live_')).toBe(true);

    const viaKey = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/summary',
      headers: { 'x-api-key': rawApiKey },
    });
    expect(viaKey.statusCode).toBe(200);

    const revoke = await app.inject({
      method: 'POST',
      url: `/api/v1/api-keys/${apiKeyId}/revoke`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    expect(revoke.statusCode).toBe(200);

    const afterRevoke = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/summary',
      headers: { 'x-api-key': rawApiKey },
    });
    expect(afterRevoke.statusCode).toBe(401);
  });

  it('6. Core Engine: tags creator, links accounts, ingests clip with lifecycle logs, enforces compliance & approval gate', async () => {
    const creator = await app.inject({
      method: 'POST',
      url: '/api/v1/creators',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        handle: 'lacy',
        displayName: 'Lacy',
        platform: 'TWITCH',
        channelUrl: 'https://www.twitch.tv/lacy',
        tags: ['GTA6', 'Lacy'],
        requiredTopics: ['GTA', 'marathon'],
        bannedKeywords: ['gambling'],
        disallowLogos: true,
        defaultLayout: 'SPLIT_FACECAM_BOTTOM',
        defaultCaptionStyle: 'HIGH_ENERGY',
        enableSfx: true,
      },
    });
    expect(creator.statusCode).toBe(201);
    creatorId = creator.json().data.id;

    const manual = await app.inject({
      method: 'POST',
      url: '/api/v1/social-accounts',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        platform: 'INSTAGRAM_REELS',
        accountName: 'Lacy Manual',
        accountHandle: '@lacy.manual',
        autoPublishApproved: false,
      },
    });
    expect(manual.statusCode).toBe(201);
    manualAccountId = manual.json().data.id;

    const auto = await app.inject({
      method: 'POST',
      url: '/api/v1/social-accounts',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        platform: 'TIKTOK',
        accountName: 'Lacy Auto',
        accountHandle: '@lacy.auto',
        autoPublishApproved: true,
      },
    });
    expect(auto.statusCode).toBe(201);
    autoAccountId = auto.json().data.id;

    for (const socialAccountId of [manualAccountId, autoAccountId]) {
      const route = await app.inject({
        method: 'POST',
        url: '/api/v1/routes',
        headers: { authorization: `Bearer ${tenantAToken}` },
        payload: { creatorId, socialAccountId, minComplianceScore: 75, hashtags: ['GTA6'] },
      });
      expect(route.statusCode).toBe(201);
    }

    const ingest = await app.inject({
      method: 'POST',
      url: '/api/v1/clips/ingest',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        creatorId,
        sourceUrl: 'https://www.twitch.tv/videos/2933767012',
        title: 'Lacy GTA 6 Marathon Hype',
        startSec: 120,
        endSec: 142,
        transcriptText: 'We are doing a crazy GTA 6 marathon tonight on stream!',
      },
    });
    expect(ingest.statusCode).toBe(201);
    const data = ingest.json().data;
    compliantClipId = data.clip.id;
    expect(data.clip.executionStatus).toBe('COMPLETED');
    expect(data.clip.executionLogs.length).toBeGreaterThanOrEqual(4);
    expect(data.clip.compliancePassed).toBe(true);
    expect(data.routedPosts.length).toBe(2);

    const manualPost = data.routedPosts.find((p: { socialAccountId: string }) => p.socialAccountId === manualAccountId);
    const autoPost = data.routedPosts.find((p: { socialAccountId: string }) => p.socialAccountId === autoAccountId);
    expect(manualPost.status).toBe('AWAITING_APPROVAL');
    expect(autoPost.status).toBe('PUBLISHED_SANDBOX');

    // Cancel & Retry lifecycle test
    const cancel = await app.inject({
      method: 'POST',
      url: `/api/v1/clips/${compliantClipId}/cancel`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().data.executionStatus).toBe('CANCELLED');

    const retry = await app.inject({
      method: 'POST',
      url: `/api/v1/clips/${compliantClipId}/retry`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().data.executionStatus).toBe('COMPLETED');
  });

  it('7. Enforces strict multi-tenant isolation between Tenant A and Tenant B', async () => {
    const regB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        name: 'Beta User',
        email: 'beta@studio-b.io',
        password: 'Password123',
        workspaceName: 'Studio B',
        termsAccepted: true,
      },
    });
    expect(regB.statusCode).toBe(201);
    tenantBToken = regB.json().data.token;

    // Tenant B must see 0 creators & 0 clips
    const creatorsB = await app.inject({
      method: 'GET',
      url: '/api/v1/creators',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(creatorsB.statusCode).toBe(200);
    expect(creatorsB.json().data.length).toBe(0);

    // Tenant B cannot approve or cancel Tenant A's clip (404)
    const crossDecision = await app.inject({
      method: 'POST',
      url: `/api/v1/clips/${compliantClipId}/decision`,
      headers: { authorization: `Bearer ${tenantBToken}` },
      payload: { decision: 'APPROVED' },
    });
    expect(crossDecision.statusCode).toBe(404);
  });

  it('8. Enforces server-side monthly clip quota (402) and upgrades via HMAC-signed billing webhook', async () => {
    // Set Tenant A usage to limit (10/10)
    await prisma.workspace.update({
      where: { id: tenantAWorkspaceId },
      data: { clipsUsedThisPeriod: 10 },
    });

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/clips/ingest',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        creatorId,
        sourceUrl: 'https://www.twitch.tv/videos/2933767012',
        title: 'Over Quota Clip',
        startSec: 10,
        endSec: 25,
        transcriptText: 'GTA marathon clip over quota',
      },
    });
    expect(blocked.statusCode).toBe(402);
    expect(blocked.json().errorCode).toBe('QUOTA_EXCEEDED');

    // Unsigned webhook must be rejected (401)
    const webhookPayload = {
      eventId: 'evt_pro_upgrade_001',
      eventType: 'checkout.session.completed',
      workspaceId: tenantAWorkspaceId,
      planTier: 'PRO',
      amountCents: 9900,
    };
    const badSig = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook',
      headers: { 'x-billing-signature': 'invalid-signature' },
      payload: webhookPayload,
    });
    expect(badSig.statusCode).toBe(401);

    // Properly signed HMAC webhook upgrades workspace to PRO (500 clips/mo)
    const validSig = computeWebhookSignature(JSON.stringify(webhookPayload));
    const goodSig = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook',
      headers: { 'x-billing-signature': validSig },
      payload: webhookPayload,
    });
    expect(goodSig.statusCode).toBe(200);
    expect(goodSig.json().data.workspace.planTier).toBe('PRO');
    expect(goodSig.json().data.workspace.monthlyClipLimit).toBe(500);

    // Now ingest succeeds again!
    const unblocked = await app.inject({
      method: 'POST',
      url: '/api/v1/clips/ingest',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        creatorId,
        sourceUrl: 'https://www.twitch.tv/videos/2933767012',
        title: 'Post Upgrade GTA Marathon Clip',
        startSec: 10,
        endSec: 25,
        transcriptText: 'GTA marathon clip unlocked after PRO upgrade',
      },
    });
    expect(unblocked.statusCode).toBe(201);

    // Automated Channel Monitor -> Auto-Clip -> Auto-Publish -> Metrics Sync -> Insights
    const scan = await app.inject({
      method: 'POST',
      url: '/api/v1/monitor/scan',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { autoExecute: true },
    });
    expect(scan.statusCode).toBe(200);
    expect(scan.json().data.creatorsScanned).toBe(1);
    expect(scan.json().data.clipsCreated).toBe(1);
    expect(scan.json().data.postsRouted).toBe(2);

    const sync = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/sync-metrics',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    expect(sync.statusCode).toBe(200);
    expect(sync.json().data.syncedCount).toBeGreaterThanOrEqual(1);

    const analytics = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    expect(analytics.statusCode).toBe(200);
    expect(analytics.json().data.totals.detectedVideosCount).toBeGreaterThanOrEqual(1);
    expect(analytics.json().data.totals.totalViews).toBeGreaterThan(0);
    expect(analytics.json().data.platformBreakdown.length).toBeGreaterThanOrEqual(1);
    expect(analytics.json().data.insights.length).toBeGreaterThanOrEqual(1);

    // Cancel subscription downgrades cleanly to FREE
    const cancelSub = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/cancel',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    expect(cancelSub.statusCode).toBe(200);
    expect(cancelSub.json().data.planTier).toBe('FREE');
  });

  it('9. Support tickets & Super-Admin RBAC (403 for normal user, 200 for SUPER_ADMIN)', async () => {
    const ticket = await app.inject({
      method: 'POST',
      url: '/api/v1/support/tickets',
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        subject: 'Need custom RTMP ingest help',
        message: 'Can we connect our agency Twitch multi-stream relay to Clip Network?',
        priority: 'HIGH',
      },
    });
    expect(ticket.statusCode).toBe(201);

    // Normal user blocked from admin panel (403)
    const nonAdmin = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/overview',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    expect(nonAdmin.statusCode).toBe(403);

    // Register configured SUPER_ADMIN_EMAIL
    const regAdmin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        name: 'Platform Admin',
        email: 'admin@clipnetwork.io',
        password: 'AdminPassword123',
        termsAccepted: true,
      },
    });
    expect(regAdmin.statusCode).toBe(201);
    adminToken = regAdmin.json().data.token;

    const overview = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/overview',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().data.totals.users).toBe(3);
    expect(overview.json().data.totals.totalRevenueUsd).toBe(99);

    // Admin suspends Tenant A -> Tenant A token immediately rejected (401)
    const suspend = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${tenantAUserId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'SUSPENDED' },
    });
    expect(suspend.statusCode).toBe(200);

    const afterSuspend = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    expect(afterSuspend.statusCode).toBe(401);
  });

  it('10. Logout invalidates active session token (401 on subsequent request)', async () => {
    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(logout.statusCode).toBe(200);

    const afterLogout = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    expect(afterLogout.statusCode).toBe(401);
  });
});
