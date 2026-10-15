import type { GameEvent } from './events.ts';
import { showConfig } from '../content/show.ts';

export type Player = {
  id: string;
  name: string;
  connected: boolean;
};

export type Phase = 'joining' | 'started';

export type GameState = {
  phase: Phase;
  roster: Player[];
};

/** Why a Player did or did not get on the roster. The wording lives in content. */
export type JoinOutcome =
  | 'joined'
  | 'resumed'
  | 'unknownPlayer'
  | 'rosterFull'
  | 'showStarted'
  | 'nameRequired'
  | 'nameTooLong';

export type Plan = { outcome: JoinOutcome; event?: GameEvent };

const setConnected = (state: GameState, playerId: string, connected: boolean): GameState => ({
  ...state,
  roster: state.roster.map((p) => (p.id === playerId ? { ...p, connected } : p)),
});

/** The whole rules of the show: state is the event log, folded. */
export function fold(events: GameEvent[]): GameState {
  return events.reduce<GameState>(
    (state, event) => {
      switch (event.type) {
        case 'playerJoined':
          return { ...state, roster: [...state.roster, { id: event.playerId, name: event.name, connected: true }] };
        case 'playerDisconnected':
          return setConnected(state, event.playerId, false);
        case 'playerReconnected':
          return setConnected(state, event.playerId, true);
        case 'showStarted':
          return { ...state, phase: 'started' };
      }
    },
    { phase: 'joining', roster: [] },
  );
}

/**
 * A new Player submits a name. Decides whether it may happen and says which
 * event would make it happen, so the event log stays the only thing that
 * changes the show.
 */
export function planJoin(state: GameState, player: { id: string; name: string }): Plan {
  const name = player.name.trim();

  if (name.length === 0) return { outcome: 'nameRequired' };
  if (name.length > showConfig.maxNameLength) return { outcome: 'nameTooLong' };
  if (state.phase !== 'joining') return { outcome: 'showStarted' };
  if (state.roster.length >= showConfig.playerCap) return { outcome: 'rosterFull' };

  return { outcome: 'joined', event: { type: 'playerJoined', playerId: player.id, name } };
}

/** A Player holding a token the show already knows comes back. The event that
 *  reconnects them is the machine's to decide, so its type carries it: a server
 *  cannot restate the rule and get it wrong on a later ticket. */
export type ResumePlan =
  | { outcome: 'resumed'; event: Extract<GameEvent, { type: 'playerReconnected' }> }
  | { outcome: 'unknownPlayer' };

export function planResume(state: GameState, playerId: string): ResumePlan {
  if (!state.roster.some((p) => p.id === playerId)) return { outcome: 'unknownPlayer' };

  return { outcome: 'resumed', event: { type: 'playerReconnected', playerId } };
}