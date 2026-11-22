import type { PrismaClient } from '@prisma/client';

export interface ParsedFeedVideo {
  externalVideoId: string;
  title: string;
  videoUrl: string;
  publishedAt: Date;
}

/**
 * Parses the latest video entry from a public YouTube Atom XML feed.
 */
export function parseYouTubeAtomLatestVideo(xml: string): ParsedFeedVideo | null {
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
  if (!entryMatch?.[1]) return null;
  const entry = entryMatch[1];
  const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1]?.trim();
  const title = entry.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  const published = entry.match(/<published>([^<]+)<\/published>/i)?.[1]?.trim();
  if (!videoId || !title) return null;
  return {
    externalVideoId: videoId,
    title,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: published ? new Date(published) : new Date(),
  };
}

export async function tryFetchYouTubeChannelLatest(channelUrl: string): Promise<ParsedFeedVideo | null> {
  const match = channelUrl.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i);
  if (!match?.[1]) return null;
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${match[1]}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(feedUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const xml = await res.text();
    return parseYouTubeAtomLatestVideo(xml);
  } catch {
    return null;
  }
}

/**
 * Starts a safe, non-overlapping background channel monitor interval.
 * Disabled automatically when NODE_ENV === 'test' or CHANNEL_MONITOR_INTERVAL_MS === '0'.
 */
export function startBackgroundMonitorScheduler(
  prisma: PrismaClient,
  onTickWorkspace: (workspaceId: string) => Promise<void>,
): () => void {
  if (process.env['NODE_ENV'] === 'test') return () => {};
  const intervalMs = Number(process.env['CHANNEL_MONITOR_INTERVAL_MS'] ?? 300_000);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return () => {};

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const workspaces = await prisma.workspace.findMany({
        where: { creators: { some: { autoMonitorEnabled: true } } },
        select: { id: true },
      });
      for (const ws of workspaces) {
        await onTickWorkspace(ws.id);
      }
    } catch {
      // Never crash API process on background poll transient error
    } finally {
      running = false;
    }
  }, Math.max(30_000, intervalMs));

  timer.unref();
  return () => clearInterval(timer);
}
