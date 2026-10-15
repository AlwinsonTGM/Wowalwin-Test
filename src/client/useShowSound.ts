import { useEffect, useRef, useState } from 'react';
import type { ShownState } from '../game/machine.ts';
import { showConfig } from '../content/show.ts';
import { cuesBetween, createSound, type Cue, type Sound } from './sound.ts';

/** One mute control for the whole show, and it survives a reload with it. */
export const MUTE_KEY = 'wowolwin.muted';

/**
 * Sound for the Backbone, driven by state and by nothing else.
 *
 * The Presenter's buttons only ever send messages; every sound here is a
 * consequence of the state that comes back. The tick is the sustained sound of
 * an open answer window rather than an event, which is why it repeats: it is
 * armed by the state and disarmed by the state.
 */
export function useShowSound(state: ShownState) {
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'true');
  const [missing, setMissing] = useState<Cue | null>(null);
  const sound = useRef<Sound | null>(null);
  const previous = useRef<ShownState | null>(null);

  if (sound.current === null) {
    sound.current = createSound({ onFailure: (cue) => setMissing(cue) });
  }

  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    // The first state a surface is given is the show as it already is, not a
    // change in it: reloading the Backbone mid-question must not replay the
    // sting of a suspense pause that has already passed.
    if (before === null) return;

    for (const cue of cuesBetween(before, state)) sound.current?.play(cue);
  }, [state]);

  useEffect(() => {
    sound.current?.setMuted(muted);
  }, [muted]);

  const answering = state.phase === 'answering';

  useEffect(() => {
    if (!answering || muted) return;
    const timer = setInterval(() => sound.current?.play('tick'), showConfig.timings.tickSeconds * 1000);
    return () => clearInterval(timer);
  }, [answering, muted]);

  const toggleMute = () => {
    const next = !muted;
    localStorage.setItem(MUTE_KEY, String(next));
    setMuted(next);
  };

  return {
    muted,
    toggleMute,
    /** The cue whose file could not be played, or null if all is well. */
    missing,
    file: missing === null ? null : showConfig.audio[missing],
  };
}