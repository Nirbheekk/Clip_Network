import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { CaptionStyleId, LayoutMode } from '@clip-network/shared';
import { buildAutoSfxCuesForCuts, buildSfxMixFilterGraph, type SfxCue } from './sfx-engine.js';
import { buildWordSyncedAss, type TimedSpeechCue } from './caption-engine.js';

export interface RenderVerticalClipOptions {
  sourceVideoPath: string;
  outputMp4Path: string;
  segments: ReadonlyArray<{ startSec: number; endSec: number }>;
  cues: readonly TimedSpeechCue[];
  layout: LayoutMode;
  captionStyle: CaptionStyleId;
  enableSfx: boolean;
  sfxCues?: readonly SfxCue[] | undefined;
  facecamCrop?: { x: number; y: number; width: number; height: number } | undefined;
}

export interface RenderedClipMetadata {
  outputMp4Path: string;
  durationSec: number;
  sizeBytes: number;
  sfxAppliedCount: number;
  captionCueCount: number;
}

/**
 * Renders a 1080x1920 (9:16) vertical short with zero added logos, word-synced ASS karaoke
 * captions, optional split-screen facecam layout, procedural SFX, and -14 LUFS loudnorm.
 */
export function renderVerticalShortWithSfx(
  opts: RenderVerticalClipOptions,
): RenderedClipMetadata {
  const outDir = path.dirname(opts.outputMp4Path);
  fs.mkdirSync(outDir, { recursive: true });

  const assPath = opts.outputMp4Path.replace(/\.mp4$/i, '.ass');
  const assContent = buildWordSyncedAss(opts.cues, opts.captionStyle);
  fs.writeFileSync(assPath, assContent, 'utf8');

  const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const filterParts: string[] = [];
  const concatInputs: string[] = [];

  opts.segments.forEach((seg, idx) => {
    filterParts.push(`[0:v]trim=start=${seg.startSec}:end=${seg.endSec},setpts=PTS-STARTPTS[v${idx}]`);
    filterParts.push(`[0:a]atrim=start=${seg.startSec}:end=${seg.endSec},asetpts=PTS-STARTPTS[a${idx}]`);
    concatInputs.push(`[v${idx}][a${idx}]`);
  });

  filterParts.push(`${concatInputs.join('')}concat=n=${opts.segments.length}:v=1:a=1[vc][ac]`);

  if (opts.layout === 'SPLIT_FACECAM_BOTTOM') {
    const fc = opts.facecamCrop ?? { x: 0, y: 0, width: 494, height: 278 };
    filterParts.push('[vc]split=2[vtop_in][vbot_in]');
    filterParts.push('[vtop_in]crop=1012:1080:454:0,scale=1080:1152:flags=lanczos[vtop]');
    filterParts.push(
      `[vbot_in]crop=${fc.width}:${fc.height}:${fc.x}:${fc.y},scale=1080:768:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:768[vbot]`,
    );
    filterParts.push(`[vtop][vbot]vstack=inputs=2,fps=30,ass='${escapedAss}'[vout]`);
  } else {
    filterParts.push(
      `[vc]scale=-2:1920:flags=lanczos,crop=1080:1920:(iw-1080)/2:0,fps=30,ass='${escapedAss}'[vout]`,
    );
  }

  const durations = opts.segments.map((s) => Math.max(0.1, s.endSec - s.startSec));
  const cuesToMix = opts.enableSfx ? (opts.sfxCues ?? buildAutoSfxCuesForCuts(durations)) : [];
  const sfxGraph = buildSfxMixFilterGraph({
    cues: cuesToMix,
    baseAudioLabel: 'ac',
    outputLabel: 'aout',
  });
  filterParts.push(...sfxGraph.filterParts);

  const res = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i', opts.sourceVideoPath,
      '-filter_complex', filterParts.join(';'),
      '-map', '[vout]',
      '-map', `[${sfxGraph.outputLabel}]`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-movflags', '+faststart',
      opts.outputMp4Path,
    ],
    { stdio: 'pipe' },
  );

  if (res.status !== 0) {
    throw new Error(`FFmpeg render failed: ${res.stderr.toString().slice(-600)}`);
  }

  const stat = fs.statSync(opts.outputMp4Path);
  const totalDur = Math.round(durations.reduce((a, b) => a + b, 0) * 100) / 100;

  return {
    outputMp4Path: opts.outputMp4Path,
    durationSec: totalDur,
    sizeBytes: stat.size,
    sfxAppliedCount: sfxGraph.appliedCueCount,
    captionCueCount: opts.cues.length,
  };
}
