import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';

describe('@clip-network/api — End-to-End Creator Tagging, Social Routing, Compliance & Publishing', () => {
  const prisma = new PrismaClient();
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer(prisma);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('tags creator, links 2 social accounts (human-approval vs opt-in auto-publish), routes compliant clip, and blocks disqualified clip', async () => {
    const suffix = randomUUID().slice(0, 6);

    // 1. Tag Creator Account with campaign requirements & SFX enabled
    const creatorRes = await app.inject({
      method: 'POST',
      url: '/api/v1/creators',
      payload: {
        handle: `lacy-${suffix}`,
        displayName: 'Lacy',
        platform: 'TWITCH',
        channelUrl: 'https://www.twitch.tv/lacy',
        tags: ['GTA6', 'Lacy', 'TwitchClips'],
        requiredTopics: ['GTA 6', 'clipping'],
        bannedKeywords: ['scam'],
        disallowLogos: true,
        defaultLayout: 'SPLIT_FACECAM_BOTTOM',
        defaultCaptionStyle: 'HIGH_ENERGY',
        enableSfx: true,
      },
    });
    expect(creatorRes.statusCode).toBe(201);
    const creatorId = (creatorRes.json() as { data: { id: string } }).data.id;

    // 2. Link Clipping Account #1 (Instagram Reels — default human approval gate: autoPublishApproved=false)
    const igRes = await app.inject({
      method: 'POST',
      url: '/api/v1/social-accounts',
      payload: {
        platform: 'INSTAGRAM_REELS',
        accountName: 'Lacy Daily Clips IG',
        accountHandle: `@lacyclips_${suffix}`,
        accessToken: 'secret-oauth-token-ig',
        autoPublishApproved: false,
      },
    });
    expect(igRes.statusCode).toBe(201);
    const igBody = igRes.json() as { data: { id: string; hasEncryptedToken: boolean; encryptedToken?: string } };
    expect(igBody.data.hasEncryptedToken).toBe(true);
    expect(igBody.data.encryptedToken).toBeUndefined(); // Never leaks raw/encrypted token!

    // 3. Link Clipping Account #2 (TikTok — opt-in auto-publish enabled)
    const ttRes = await app.inject({
      method: 'POST',
      url: '/api/v1/social-accounts',
      payload: {
        platform: 'TIKTOK',
        accountName: 'Lacy Clips TikTok',
        accountHandle: `@lacytt_${suffix}`,
        autoPublishApproved: true,
      },
    });
    expect(ttRes.statusCode).toBe(201);
    const ttId = (ttRes.json() as { data: { id: string } }).data.id;

    // 4. Create Creator -> Social Account Routing Rules for BOTH accounts
    for (const socialAccountId of [igBody.data.id, ttId]) {
      const routeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/routes',
        payload: {
          creatorId,
          socialAccountId,
          minComplianceScore: 75,
          captionTemplate: '{hook} — {tags}',
          hashtags: ['#GTA6Marathon'],
        },
      });
      expect(routeRes.statusCode).toBe(201);
    }

    // 5. Ingest a COMPLIANT stream clip -> routes to both accounts:
    //    TikTok (opt-in auto-publish) publishes immediately in SANDBOX_SIMULATED;
    //    Instagram (default human gate) stays AWAITING_APPROVAL!
    const ingestOk = await app.inject({
      method: 'POST',
      url: '/api/v1/clips/ingest',
      payload: {
        creatorId,
        sourceUrl: 'https://www.twitch.tv/videos/2933767012',
        title: 'Lacy roasts clippers during GTA 6 Marathon',
        startSec: 27.8,
        endSec: 78.7,
        transcriptText:
          'Day two GTA 6 Marathon! My clipping campaign got 30 million views yesterday, you are just doing something wrong bro.',
      },
    });
    expect(ingestOk.statusCode).toBe(201);
    const okData = ingestOk.json() as {
      data: {
        clip: { id: string; compliancePassed: boolean; sfxCues: unknown[]; assScript: string };
        routedPosts: Array<{ id: string; platform: string; status: string }>;
      };
    };
    expect(okData.data.clip.compliancePassed).toBe(true);
    expect(okData.data.clip.sfxCues.length).toBeGreaterThan(0);
    expect(okData.data.clip.assScript).toContain('\\kf');
    expect(okData.data.routedPosts).toHaveLength(2);

    const igPost = okData.data.routedPosts.find((p) => p.platform === 'INSTAGRAM_REELS');
    const ttPost = okData.data.routedPosts.find((p) => p.platform === 'TIKTOK');
    expect(igPost?.status).toBe('AWAITING_APPROVAL');
    expect(ttPost?.status).toBe('PUBLISHED_SANDBOX');

    // 6. Human approves the clip -> releases Instagram post to PUBLISHED_SANDBOX
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/clips/${okData.data.clip.id}/decision`,
      payload: { decision: 'APPROVED' },
    });
    expect(approveRes.statusCode).toBe(200);
    const approvedData = approveRes.json() as {
      data: { publishedPosts: Array<{ platform: string; status: string }> };
    };
    expect(approvedData.data.publishedPosts).toHaveLength(1);
    expect(approvedData.data.publishedPosts[0]?.status).toBe('PUBLISHED_SANDBOX');

    // 7. Ingest a DISQUALIFIED clip (missing required topic + clickbait) -> 0 posts routed!
    const ingestBad = await app.inject({
      method: 'POST',
      url: '/api/v1/clips/ingest',
      payload: {
        creatorId,
        sourceUrl: 'https://www.twitch.tv/videos/2933767012',
        title: "I CAN'T BELIEVE THAT HAPPENED!",
        startSec: 100,
        endSec: 120,
        transcriptText: 'Random unrelated cooking moment.',
      },
    });
    expect(ingestBad.statusCode).toBe(201);
    const badData = ingestBad.json() as {
      data: { clip: { compliancePassed: boolean; approvalStatus: string }; routedPosts: unknown[] };
    };
    expect(badData.data.clip.compliancePassed).toBe(false);
    expect(badData.data.clip.approvalStatus).toBe('DISQUALIFIED');
    expect(badData.data.routedPosts).toHaveLength(0);
  });
});
