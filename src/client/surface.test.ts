// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { surfaceFor } from './surface.ts';

describe('which surface a browser is on', () => {
  it('is decided by the path the Presenter or a phone asked for', () => {
    expect(surfaceFor('/')).toBe('backbone');
    expect(surfaceFor('/stage')).toBe('stage');
    expect(surfaceFor('/play')).toBe('player');
  });

  it('forgives a trailing slash, so a Player phone never gets the Presenter’s controls', () => {
    // /play/ is one keystroke away from what a phone was sent, and the catch-all
    // serves index.html for both. Getting this wrong ends the show mid-game
    // with the roster looking perfectly healthy.
    expect(surfaceFor('/play/')).toBe('player');
    expect(surfaceFor('/stage/')).toBe('stage');
  });
});