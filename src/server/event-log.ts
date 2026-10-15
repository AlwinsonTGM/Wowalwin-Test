import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
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
  } catch {
    return []; // No log yet, or one we cannot read: a fresh show beats a crash.
  }
}

export function writeEventLog(logPath: string, events: GameEvent[]): void {
  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(logPath, JSON.stringify(events));
}