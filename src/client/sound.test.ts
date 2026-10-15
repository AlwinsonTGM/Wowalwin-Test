import { describe, expect, it, vi } from 'vitest';
import { cuesBetween, createSound, type AudioLike, type Cue } from './sound.ts';
import { showConfig } from '../content/show.ts';

/** A sound device that remembers which files it was handed, and never touches hardware. */
function aDevice() {
  const asked: string[] = [];
  const create = (src: string): AudioLike => ({
    play: () => {
      asked.push(src);
    },
  });
  return { asked, create };
}

const aPhase = (phase: string) => ({ phase }) as Parameters<typeof cuesBetween>[0];

describe('what a state change sounds like', () => {
  it('ticks when the answer window opens', () => {
    expect(cuesBetween(aPhase('started'), aPhase('answering'))).toEqual(['tick']);
  });

  it('stings at the suspense pause, when the window closes', () => {
    expect(cuesBetween(aPhase('answering'), aPhase('revealPending'))).toEqual(['sting']);
  });

  it('sounds the reveal differently from the sting', () => {
    expect(cuesBetween(aPhase('revealPending'), aPhase('revealed'))).toEqual(['reveal']);
  });

  it('says nothing at all when the show did not move', () => {
    // The rule in one line: a sound is a consequence of the show changing. A
    // Presenter pressing the reveal twice changes nothing the second time, so
    // there is nothing for the room to hear twice.
    expect(cuesBetween(aPhase('revealPending'), aPhase('revealPending'))).toEqual([]);
    expect(cuesBetween(aPhase('joining'), aPhase('started'))).toEqual([]);
    expect(cuesBetween(aPhase('revealed'), aPhase('answering'))).toEqual(['tick']);
  });
});

describe('the sound device', () => {
  it('plays the file the content file names', () => {
    const device = aDevice();
    const sound = createSound({ createAudio: device.create });

    sound.play('sting');

    expect(device.asked).toEqual([showConfig.audio.sting]);
  });

  it('is silent, and stays silent, once muted', () => {
    const device = aDevice();
    const sound = createSound({ createAudio: device.create });

    sound.setMuted(true);
    sound.play('tick');
    sound.play('sting');
    sound.play('reveal');

    expect(device.asked).toEqual([]);
  });

  it('plays again when unmuted, without a reload', () => {
    const device = aDevice();
    const sound = createSound({ createAudio: device.create });

    sound.setMuted(true);
    sound.play('tick');
    sound.setMuted(false);
    sound.play('tick');

    expect(device.asked).toEqual([showConfig.audio.tick]);
  });

  it('stays silent, and says which file is missing, when the file is not there', async () => {
    // A browser does not refuse to build an Audio element for a file that is
    // not there; it refuses when play() is called. Both paths have to degrade
    // the same way, and neither may throw into the reveal.
    const onFailure = vi.fn();
    const missing: AudioLike = { play: () => Promise.reject(new Error('NotSupportedError')) };
    const sound = createSound({ createAudio: () => missing, onFailure });

    expect(() => sound.play('reveal')).not.toThrow();
    await Promise.resolve();

    expect(onFailure).toHaveBeenCalledWith('reveal', showConfig.audio.reveal);
  });

  it('stays silent, and says which file is missing, when the device refuses outright', () => {
    const onFailure = vi.fn();
    const sound = createSound({
      createAudio: () => {
        throw new Error('no audio hardware');
      },
      onFailure,
    });

    expect(() => sound.play('tick')).not.toThrow();

    expect(onFailure).toHaveBeenCalledWith('tick', showConfig.audio.tick);
  });
});