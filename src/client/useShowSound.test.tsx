// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useShowSound, MUTE_KEY } from './useShowSound.ts';
import type { ShownState } from '../game/machine.ts';
import { showConfig } from '../content/show.ts';
import type { Cue } from './sound.ts';

const heard: Cue[] = [];
/** When set, the device behaves like a browser handed a file that is not there. */
const unreadable = { is: false };

const cueFor = (src: string) =>
  (Object.keys(showConfig.audio) as Cue[]).find((cue) => showConfig.audio[cue] === src)!;

/**
 * Only the device is replaced. `createSound` itself — the mute rule and the
 * failure rule — is the real one, so these tests are about the hook, not about a
 * stand-in that agrees with whatever the hook does.
 */
vi.mock('./sound.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sound.ts')>();
  return {
    ...actual,
    createSound: (options: Parameters<typeof actual.createSound>[0]) =>
      actual.createSound({
        onFailure: options?.onFailure,
        createAudio: (src: string) => ({
          play: () => {
            heard.push(cueFor(src));
            if (unreadable.is) return Promise.reject(new Error('NotSupportedError'));
          },
        }),
      }),
  };
});

const aState = (phase: ShownState['phase']): ShownState => ({
  phase,
  roster: [{ id: 'p1', name: 'Ana', connected: true, standing: 'in', simulated: false }],
  asked: ['q1'],
  question: { id: 'q1', prompt: 'Bakit?', options: [{ id: 'a', label: 'Hindi' }], askedAt: 1000 },
  answer: null,
  simulation: { armed: false, mode: 'mixed' },
  bracket: null,
});

function Presenter({ state, expose }: { state: ShownState; expose?: (api: ReturnType<typeof useShowSound>) => void }) {
  const sound = useShowSound(state);
  expose?.(sound);
  return <p>{sound.muted ? 'muted' : 'live'}</p>;
}

/**
 * `expose` runs on every render, so a holder stays the current one. Capturing
 * the return of a single render instead would read `missing: null` off a
 * render from before the file failed, and quietly prove nothing.
 */
const holder = () => ({ current: null as ReturnType<typeof useShowSound> | null });

const at = (phase: ShownState['phase']) => <Presenter state={aState(phase)} />;

const atWith = (phase: ShownState['phase'], api: ReturnType<typeof holder>) => (
  <Presenter
    state={aState(phase)}
    expose={(current) => {
      api.current = current;
    }}
  />
);

const aSecond = () => showConfig.timings.tickSeconds * 1000;

beforeEach(() => {
  heard.length = 0;
  unreadable.is = false;
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the sound the show makes by itself', () => {
  it('ticks once when the question goes up, and keeps ticking while the window is open', () => {
    vi.useFakeTimers();
    const { rerender } = render(at('started'));
    expect(heard).toEqual([]);

    rerender(at('answering'));
    expect(heard).toEqual(['tick']);

    act(() => void vi.advanceTimersByTime(aSecond()));
    expect(heard).toEqual(['tick', 'tick']);
  });

  it('stings when the window closes, and never ticks again after it', () => {
    vi.useFakeTimers();
    const { rerender } = render(at('started'));
    rerender(at('answering'));

    rerender(at('revealPending'));

    act(() => void vi.advanceTimersByTime(aSecond() * 3));
    expect(heard).toEqual(['tick', 'sting']);
  });

  it('sounds the reveal exactly once, however many times the state comes round', () => {
    const { rerender } = render(at('revealPending'));

    rerender(at('revealed'));
    rerender(at('revealed'));

    expect(heard).toEqual(['reveal']);
  });

  it('says nothing at all on the first state a reloaded Backbone is given', () => {
    // A reload is not a change in the show. Replaying the sting of a suspense
    // pause that has already passed would be the one way sound could fire at
    // the wrong moment, and it is the failure this design exists to prevent.
    render(at('revealPending'));
    render(at('revealed'));

    expect(heard).toEqual([]);
  });
});

describe('the one mute control', () => {
  it('silences every cue, including the repeating tick', () => {
    vi.useFakeTimers();
    const api = holder();
    const { rerender } = render(atWith('started', api));

    act(() => api.current!.toggleMute());
    expect(screen.getByText('muted')).toBeTruthy();

    rerender(atWith('answering', api));
    act(() => void vi.advanceTimersByTime(aSecond() * 3));
    rerender(atWith('revealPending', api));
    rerender(atWith('revealed', api));

    expect(heard).toEqual([]);
  });

  it('is still muted after a reload, so a refresh cannot un-mute a noisy room', () => {
    localStorage.setItem(MUTE_KEY, 'true');
    render(at('started'));

    expect(screen.getByText('muted')).toBeTruthy();
  });

  it('comes back on when the Presenter presses it again', () => {
    const api = holder();
    const { rerender } = render(atWith('started', api));

    act(() => api.current!.toggleMute());
    act(() => api.current!.toggleMute());
    rerender(atWith('answering', api));

    expect(screen.getByText('live')).toBeTruthy();
    expect(localStorage.getItem(MUTE_KEY)).toBe('false');
    expect(heard).toEqual(['tick']);
  });
});

describe('a sound file that will not play', () => {
  it('is named to the Presenter, so a silent show is a known fact', async () => {
    unreadable.is = true;
    const api = holder();
    const { rerender } = render(atWith('started', api));

    rerender(atWith('answering', api));
    await act(async () => void Promise.resolve());

    expect(api.current!.missing).toBe('tick');
    expect(api.current!.file).toBe(showConfig.audio.tick);
  });

  it('does not stop the show: the reveal happens either way', async () => {
    unreadable.is = true;
    const api = holder();
    const { rerender } = render(atWith('revealPending', api));

    expect(() => rerender(atWith('revealed', api))).not.toThrow();
    await act(async () => void Promise.resolve());

    expect(api.current!.missing).toBe('reveal');
    expect(heard).toEqual(['reveal']);
  });
});