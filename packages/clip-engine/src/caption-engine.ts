import type { CaptionStyleId } from '@clip-network/shared';

export interface TimedSpeechCue {
  startSec: number;
  endSec: number;
  text: string;
}

interface AssStyleConfig {
  fontName: string;
  fontSize: number;
  primaryColour: string;
  secondaryColour: string;
  outlinePx: number;
  marginV: number;
  uppercase: boolean;
  maxWordsPerLine: number;
}

const CAPTION_STYLES: Readonly<Record<CaptionStyleId, AssStyleConfig>> = {
  HIGH_ENERGY: {
    fontName: 'DejaVu Sans',
    fontSize: 60,
    primaryColour: '&H0000E6FF',
    secondaryColour: '&H00FFFFFF',
    outlinePx: 7,
    marginV: 740,
    uppercase: true,
    maxWordsPerLine: 4,
  },
  BOLD_CREATOR: {
    fontName: 'DejaVu Sans',
    fontSize: 58,
    primaryColour: '&H0000E6FF',
    secondaryColour: '&H00FFFFFF',
    outlinePx: 6,
    marginV: 310,
    uppercase: true,
    maxWordsPerLine: 4,
  },
  CLEAN_MINIMAL: {
    fontName: 'DejaVu Sans',
    fontSize: 48,
    primaryColour: '&H00FFFFFF',
    secondaryColour: '&H00E4E4E7',
    outlinePx: 3,
    marginV: 250,
    uppercase: false,
    maxWordsPerLine: 5,
  },
  PODCAST_PREMIUM: {
    fontName: 'DejaVu Sans',
    fontSize: 52,
    primaryColour: '&H000B9EF5',
    secondaryColour: '&H00FAF9F6',
    outlinePx: 4,
    marginV: 270,
    uppercase: false,
    maxWordsPerLine: 5,
  },
};

function fmtAssTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.floor((clamped - Math.floor(clamped)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function buildWordSyncedAss(
  cues: readonly TimedSpeechCue[],
  styleId: CaptionStyleId = 'HIGH_ENERGY',
): string {
  const cfg = CAPTION_STYLES[styleId];
  const lines = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ClipCaption,${cfg.fontName},${cfg.fontSize},${cfg.primaryColour},${cfg.secondaryColour},&H00000000,&HB0000000,-1,0,0,0,100,100,0,0,1,${cfg.outlinePx},3,2,64,64,${cfg.marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  for (const cue of cues) {
    if (cue.endSec <= cue.startSec || !cue.text.trim()) continue;
    const raw = cfg.uppercase ? cue.text.trim().toUpperCase() : cue.text.trim();
    const words = raw.split(/\s+/).filter(Boolean);
    const wrapped: string[][] = [];
    for (let i = 0; i < words.length && wrapped.length < 2; i += cfg.maxWordsPerLine) {
      wrapped.push(words.slice(i, i + cfg.maxWordsPerLine));
    }
    const wordCount = wrapped.reduce((acc, w) => acc + w.length, 0);
    const totalCs = Math.max(10, Math.round((cue.endSec - cue.startSec) * 100));
    const perWordCs = Math.max(4, Math.floor(totalCs / Math.max(1, wordCount)));
    const body = wrapped
      .map((line) =>
        line.map((w) => `{\\kf${perWordCs}}${w.replace(/[{}]/g, '')}`).join(' '),
      )
      .join('\\N');
    lines.push(
      `Dialogue: 0,${fmtAssTime(cue.startSec)},${fmtAssTime(cue.endSec)},ClipCaption,,0,0,0,,${body}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Splits a plain transcript across detected speech intervals so captions track actual voice onset.
 */
export function alignTranscriptToSpeechWindows(
  transcript: string,
  speechWindows: ReadonlyArray<{ startSec: number; endSec: number }>,
): TimedSpeechCue[] {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0 || speechWindows.length === 0) return [];

  const cues: TimedSpeechCue[] = [];
  for (let i = 0; i < speechWindows.length; i += 1) {
    const win = speechWindows[i]!;
    const text = sentences[Math.min(i, sentences.length - 1)]!;
    if (win.endSec > win.startSec + 0.1) {
      cues.push({ startSec: win.startSec, endSec: win.endSec, text });
    }
  }
  return cues;
}
