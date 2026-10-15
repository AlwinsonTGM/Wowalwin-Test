import type { AnswerOutcome, JoinOutcome, ShownState } from '../game/machine.ts';
import type { SimulationMode } from '../game/events.ts';

/** What a surface can ask the server to do. */
export type ClientMessage =
  | { kind: 'join'; name?: string; token?: string }
  | { kind: 'startShow' }
  /** No question id: the machine picks the next one off its queue. */
  | { kind: 'presentQuestion' }
  | { kind: 'submitAnswer'; optionId: string }
  | { kind: 'reveal' }
  /** Ticket 03: the rehearsal room is seeded into the log, never connected. */
  | { kind: 'simulatePlayers'; count: number }
  | { kind: 'clearSimulated' }
  | { kind: 'simulateAnswers' }
  | { kind: 'setSimulation'; armed: boolean; mode: SimulationMode }
  /** Ticket 04: The bracket controls */
  | { kind: 'trimCull'; survivorIds: string[] }
  | { kind: 'seedBracket'; seed?: number }
  | { kind: 'rerunBout' }
  | { kind: 'reverseElimination'; playerId: string }
  /** Ticket 05: Pera o Kahon finale */
  | { kind: 'startFinale'; seed?: number }
  | { kind: 'choosePera' }
  | { kind: 'chooseKahon'; seed?: number }
  | { kind: 'revealKahon' };

/** What the server tells every surface. */
export type ServerMessage =
  | { kind: 'state'; state: ShownState }
  | { kind: 'serverInfo'; joinHost: string | null }
  | { kind: 'joinAck'; outcome: JoinOutcome; token?: string }
  /** About the sender's own submission, and nobody else's. */
  | { kind: 'answerAck'; outcome: AnswerOutcome };