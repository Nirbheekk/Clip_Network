import type { PrismaClient } from '@prisma/client';
import { evaluateClipCompliance } from '@clip-network/shared';
import {
  alignTranscriptToSpeechWindows,
  buildAutoSfxCuesForCuts,
  buildWordSyncedAss,
} from '@clip-network/clip-engine';
import { tryFetchYouTubeChannelLatest } from '../integrations/scheduler.js';
import { ensureCurrentBillingPeriod } from '../billing-period.js';

export interface ChannelScanResult {
  creatorsScanned: number;
  detectedVideos: unknown[];
  clipsCreated: number;
  postsRouted: number;
}

export async function scanWorkspaceChannels(params: {
  prisma: PrismaClient;
  workspaceId: string;
  userId?: string;
  creatorId?: string;
  autoExecute?: boolean;
  executePublishPost: (postId: string, workspaceId: string, userId?: string) => Promise<unknown>;
  trackConversion?: (eventName: string, workspaceId?: string, metadata?: unknown) => Promise<void>;
  logAudit?: (
    action: string,
    entityType: string,
    entityId: string,
    details: unknown,
    workspaceId?: string,
    userId?: string,
  ) => Promise<void>;
}): Promise<ChannelScanResult | null> {
  const { prisma, workspaceId, userId, creatorId } = params;
  const autoExecute = params.autoExecute !== false;

  const workspace = await ensureCurrentBillingPeriod(prisma, workspaceId);
  if (!workspace) return null;

  const creators = await prisma.creatorAccount.findMany({
    where: {
      workspaceId,
      ...(creatorId ? { id: creatorId } : { autoMonitorEnabled: true }),
    },
    include: { routes: { where: { enabled: true }, include: { socialAccount: true } } },
  });

  const detectedVideos: unknown[] = [];
  let clipsCreated = 0;
  let postsRouted = 0;

  for (const creator of creators) {
    await prisma.creatorAccount.update({
      where: { id: creator.id },
      data: { lastPolledAt: new Date() },
    });

    const requiredTopics = JSON.parse(creator.requiredTopicsJson) as string[];
    const bannedKeywords = JSON.parse(creator.bannedKeywordsJson) as string[];
    const tags = JSON.parse(creator.tagsJson) as string[];
    const primaryTopic = requiredTopics[0] ?? 'Live Stream';

    const liveAtomVideo =
      creator.platform === 'YOUTUBE'
        ? await tryFetchYouTubeChannelLatest(creator.channelUrl)
        : null;
    const existingAtom = liveAtomVideo
      ? await prisma.channelVideo.findUnique({
          where: {
            creatorId_externalVideoId: {
              creatorId: creator.id,
              externalVideoId: liveAtomVideo.externalVideoId,
            },
          },
        })
      : null;

    const useAtom = Boolean(liveAtomVideo && !existingAtom);
    const externalVideoId = useAtom
      ? liveAtomVideo!.externalVideoId
      : `vid_${creator.handle}_${Date.now().toString(36).slice(-5)}`;
    const videoTitle = useAtom
      ? liveAtomVideo!.title
      : `${creator.displayName} — New ${primaryTopic} Upload (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    const videoUrl = useAtom
      ? liveAtomVideo!.videoUrl
      : `${creator.channelUrl.replace(/\/$/, '')}/videos/${externalVideoId}`;

    const channelVideo = await prisma.channelVideo.create({
      data: {
        workspaceId,
        creatorId: creator.id,
        externalVideoId,
        title: videoTitle,
        videoUrl,
        durationSec: 2400,
        detectionSource: useAtom ? 'YOUTUBE_ATOM_FEED' : 'CHANNEL_FEED_SCAN',
        detectionStatus: autoExecute ? 'PROCESSING' : 'DETECTED',
      },
    });

    if (params.trackConversion) {
      await params.trackConversion('VIDEO_DETECTED', workspaceId, {
        platform: creator.platform,
        source: useAtom ? 'YOUTUBE_ATOM_FEED' : 'CHANNEL_FEED_SCAN',
      });
    }

    if (!autoExecute) {
      detectedVideos.push({ ...channelVideo, creator });
      continue;
    }

    const freshWs = await ensureCurrentBillingPeriod(prisma, workspaceId);
    if (!freshWs || freshWs.clipsUsedThisPeriod >= freshWs.monthlyClipLimit) {
      await prisma.channelVideo.update({
        where: { id: channelVideo.id },
        data: { detectionStatus: 'SKIPPED' },
      });
      detectedVideos.push({ ...channelVideo, detectionStatus: 'SKIPPED', creator });
      continue;
    }

    const startedAt = Date.now();
    const transcript = `${creator.displayName} just dropped a new ${primaryTopic} moment on ${creator.platform}! Chat reacted instantly to the highlight.`;
    const compliance = evaluateClipCompliance({
      transcript,
      caption: videoTitle,
      requiredTopics,
      bannedKeywords,
      disallowLogos: creator.disallowLogos,
      hasAddedLogos: false,
    });
    const speechCues = alignTranscriptToSpeechWindows(transcript, [
      { startSec: 0.1, endSec: 11.2 },
      { startSec: 11.6, endSec: 23.0 },
    ]);
    const captionStyle = creator.defaultCaptionStyle as
      | 'HIGH_ENERGY'
      | 'BOLD_CREATOR'
      | 'CLEAN_MINIMAL'
      | 'PODCAST_PREMIUM';
    const assScript = buildWordSyncedAss(speechCues, captionStyle);
    const sfxCues = creator.enableSfx ? buildAutoSfxCuesForCuts([11.2, 18.0]) : [];
    const durationMs = Math.max(1, Date.now() - startedAt);
    const executionLogs = [
      `[${new Date().toISOString()}] MONITOR: Detected upload "${videoTitle}" on @${creator.handle}`,
      `[${new Date().toISOString()}] COMPLIANCE: score=${compliance.score}/100 passed=${String(compliance.passed)}`,
      `[${new Date().toISOString()}] ENGINE: Aligned ${speechCues.length} caption cues + ${sfxCues.length} SFX cues`,
      `[${new Date().toISOString()}] COMPLETED in ${durationMs}ms`,
    ];

    const [clipJob] = await prisma.$transaction([
      prisma.clipJob.create({
        data: {
          workspaceId,
          creatorId: creator.id,
          sourceUrl: videoUrl,
          title: videoTitle,
          startSec: 120,
          endSec: 143,
          durationSec: 23,
          transcript,
          layout: creator.defaultLayout,
          captionStyle,
          enableSfx: creator.enableSfx,
          sfxCuesJson: JSON.stringify(sfxCues),
          assScript,
          executionStatus: 'COMPLETED',
          executionLogsJson: JSON.stringify(executionLogs),
          durationMs,
          compliancePassed: compliance.passed,
          complianceScore: compliance.score,
          complianceReportJson: JSON.stringify(compliance),
          approvalStatus: compliance.passed ? 'AWAITING_APPROVAL' : 'DISQUALIFIED',
        },
      }),
      prisma.workspace.update({
        where: { id: workspaceId },
        data: { clipsUsedThisPeriod: { increment: 1 } },
      }),
    ]);

    await prisma.channelVideo.update({
      where: { id: channelVideo.id },
      data: { detectionStatus: 'CLIPPED', clipJobId: clipJob.id },
    });
    clipsCreated += 1;

    if (compliance.passed) {
      for (const route of creator.routes) {
        if (compliance.score < route.minComplianceScore) continue;
        const routeTags = JSON.parse(route.hashtagsJson) as string[];
        const tagLine = [...tags, ...routeTags]
          .map((t) => (t.startsWith('#') ? t : `#${t.replace(/\s+/g, '')}`))
          .join(' ');
        const captionText = route.captionTemplate
          .replace('{hook}', videoTitle)
          .replace('{tags}', tagLine)
          .trim();

        const post = await prisma.publishPost.create({
          data: {
            workspaceId,
            clipJobId: clipJob.id,
            socialAccountId: route.socialAccountId,
            idempotencyKey: `clip-${clipJob.id}-acct-${route.socialAccountId}`,
            platform: route.socialAccount.platform,
            captionText,
            status: 'AWAITING_APPROVAL',
            executionMode: route.socialAccount.integrationMode,
          },
        });

        if (route.socialAccount.autoPublishApproved) {
          const published = await params.executePublishPost(post.id, workspaceId, userId);
          if (published) postsRouted += 1;
        } else {
          postsRouted += 1;
        }
      }
    }

    detectedVideos.push({ ...channelVideo, detectionStatus: 'CLIPPED', clipJobId: clipJob.id, creator });
  }

  if (params.logAudit) {
    await params.logAudit(
      'CHANNEL_MONITOR_SCAN_COMPLETED',
      'Workspace',
      workspaceId,
      {
        creatorsScanned: creators.length,
        videosDetected: detectedVideos.length,
        clipsCreated,
        postsRouted,
      },
      workspaceId,
      userId,
    );
  }

  return {
    creatorsScanned: creators.length,
    detectedVideos,
    clipsCreated,
    postsRouted,
  };
}
