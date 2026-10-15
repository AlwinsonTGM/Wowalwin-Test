import type { AnswerOutcome, JoinOutcome, ShownState } from '../game/machine.ts';

/** What a surface can ask the server to do. */
export type ClientMessage =
  | { kind: 'join'; name?: string; token?: string }
  | { kind: 'startShow' }
  /** No question id: the machine picks the next one off its queue. */
  | { kind: 'presentQuestion' }
  | { kind: 'submitAnswer'; optionId: string }
  | { kind: 'reveal' };

/** What the server tells every surface. */
export type ServerMessage =
  | { kind: 'state'; state: ShownState }
  | { kind: 'serverInfo'; joinHost: string | null }
  | { kind: 'joinAck'; outcome: JoinOutcome; token?: string }
  /** About the sender's own submission, and nobody else's. */
  | { kind: 'answerAck'; outcome: AnswerOutcome };