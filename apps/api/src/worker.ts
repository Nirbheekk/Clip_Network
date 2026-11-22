import { PrismaClient } from '@prisma/client';
import { startBackgroundMonitorScheduler } from './integrations/scheduler.js';
import { scanWorkspaceChannels } from './services/channel-monitor.js';
import { dispatchSocialPublish } from './integrations/publishing.js';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function publishPostInWorker(postId: string, workspaceId: string) {
  const post = await prisma.publishPost.findFirst({
    where: { id: postId, workspaceId },
    include: { clipJob: true, socialAccount: true },
  });
  if (!post || !post.clipJob.compliancePassed) return null;
  if (post.status === 'PUBLISHED_SANDBOX' || post.status === 'PUBLISHED_LIVE') return post;

  const dispatch = await dispatchSocialPublish({
    platform: post.platform,
    accountHandle: post.socialAccount.accountHandle,
    encryptedToken: post.socialAccount.encryptedToken,
    captionText: post.captionText,
    idempotencyKey: post.idempotencyKey,
    mediaUrl: post.clipJob.outputMp4Path,
    durationSec: post.clipJob.durationSec,
  });

  if (!dispatch.success) {
    return prisma.publishPost.update({
      where: { id: post.id },
      data: {
        status: 'FAILED',
        executionMode: dispatch.executionMode,
        errorMessage: dispatch.errorMessage ?? 'Worker publish failed.',
      },
    });
  }

  return prisma.publishPost.update({
    where: { id: post.id },
    data: {
      status: dispatch.status,
      executionMode: dispatch.executionMode,
      externalPostId: dispatch.externalPostId ?? `worker-${randomUUID().slice(0, 8)}`,
      publishedAt: new Date(),
      errorMessage: null,
    },
  });
}

console.log(
  JSON.stringify({
    level: 'info',
    service: '@clip-network/worker',
    event: 'WORKER_STARTED',
    intervalMs: Number(process.env['CHANNEL_MONITOR_INTERVAL_MS'] ?? 300_000),
  }),
);

const stop = startBackgroundMonitorScheduler(prisma, async (workspaceId) => {
  const result = await scanWorkspaceChannels({
    prisma,
    workspaceId,
    autoExecute: true,
    executePublishPost: publishPostInWorker,
  });
  if (result) {
    console.log(
      JSON.stringify({
        level: 'info',
        service: '@clip-network/worker',
        event: 'WORKSPACE_SCAN_TICK',
        workspaceId,
        creatorsScanned: result.creatorsScanned,
        clipsCreated: result.clipsCreated,
        postsRouted: result.postsRouted,
      }),
    );
  }
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: 'info', service: '@clip-network/worker', event: 'SHUTDOWN', signal }));
  stop();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
