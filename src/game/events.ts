/**
 * How a seeded room behaves when the question goes up. `correct` is an easy
 * round and `wrong` a hard one; `mixed` is a deterministic spread of all three
 * answers — right, wrong, and no answer at all — by roster order.
 *
 * There is no randomness here on purpose. A generator is injected for the Kahon
 * draw (spec), and a rehearsal that could not be replayed identically would be
 * no use for practising timing.
 */
export type SimulationMode = 'correct' | 'wrong' | 'mixed';

/** Everything that can happen to the show, as data. */
export type GameEvent =
  | { type: 'playerJoined'; playerId: string; name: string; simulated?: boolean }
  | { type: 'playerDisconnected'; playerId: string }
  | { type: 'playerReconnected'; playerId: string }
  | { type: 'showStarted' }
  /**
   * `at` is the adapter's clock, handed in rather than read: the machine never
   * reads one. A Backbone that reloads mid-question counts down from the same
   * number the server counted with, instead of starting the window over.
   */
  | { type: 'questionPresented'; questionId: string; at: number }
  | { type: 'answerSubmitted'; playerId: string; optionId: string }
  | { type: 'answerWindowClosed' }
  | { type: 'revealTriggered' }
  /** Ticket 03: the seeded roster is torn down whole, and real phones are not. */
  | { type: 'simulatedPlayersCleared' }
  /** The Presenter's rehearsal settings, held in state so every surface agrees. */
  | { type: 'simulationSet'; armed: boolean; mode: SimulationMode }
  /** Ticket 04: The Cull survivors trimmed to 8 entrants. */
  | { type: 'cullTrimmed'; survivorIds: string[] }
  /** Ticket 04: Bracket seeded with entrants in pairing order, pinned seed optional. */
  | { type: 'bracketSeeded'; entrants: string[]; seed?: number }
  /** Ticket 04: Re-running a bout when neither Player submitted. */
  | { type: 'boutRerun' }
  /** Ticket 04: Deliberate confirmed reversal of a mistaken elimination. */
  | { type: 'eliminationReversed'; playerId: string }
  /** Ticket 05: The Pera o Kahon finale */
  | { type: 'finaleStarted'; seed?: number }
  | { type: 'peraChosen' }
  | { type: 'kahonDrawn'; prizeId: string; seed?: number }
  | { type: 'kahonRevealed' };