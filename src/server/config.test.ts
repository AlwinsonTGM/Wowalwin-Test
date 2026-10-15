import { describe, expect, it } from 'vitest';
import { DEFAULT_LOG_PATH, REHEARSAL_LOG_PATH, logPathFor } from './config.ts';

/**
 * The ruling, as three commands. Each one names one file and no other, so the
 * Presenter never has to remember which is which: the filesystem decides, not
 * the order someone typed the words in.
 */
describe('which log a run is about', () => {
  it('gives the real show its own file', () => {
    expect(logPathFor(['tsx', 'src/server/index.ts'])).toBe(DEFAULT_LOG_PATH);
    expect(logPathFor(['tsx', 'src/server/index.ts', '--fresh'])).toBe(DEFAULT_LOG_PATH);
  });

  it('gives a rehearsal a different file, so the two can never collide', () => {
    expect(logPathFor(['tsx', 'src/server/index.ts', '--rehearse'])).toBe(REHEARSAL_LOG_PATH);
    expect(logPathFor(['tsx', 'src/server/index.ts', '--rehearse', '--fresh'])).toBe(REHEARSAL_LOG_PATH);
  });

  it('resumes the real show without the rehearsal flag', () => {
    // The combination that matters on the day: `resume` cannot reach a seeded
    // roster, because it never opens the file a seeded roster is written to.
    expect(logPathFor(['tsx', 'src/server/index.ts'])).not.toBe(REHEARSAL_LOG_PATH);
  });

  it('keeps dev on the real show’s log', () => {
    expect(logPathFor(['tsx', 'src/server/index.ts', '--dev'])).toBe(DEFAULT_LOG_PATH);
  });
});