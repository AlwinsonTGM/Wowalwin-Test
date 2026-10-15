import { showConfig } from '../content/show.ts';

/** The sounds this show has. Bokya's own arrives with the finale (ticket 05). */
export type Cue = keyof typeof showConfig.audio;

export type AudioLike = { play: () => Promise<void> | void };

/** The device the show talks to. Injected so tests need no sound hardware. */
export type CreateAudio = (src: string) => AudioLike;

export type Sound = {
  play: (cue: Cue) => void;
  setMuted: (muted: boolean) => void;
};

/**
 * What a change of state causes to be heard.
 *
 * Nothing here takes an operator's action as an input, only two states. That is
 * the whole of the rule in the spec — a sound is a consequence of the show
 * having moved — and it is why pressing the reveal twice cannot sting twice,
 * and a Backbone that reloads cannot replay the reveal.
 */
export function cuesBetween(
  before: { phase: string; finale?: { revealed: boolean; drawnPrizeId: string | null } | null },
  after: { phase: string; finale?: { revealed: boolean; drawnPrizeId: string | null } | null },
): Cue[] {
  const cues: Cue[] = [];

  if (after.phase === 'answering' && before.phase !== 'answering') cues.push('tick');
  if (after.phase === 'revealPending' && before.phase !== 'revealPending') cues.push('sting');
  if (after.phase === 'revealed' && before.phase !== 'revealed') cues.push('reveal');

  if (after.finale?.revealed && !before.finale?.revealed) {
    if (after.finale.drawnPrizeId === 'bokya') {
      cues.push('bokya');
    } else {
      cues.push('reveal');
    }
  }

  return cues;
}

/**
 * The only place the show touches a sound device.
 *
 * A missing or unreadable file is a failure here and nowhere else: it is
 * reported to the Presenter so a silent show is a known fact rather than a
 * mystery, and it never throws, because the reveal is not waiting on audio.
 */
export function createSound({
  createAudio = (src) => new Audio(src),
  onFailure = () => {},
}: {
  createAudio?: CreateAudio;
  onFailure?: (cue: Cue, file: string) => void;
} = {}): Sound {
  let muted = false;
  const ports = new Map<Cue, AudioLike>();

  return {
    play(cue) {
      if (muted) return;

      const file = showConfig.audio[cue];
      try {
        let port = ports.get(cue);
        if (!port) {
          port = createAudio(file);
          ports.set(cue, port);
        }
        const played = port.play();
        if (played instanceof Promise) void played.catch(() => onFailure(cue, file));
      } catch {
        onFailure(cue, file);
      }
    },
    setMuted(next) {
      muted = next;
    },
  };
}