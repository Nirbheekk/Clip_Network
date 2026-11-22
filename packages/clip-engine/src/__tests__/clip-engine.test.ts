import { describe, expect, it } from 'vitest';
import { evaluateClipCompliance } from '@clip-network/shared';
import {
  alignTranscriptToSpeechWindows,
  buildAutoSfxCuesForCuts,
  buildSfxMixFilterGraph,
  buildWordSyncedAss,
  SFX_PRESETS,
} from '../index.js';

describe('@clip-network/clip-engine', () => {
  it('generates word-synced ASS karaoke scripts and procedural SFX filter graphs', () => {
    expect(Object.keys(SFX_PRESETS)).toHaveLength(6);
    const cues = alignTranscriptToSpeechWindows(
      'Here we go chat! My clipping campaign got 30 million views yesterday.',
      [
        { startSec: 0.1, endSec: 1.4 },
        { startSec: 2.0, endSec: 5.5 },
      ],
    );
    expect(cues).toHaveLength(2);

    const ass = buildWordSyncedAss(cues, 'HIGH_ENERGY');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('\\kf');

    const sfxCues = buildAutoSfxCuesForCuts([4.5, 6.2, 8.0]);
    const graph = buildSfxMixFilterGraph({ cues: sfxCues });
    expect(graph.appliedCueCount).toBe(sfxCues.length);
    expect(graph.filterParts.join(';')).toContain('loudnorm=I=-14:TP=-1.5:LRA=11[aout]');
  });

  it('enforces creator campaign requirements and disqualifies logos or low-value clickbait', () => {
    const pass = evaluateClipCompliance({
      transcript: 'We used the Microsoft Surface Laptop Ultra on Curry Barker film set.',
      caption: 'Stokes Twins rewrite the script on Curry Barker set.',
      requiredTopics: ['Microsoft', 'Curry Barker', 'Stokes Twins'],
      bannedKeywords: ['giveaway scam'],
      disallowLogos: true,
      hasAddedLogos: false,
    });
    expect(pass.passed).toBe(true);
    expect(pass.matchedTopics).toHaveLength(3);

    const fail = evaluateClipCompliance({
      transcript: 'Random unrelated gaming moment.',
      caption: "I CAN'T BELIEVE THAT HAPPENED!",
      requiredTopics: ['Microsoft', 'Curry Barker'],
      bannedKeywords: [],
      disallowLogos: true,
      hasAddedLogos: true,
    });
    expect(fail.passed).toBe(false);
    expect(fail.disqualifiersTriggered).toContain('LOGO_DETECTED');
    expect(fail.disqualifiersTriggered).toContain('LOW_VALUE_CLICKBAIT');
    expect(fail.disqualifiersTriggered).toContain('MISSING_REQUIRED_TOPIC');
  });
});
