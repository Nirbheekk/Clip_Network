import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import {
  ClipDecisionRequestSchema,
  CreateCreatorRequestSchema,
  CreateRouteRuleRequestSchema,
  CreateSocialAccountRequestSchema,
  evaluateClipCompliance,
  IngestStreamRequestSchema,
  ToggleAutoPublishRequestSchema,
} from '@clip-network/shared';
import { encryptSecret } from '@clip-network/shared/crypto';
import {
  alignTranscriptToSpeechWindows,
  buildAutoSfxCuesForCuts,
  buildWordSyncedAss,
  SFX_PRESETS,
} from '@clip-network/clip-engine';

export function buildServer(prisma: PrismaClient): FastifyInstance {
  const app = Fastify({ logger: false });
  void app.register(cors, { origin: true });

  async function logAudit(action: string, entityType: string, entityId: string, details: unknown) {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        details: JSON.stringify(details),
      },
    });
  }

  async function executePublishPost(postId: string) {
    const post = await prisma.publishPost.findUnique({
      where: { id: postId },
      include: { clipJob: true, socialAccount: true },
    });
    if (!post) return null;

    if (!post.clipJob.compliancePassed) {
      return prisma.publishPost.update({
        where: { id: post.id },
        data: {
          status: 'BLOCKED',
          errorMessage: 'Blocked by Creator Campaign Compliance Gate.',
        },
      });
    }

    if (post.status === 'PUBLISHED_SANDBOX' || post.status === 'PUBLISHED_LIVE') {
      return post; // Idempotent replay
    }

    const postizKey = process.env['POSTIZ_API_KEY']?.trim();
    const isLive = Boolean(postizKey && postizKey.length > 8 && post.socialAccount.encryptedToken);
    const nextStatus = isLive ? 'PUBLISHED_LIVE' : 'PUBLISHED_SANDBOX';
    const executionMode = isLive ? 'LIVE_OAUTH' : 'SANDBOX_SIMULATED';
    const externalPostId = `${isLive ? 'live' : 'sandbox'}-${post.platform.toLowerCase()}-${randomUUID().slice(0, 8)}`;

    const updated = await prisma.publishPost.update({
      where: { id: post.id },
      data: {
        status: nextStatus,
        executionMode,
        externalPostId,
        publishedAt: new Date(),
        errorMessage: null,
      },
    });

    await logAudit('PUBLISH_POST_EXECUTED', 'PublishPost', updated.id, {
      platform: updated.platform,
      executionMode,
      externalPostId,
      accountHandle: post.socialAccount.accountHandle,
    });

    return updated;
  }

  app.get('/api/health', async () => ({
    success: true,
    service: '@clip-network/api',
    sfxPresets: Object.values(SFX_PRESETS).map((p) => p.id),
  }));

  // 1. Creator Accounts (Tagging & Campaign Rules)
  app.get('/api/v1/creators', async () => {
    const creators = await prisma.creatorAccount.findMany({
      include: { routes: { include: { socialAccount: true } }, _count: { select: { clips: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      data: creators.map((c) => ({
        ...c,
        tags: JSON.parse(c.tagsJson) as string[],
        requiredTopics: JSON.parse(c.requiredTopicsJson) as string[],
        bannedKeywords: JSON.parse(c.bannedKeywordsJson) as string[],
      })),
    };
  });

  app.post('/api/v1/creators', async (request, reply) => {
    const parsed = CreateCreatorRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const created = await prisma.creatorAccount.create({
      data: {
        handle: d.handle.toLowerCase(),
        displayName: d.displayName,
        platform: d.platform,
        channelUrl: d.channelUrl,
        tagsJson: JSON.stringify(d.tags),
        requiredTopicsJson: JSON.stringify(d.requiredTopics),
        bannedKeywordsJson: JSON.stringify(d.bannedKeywords),
        disallowLogos: d.disallowLogos,
        defaultLayout: d.defaultLayout,
        defaultCaptionStyle: d.defaultCaptionStyle,
        enableSfx: d.enableSfx,
        facecamCropJson: d.facecamCrop ? JSON.stringify(d.facecamCrop) : null,
      },
    });
    await logAudit('CREATOR_TAGGED', 'CreatorAccount', created.id, {
      handle: created.handle,
      platform: created.platform,
      tags: d.tags,
    });
    return reply.status(201).send({
      success: true,
      data: {
        ...created,
        tags: d.tags,
        requiredTopics: d.requiredTopics,
        bannedKeywords: d.bannedKeywords,
      },
    });
  });

  // 2. Linked Clipping / Social Media Accounts (AES-256-GCM encrypted tokens + opt-in auto-publish)
  app.get('/api/v1/social-accounts', async () => {
    const accounts = await prisma.socialAccount.findMany({
      include: { routes: { include: { creator: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      data: accounts.map(({ encryptedToken, ...safe }) => ({
        ...safe,
        hasEncryptedToken: Boolean(encryptedToken),
      })),
    };
  });

  app.post('/api/v1/social-accounts', async (request, reply) => {
    const parsed = CreateSocialAccountRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const encryptedToken = d.accessToken ? encryptSecret(d.accessToken) : null;
    const postizKey = process.env['POSTIZ_API_KEY']?.trim();
    const integrationMode =
      postizKey && postizKey.length > 8 && encryptedToken ? 'LIVE_OAUTH' : 'SANDBOX_SIMULATED';

    const created = await prisma.socialAccount.create({
      data: {
        platform: d.platform,
        accountName: d.accountName,
        accountHandle: d.accountHandle,
        encryptedToken,
        autoPublishApproved: d.autoPublishApproved,
        timezone: d.timezone,
        integrationMode,
      },
    });

    await logAudit('SOCIAL_ACCOUNT_LINKED', 'SocialAccount', created.id, {
      platform: created.platform,
      accountHandle: created.accountHandle,
      autoPublishApproved: created.autoPublishApproved,
      integrationMode,
    });

    const { encryptedToken: _omitted, ...safe } = created;
    return reply.status(201).send({
      success: true,
      data: { ...safe, hasEncryptedToken: Boolean(_omitted) },
    });
  });

  app.patch('/api/v1/social-accounts/:id/auto-publish', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ToggleAutoPublishRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const updated = await prisma.socialAccount.update({
      where: { id },
      data: { autoPublishApproved: parsed.data.autoPublishApproved },
    });
    await logAudit('AUTO_PUBLISH_POLICY_UPDATED', 'SocialAccount', updated.id, {
      autoPublishApproved: updated.autoPublishApproved,
    });
    const { encryptedToken: _omitted, ...safe } = updated;
    return { success: true, data: safe };
  });

  // 3. Creator -> Clipping Social Account Routing Rules
  app.get('/api/v1/routes', async () => {
    const routes = await prisma.creatorRouteRule.findMany({
      include: { creator: true, socialAccount: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      data: routes.map((r) => ({
        ...r,
        hashtags: JSON.parse(r.hashtagsJson) as string[],
      })),
    };
  });

  app.post('/api/v1/routes', async (request, reply) => {
    const parsed = CreateRouteRuleRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const created = await prisma.creatorRouteRule.create({
      data: {
        creatorId: d.creatorId,
        socialAccountId: d.socialAccountId,
        minComplianceScore: d.minComplianceScore,
        captionTemplate: d.captionTemplate,
        hashtagsJson: JSON.stringify(d.hashtags),
        enabled: d.enabled,
      },
      include: { creator: true, socialAccount: true },
    });
    await logAudit('CREATOR_ROUTE_LINKED', 'CreatorRouteRule', created.id, {
      creatorId: d.creatorId,
      socialAccountId: d.socialAccountId,
    });
    return reply.status(201).send({
      success: true,
      data: { ...created, hashtags: d.hashtags },
    });
  });

  // 4. End-to-End Stream Ingest -> Compliance -> Captions & SFX -> Auto-Routing to Linked Accounts
  app.get('/api/v1/clips', async () => {
    const clips = await prisma.clipJob.findMany({
      include: {
        creator: true,
        publishPosts: { include: { socialAccount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      data: clips.map((c) => ({
        ...c,
        sfxCues: JSON.parse(c.sfxCuesJson),
        complianceReport: JSON.parse(c.complianceReportJson),
      })),
    };
  });

  app.post('/api/v1/clips/ingest', async (request, reply) => {
    const parsed = IngestStreamRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const creator = await prisma.creatorAccount.findUnique({
      where: { id: d.creatorId },
      include: { routes: { where: { enabled: true }, include: { socialAccount: true } } },
    });
    if (!creator) {
      return reply.status(404).send({ success: false, error: 'Creator account not found' });
    }

    const durationSec = Math.max(1, Math.round((d.endSec - d.startSec) * 100) / 100);
    const transcript =
      d.transcriptText?.trim() ||
      `${creator.displayName} highlight from ${d.sourceUrl} (${d.startSec}s-${d.endSec}s).`;
    const title = d.title?.trim() || `${creator.displayName} — Viral Clip`;
    const requiredTopics = JSON.parse(creator.requiredTopicsJson) as string[];
    const bannedKeywords = JSON.parse(creator.bannedKeywordsJson) as string[];
    const tags = JSON.parse(creator.tagsJson) as string[];

    const compliance = evaluateClipCompliance({
      transcript,
      caption: title,
      requiredTopics,
      bannedKeywords,
      disallowLogos: creator.disallowLogos,
      hasAddedLogos: false, // Pipeline strictly renders zero added logos
    });

    const layout = d.layout ?? (creator.defaultLayout as 'SPLIT_FACECAM_BOTTOM' | 'CENTER_CROP_9_16');
    const captionStyle =
      d.captionStyle ??
      (creator.defaultCaptionStyle as
        | 'HIGH_ENERGY'
        | 'BOLD_CREATOR'
        | 'CLEAN_MINIMAL'
        | 'PODCAST_PREMIUM');
    const enableSfx = d.enableSfx ?? creator.enableSfx;

    const speechCues = alignTranscriptToSpeechWindows(transcript, [
      { startSec: 0.1, endSec: Math.min(durationSec, durationSec * 0.45) },
      { startSec: Math.min(durationSec, durationSec * 0.48), endSec: durationSec },
    ]);
    const assScript = buildWordSyncedAss(speechCues, captionStyle);
    const sfxCues = enableSfx ? buildAutoSfxCuesForCuts([durationSec * 0.45, durationSec * 0.55]) : [];

    const clipJob = await prisma.clipJob.create({
      data: {
        creatorId: creator.id,
        sourceUrl: d.sourceUrl,
        title,
        startSec: d.startSec,
        endSec: d.endSec,
        durationSec,
        transcript,
        layout,
        captionStyle,
        enableSfx,
        sfxCuesJson: JSON.stringify(sfxCues),
        assScript,
        compliancePassed: compliance.passed,
        complianceScore: compliance.score,
        complianceReportJson: JSON.stringify(compliance),
        approvalStatus: compliance.passed ? 'AWAITING_APPROVAL' : 'DISQUALIFIED',
      },
    });

    // Automatically route compliant clips to every linked Clipping Social Account
    const routedPosts = [];
    if (compliance.passed) {
      for (const route of creator.routes) {
        if (compliance.score < route.minComplianceScore) continue;
        const routeTags = JSON.parse(route.hashtagsJson) as string[];
        const tagLine = [...tags, ...routeTags]
          .map((t) => (t.startsWith('#') ? t : `#${t.replace(/\s+/g, '')}`))
          .join(' ');
        const captionText = route.captionTemplate
          .replace('{hook}', title)
          .replace('{tags}', tagLine)
          .trim();

        const post = await prisma.publishPost.create({
          data: {
            clipJobId: clipJob.id,
            socialAccountId: route.socialAccountId,
            idempotencyKey: `clip-${clipJob.id}-acct-${route.socialAccountId}`,
            platform: route.socialAccount.platform,
            captionText,
            status: 'AWAITING_APPROVAL',
            executionMode: route.socialAccount.integrationMode,
          },
        });

        // Opt-in auto-publish ONLY when account explicitly enabled autoPublishApproved
        if (route.socialAccount.autoPublishApproved) {
          const published = await executePublishPost(post.id);
          if (published) routedPosts.push(published);
        } else {
          routedPosts.push(post);
        }
      }
    }

    await logAudit('CLIP_INGESTED_AND_ROUTED', 'ClipJob', clipJob.id, {
      creatorHandle: creator.handle,
      compliancePassed: compliance.passed,
      complianceScore: compliance.score,
      routedCount: routedPosts.length,
    });

    return reply.status(201).send({
      success: true,
      data: {
        clip: {
          ...clipJob,
          sfxCues,
          complianceReport: compliance,
        },
        routedPosts,
      },
    });
  });

  // 5. Human Approval Gate for Clips -> Releases AWAITING_APPROVAL posts to linked accounts
  app.post('/api/v1/clips/:clipId/decision', async (request, reply) => {
    const { clipId } = request.params as { clipId: string };
    const parsed = ClipDecisionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() });
    }

    const clip = await prisma.clipJob.findUnique({
      where: { id: clipId },
      include: { publishPosts: true },
    });
    if (!clip) {
      return reply.status(404).send({ success: false, error: 'Clip not found' });
    }
    if (!clip.compliancePassed && parsed.data.decision === 'APPROVED') {
      return reply.status(400).send({
        success: false,
        error: 'Cannot approve a clip that failed Creator Campaign Compliance Gate.',
      });
    }

    const updatedClip = await prisma.clipJob.update({
      where: { id: clip.id },
      data: {
        approvalStatus: parsed.data.decision,
        approvedAt: parsed.data.decision === 'APPROVED' ? new Date() : null,
      },
    });

    const publishedPosts = [];
    if (parsed.data.decision === 'APPROVED') {
      for (const post of clip.publishPosts) {
        if (post.status === 'AWAITING_APPROVAL') {
          const pub = await executePublishPost(post.id);
          if (pub) publishedPosts.push(pub);
        }
      }
    } else {
      await prisma.publishPost.updateMany({
        where: { clipJobId: clip.id, status: 'AWAITING_APPROVAL' },
        data: { status: 'BLOCKED', errorMessage: 'Clip rejected by human reviewer.' },
      });
    }

    return {
      success: true,
      data: { clip: updatedClip, publishedPosts },
    };
  });

  // 6. Publish Queue & Idempotent Manual Publish
  app.get('/api/v1/publish-queue', async () => {
    const posts = await prisma.publishPost.findMany({
      include: { clipJob: { include: { creator: true } }, socialAccount: true },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: posts };
  });

  app.post('/api/v1/publish-queue/:postId/publish', async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const res = await executePublishPost(postId);
    if (!res) return reply.status(404).send({ success: false, error: 'Post not found' });
    return { success: true, data: res };
  });

  return app;
}
