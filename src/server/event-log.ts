import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { copy } from '../content/show.ts';
import type { GameEvent } from '../game/events.ts';

/**
 * The event log is the show. It is written on every event so a server that
 * dies mid-show is not the end of the show (ADR-0002: no time to debug in the
 * room).
 */
export function readEventLog(logPath: string): GameEvent[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(logPath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as GameEvent[]) : [];
  } catch (error) {
    // No log yet is the ordinary first run and says nothing. A log we cannot
    // read is not ordinary: the roster came back empty, and silently is how a
    // Presenter ends up staring at "Wala pang nakakapasok" with no idea why.
    if (existsSync(logPath)) console.warn(copy.common.logUnreadable(logPath), error);
    return []; // A fresh show beats a crash, but not an unexplained one.
  }
}

export function writeEventLog(logPath: string, events: GameEvent[]): void {
  mkdirSync(dirname(logPath), { recursive: true });
  // Writing the log in place truncates it first, so a crash between the two
  // steps leaves an empty or half-written file — and a half-written log reads
  // back as no show at all, losing the roster in exactly the crash it was
  // written to survive. Writing beside it and renaming is atomic, so what is
  // on disk is always a whole log.
  const scratch = `${logPath}.tmp`;
  writeFileSync(scratch, JSON.stringify(events));
  renameSync(scratch, logPath);
}