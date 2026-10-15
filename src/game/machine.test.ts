import { describe, expect, it } from 'vitest';
import { fold, planJoin, planResume } from './machine.ts';
import type { GameEvent } from './events.ts';
import { showConfig } from '../content/show.ts';

const aPlayer = (id: string, name: string): GameEvent => ({ type: 'playerJoined', playerId: id, name });
const showStarted: GameEvent = { type: 'showStarted' };

describe('the roster', () => {
  it('is empty before anyone joins', () => {
    expect(fold([])).toEqual({ phase: 'joining', roster: [] });
  });

  it('holds a Player who joins', () => {
    expect(fold([aPlayer('p1', 'Ana')]).roster).toEqual([{ id: 'p1', name: 'Ana', connected: true }]);
  });

  it('keeps Players in the order they joined', () => {
    const state = fold([aPlayer('p1', 'Ana'), aPlayer('p2', 'Ben'), aPlayer('p3', 'Cara')]);

    expect(state.roster.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Cara']);
  });
});

describe('joining', () => {
  it('puts the Player on the roster and says they are in', () => {
    const { event } = planJoin(fold([]), { id: 'p1', name: 'Ana' });

    expect(fold([event!])).toEqual({
      phase: 'joining',
      roster: [{ id: 'p1', name: 'Ana', connected: true }],
    });
  });

  it('trims the name it stores', () => {
    const { event } = planJoin(fold([]), { id: 'p1', name: '  Ana  ' });

    expect(fold([event!]).roster[0]?.name).toBe('Ana');
  });

  it('turns away a blank name', () => {
    expect(planJoin(fold([]), { id: 'p1', name: '   ' }).outcome).toBe('nameRequired');
  });

  it('turns away a name longer than the limit', () => {
    const tooLong = 'x'.repeat(showConfig.maxNameLength + 1);

    expect(planJoin(fold([]), { id: 'p1', name: tooLong }).outcome).toBe('nameTooLong');
  });

  it('turns away a Player once the roster is at the hard cap', () => {
    const full = fold(Array.from({ length: showConfig.playerCap }, (_, i) => aPlayer(`p${i}`, `Player ${i}`)));

    expect(planJoin(full, { id: 'late', name: 'Late' }).outcome).toBe('rosterFull');
  });

  it('is not started by Players arriving — the Presenter starts it', () => {
    const crowd = fold([aPlayer('p1', 'Ana'), aPlayer('p2', 'Ben')]);

    expect(crowd.phase).toBe('joining');
    expect(fold([aPlayer('p1', 'Ana'), showStarted]).phase).toBe('started');
  });

  it('tells a late Player plainly that the show has begun', () => {
    const started = fold([aPlayer('p1', 'Ana'), showStarted]);

    expect(planJoin(started, { id: 'p2', name: 'Ben' }).outcome).toBe('showStarted');
    expect(started.roster.map((p) => p.name)).toEqual(['Ana']);
  });
});

describe('a phone that drops', () => {
  it('keeps its place on the roster and shows as disconnected', () => {
    const state = fold([aPlayer('p1', 'Ana'), aPlayer('p2', 'Ben'), { type: 'playerDisconnected', playerId: 'p1' }]);

    expect(state.roster).toEqual([
      { id: 'p1', name: 'Ana', connected: false },
      { id: 'p2', name: 'Ben', connected: true },
    ]);
  });

  it('reconnects to the same place, not a new one', () => {
    const log: GameEvent[] = [aPlayer('p1', 'Ana'), aPlayer('p2', 'Ben'), { type: 'playerDisconnected', playerId: 'p1' }];

    const state = fold([...log, { type: 'playerReconnected', playerId: 'p1' }]);

    expect(state.roster.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(state.roster.every((p) => p.connected)).toBe(true);
  });

  it('resumes a Player the show already knows, whatever name the phone now sends', () => {
    const { outcome, event } = planResume(fold([aPlayer('p1', 'Ana')]), 'p1');

    expect(outcome).toBe('resumed');
    expect(event).toEqual({ type: 'playerReconnected', playerId: 'p1' });
  });

  it('does not pretend to know a Player it has never seen', () => {
    expect(planResume(fold([]), 'p9').outcome).toBe('unknownPlayer');
  });

  it('ignores presence for a Player who was never on the roster', () => {
    const state = fold([aPlayer('p1', 'Ana'), { type: 'playerDisconnected', playerId: 'ghost' }]);

    expect(state.roster).toEqual([{ id: 'p1', name: 'Ana', connected: true }]);
  });
});

describe('the event log', () => {
  const log: GameEvent[] = [
    aPlayer('p1', 'Ana'),
    aPlayer('p2', 'Ben'),
    { type: 'playerDisconnected', playerId: 'p2' },
    showStarted,
    { type: 'playerReconnected', playerId: 'p2' },
  ];

  it('holds all the state, so every prefix folds to the state at that point', () => {
    const prefixes = log.map((_, i) => fold(log.slice(0, i + 1)));

    expect(prefixes.at(-1)).toEqual(fold(log));
    expect(prefixes[3]).toEqual({
      phase: 'started',
      roster: [
        { id: 'p1', name: 'Ana', connected: true },
        { id: 'p2', name: 'Ben', connected: false },
      ],
    });
  });
});