import type { SfxPresetId } from '@clip-network/shared';

export interface SfxPresetSpec {
  id: SfxPresetId;
  label: string;
  durationSec: number;
  defaultGainDb: number;
  useCase: string;
  lavfiExpr: string;
}

export interface SfxCue {
  preset: SfxPresetId;
  atSec: number;
  gainDb?: number | undefined;
}

export const SFX_PRESETS: Readonly<Record<SfxPresetId, SfxPresetSpec>> = {
  WHOOSH: {
    id: 'WHOOSH',
    label: 'Transition Whoosh',
    durationSec: 0.35,
    defaultGainDb: -10,
    useCase: 'Fast scene cut or transition',
    lavfiExpr:
      'anoisesrc=color=pink:duration=0.35:sample_rate=48000,bandpass=f=900:width_type=h:w=1400,afade=t=in:st=0:d=0.12,afade=t=out:st=0.16:d=0.19',
  },
  POP: {
    id: 'POP',
    label: 'Hook Pop',
    durationSec: 0.14,
    defaultGainDb: -11,
    useCase: 'Opening hook or caption emphasis',
    lavfiExpr:
      'sine=frequency=520:duration=0.14:sample_rate=48000,asetrate=48000*1.25,aresample=48000,afade=t=in:st=0:d=0.01,afade=t=out:st=0.03:d=0.10',
  },
  RISER: {
    id: 'RISER',
    label: 'Tension Riser',
    durationSec: 1.2,
    defaultGainDb: -12,
    useCase: 'Build-up right before reveal',
    lavfiExpr:
      'anoisesrc=color=white:duration=1.2:sample_rate=48000,highpass=f=600,lowpass=f=3200,afade=t=in:st=0:d=1.05:curve=exp,afade=t=out:st=1.10:d=0.10',
  },
  BOOM: {
    id: 'BOOM',
    label: 'Sub Impact Boom',
    durationSec: 0.65,
    defaultGainDb: -9,
    useCase: 'Punchline or dramatic reveal landing',
    lavfiExpr:
      'sine=frequency=68:duration=0.65:sample_rate=48000,afade=t=in:st=0:d=0.015,afade=t=out:st=0.08:d=0.57:curve=exp',
  },
  CHIME: {
    id: 'CHIME',
    label: 'Insight Chime',
    durationSec: 0.45,
    defaultGainDb: -13,
    useCase: 'Key callout or tip',
    lavfiExpr:
      'sine=frequency=1046:duration=0.45:sample_rate=48000,afade=t=in:st=0:d=0.01,afade=t=out:st=0.06:d=0.39:curve=exp',
  },
  GLITCH: {
    id: 'GLITCH',
    label: 'Digital Glitch',
    durationSec: 0.22,
    defaultGainDb: -11,
    useCase: 'Comedic cut or gaming roast beat',
    lavfiExpr:
      'anoisesrc=color=white:duration=0.22:sample_rate=48000,bandpass=f=2200:width_type=h:w=1800,tremolo=f=38:d=0.9,afade=t=out:st=0.12:d=0.10',
  },
};

export function buildSfxMixFilterGraph(params: {
  cues: readonly SfxCue[];
  baseAudioLabel?: string | undefined;
  outputLabel?: string | undefined;
}): { filterParts: string[]; outputLabel: string; appliedCueCount: number } {
  const baseLabel = params.baseAudioLabel ?? 'ac';
  const outLabel = params.outputLabel ?? 'aout';
  const valid = params.cues
    .filter((c) => Number.isFinite(c.atSec) && c.atSec >= 0)
    .sort((a, b) => a.atSec - b.atSec);

  if (valid.length === 0) {
    return {
      filterParts: [`[${baseLabel}]loudnorm=I=-14:TP=-1.5:LRA=11[${outLabel}]`],
      outputLabel: outLabel,
      appliedCueCount: 0,
    };
  }

  const filterParts: string[] = [];
  const mixInputs: string[] = [`[${baseLabel}]`];

  valid.forEach((cue, idx) => {
    const spec = SFX_PRESETS[cue.preset];
    const delayMs = Math.max(0, Math.round(cue.atSec * 1000));
    const gainDb = cue.gainDb ?? spec.defaultGainDb;
    const label = `sfx_${idx}`;
    filterParts.push(
      `${spec.lavfiExpr},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=${gainDb}dB,adelay=${delayMs}|${delayMs}[${label}]`,
    );
    mixInputs.push(`[${label}]`);
  });

  filterParts.push(
    `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=0:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[${outLabel}]`,
  );

  return { filterParts, outputLabel: outLabel, appliedCueCount: valid.length };
}

export function buildAutoSfxCuesForCuts(segmentDurationsSec: readonly number[]): SfxCue[] {
  const cues: SfxCue[] = [{ preset: 'POP', atSec: 0.1 }];
  let cursor = 0;
  for (let i = 0; i < segmentDurationsSec.length - 1; i += 1) {
    cursor += segmentDurationsSec[i] ?? 0;
    cues.push({
      preset: i % 2 === 0 ? 'WHOOSH' : 'GLITCH',
      atSec: Math.max(0, Math.round((cursor - 0.1) * 100) / 100),
    });
  }
  const total = segmentDurationsSec.reduce((a, b) => a + b, 0);
  if (total >= 10) {
    cues.push({ preset: 'BOOM', atSec: Math.round(total * 0.78 * 100) / 100 });
  }
  return cues;
}
