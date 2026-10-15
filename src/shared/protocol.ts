import type { GameState } from '../game/machine.ts';
import type { JoinOutcome } from '../game/machine.ts';

/** What a surface can ask the server to do. */
export type ClientMessage =
  | { kind: 'join'; name?: string; token?: string }
  | { kind: 'startShow' };

/** What the server tells every surface. */
export type ServerMessage =
  | { kind: 'state'; state: GameState }
  | { kind: 'serverInfo'; joinHost: string | null }
  | { kind: 'joinAck'; outcome: JoinOutcome; token?: string };