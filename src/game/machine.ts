import type { GameEvent, SimulationMode } from './events.ts';
import { findQuestion, questionsIn, type PoolName, type Question } from '../content/questions.ts';
import { showConfig, simulatedName } from '../content/show.ts';
import { Pera, kahonTable, type Prize } from '../content/prizes.ts';
import { deckSlides } from '../content/deck.ts';

export type Player = {
  id: string;
  name: string;
  connected: boolean;
  /** `out` once a cull reveal has put them out, and never back to `in`. */
  standing: 'in' | 'out';
  /** Seeded by the Presenter rather than by a phone (ticket 03). */
  simulated: boolean;
};

/**
 * The show is in exactly one phase at a time. `answering`, `revealPending` and
 * `revealed` are one question's arc, and a bout (ticket 04) runs the same three
 * so nothing about the pacing is built twice.
 */
export type Phase = 'joining' | 'started' | 'answering' | 'revealPending' | 'revealed';

/** What every surface may see of the question on screen. Never the answer. */
export type PublicQuestion = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
  /** The adapter's clock when the question went up. See `questionPresented`. */
  askedAt: number;
};

/** One answer as it arrived. The order of these is the server's receipt order. */
export type Submission = { playerId: string; optionId: string };

/** What the reveal published. Before it, `answer` is null on every surface. */
export type RevealedAnswer = {
  questionId: string;
  optionId: string;
  optionLabel: string;
  /** Receipt order, held back until the reveal made it public. */
  submissions: Submission[];
};

export type BoutRound = 'quarter' | 'semi' | 'final';

export type Bout = {
  id: string;
  round: BoutRound;
  index: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  resolvedBy?: 'bout' | 'bye';
};

export type BracketState = {
  bouts: Bout[];
  currentBoutId: string | null;
  finalistId: string | null;
  seed?: number;
};

export type FinaleChoice = 'pera' | 'kahon';

export type FinaleState = {
  choice: FinaleChoice | null;
  drawnPrizeId: string | null;
  revealed: boolean;
  seed?: number;
};

export type DeckState = {
  active: boolean;
  slideIndex: number;
  previousPhase?: Phase;
};

export type GameState = {
  phase: Phase;
  roster: Player[];
  /** Every question id asked so far, so the queue advances and can be counted. */
  asked: string[];
  question: PublicQuestion | null;
  answer: RevealedAnswer | null;
  /**
   * Submissions waiting for the Presenter. They live here and nowhere else:
   * ADR-0003 puts the grading in the server's hands and the timing in the
   * Presenters', and the one way to keep those apart across a single broadcast
   * is for the sealed list never to leave the machine.
   */
  sealed: Submission[];
  /**
   * The Presenter's rehearsal settings (ticket 03). They are in the state
   * rather than in the adapter so that a reload cannot desync the Backbone
   * from the server about whether the seeded room is armed to answer, and so
   * that every surface tells the same story.
   */
  simulation: { armed: boolean; mode: SimulationMode };
  /** Ticket 04: The Bracket single-elimination tournament */
  bracket: BracketState | null;
  /** Ticket 05: The Pera o Kahon finale */
  finale: FinaleState | null;
  /** Ticket 07: The Deck (safety net & module slides presentation) */
  deck: DeckState;
};

/** What a surface is given: the same state, minus the room's secret. */
export type ShownState = Omit<GameState, 'sealed'>;

/** The only way out of the machine. Nothing a socket carries has a `sealed`. */
export function shown(state: GameState): ShownState {
  const { sealed: _sealed, ...rest } = state;
  return rest;
}

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

const questionOn = (id: string, at: number): PublicQuestion | null => {
  const question = findQuestion(id);
  if (!question) return null;

  // The options are copied without the answer key on purpose. A surface that
  // renders this cannot render the correct answer, because it is not here.
  return {
    id: question.id,
    prompt: question.prompt,
    options: question.options.map((option) => ({ id: option.id, label: option.label })),
    askedAt: at,
  };
};

const raise = (state: GameState, questionId: string, at: number): GameState => {
  const question = questionOn(questionId, at);
  if (!question) return state;

  return {
    ...state,
    phase: 'answering',
    asked: [...state.asked, questionId],
    question,
    answer: null,
    sealed: [],
  };
};

/**
 * Fast, deterministic 32-bit PRNG (Mulberry32).
 * Given a numeric seed, returns a function `() => number` producing numbers in [0, 1).
 */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place Fisher-Yates shuffle using an injected generator. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

export function createEmptyBouts(): Bout[] {
  return [
    { id: 'bout-1', round: 'quarter', index: 0, player1Id: null, player2Id: null, winnerId: null },
    { id: 'bout-2', round: 'quarter', index: 1, player1Id: null, player2Id: null, winnerId: null },
    { id: 'bout-3', round: 'quarter', index: 2, player1Id: null, player2Id: null, winnerId: null },
    { id: 'bout-4', round: 'quarter', index: 3, player1Id: null, player2Id: null, winnerId: null },
    { id: 'bout-5', round: 'semi', index: 4, player1Id: null, player2Id: null, winnerId: null },
    { id: 'bout-6', round: 'semi', index: 5, player1Id: null, player2Id: null, winnerId: null },
    { id: 'bout-7', round: 'final', index: 6, player1Id: null, player2Id: null, winnerId: null },
  ];
}

/** Seeds up to 8 entrants into the 8 quarterfinal slots, balancing byes. */
export function seedEntrantsIntoSlots(entrants: string[]): (string | null)[] {
  const n = entrants.length;
  if (n >= 8) return entrants.slice(0, 8);
  if (n === 7) return [entrants[0]!, null, entrants[1]!, entrants[2]!, entrants[3]!, entrants[4]!, entrants[5]!, entrants[6]!];
  if (n === 6) return [entrants[0]!, null, entrants[1]!, entrants[2]!, entrants[3]!, null, entrants[4]!, entrants[5]!];
  if (n === 5) return [entrants[0]!, null, entrants[1]!, null, entrants[2]!, null, entrants[3]!, entrants[4]!];
  if (n === 4) return [entrants[0]!, null, entrants[1]!, null, entrants[2]!, null, entrants[3]!, null];
  if (n === 3) return [entrants[0]!, null, null, null, entrants[1]!, null, entrants[2]!, null];
  if (n === 2) return [entrants[0]!, null, null, null, entrants[1]!, null, null, null];
  if (n === 1) return [entrants[0]!, null, null, null, null, null, null, null];
  return Array(8).fill(null);
}

/**
 * Propagates byes and winners forward through the 7-bout single-elimination bracket.
 * 0..3: Quarterfinals (0 & 1 -> 4, 2 & 3 -> 5)
 * 4..5: Semifinals (4 & 5 -> 6)
 * 6: Final (6 -> finalistId)
 */
export function propagateBracket(initialBouts: Bout[]): { bouts: Bout[]; finalistId: string | null } {
  const bouts = initialBouts.map((b) => ({ ...b }));
  let changed = true;
  let finalistId: string | null = null;

  while (changed) {
    changed = false;
    for (let i = 0; i < bouts.length; i++) {
      const bout = bouts[i]!;

      // 1. Resolve byes for unresolved bouts
      if (bout.winnerId === null) {
        if (i < 4) {
          // Quarterfinals
          if (bout.player1Id !== null && bout.player2Id === null) {
            bout.winnerId = bout.player1Id;
            bout.resolvedBy = 'bye';
            changed = true;
          } else if (bout.player1Id === null && bout.player2Id !== null) {
            bout.winnerId = bout.player2Id;
            bout.resolvedBy = 'bye';
            changed = true;
          }
        } else if (i === 4) {
          // Semifinal 1 (feeders are 0 and 1)
          const qf1Empty = bouts[0]!.player1Id === null && bouts[0]!.player2Id === null;
          const qf2Empty = bouts[1]!.player1Id === null && bouts[1]!.player2Id === null;
          if (bout.player1Id !== null && qf2Empty && bout.player2Id === null) {
            bout.winnerId = bout.player1Id;
            bout.resolvedBy = 'bye';
            changed = true;
          } else if (bout.player2Id !== null && qf1Empty && bout.player1Id === null) {
            bout.winnerId = bout.player2Id;
            bout.resolvedBy = 'bye';
            changed = true;
          }
        } else if (i === 5) {
          // Semifinal 2 (feeders are 2 and 3)
          const qf3Empty = bouts[2]!.player1Id === null && bouts[2]!.player2Id === null;
          const qf4Empty = bouts[3]!.player1Id === null && bouts[3]!.player2Id === null;
          if (bout.player1Id !== null && qf4Empty && bout.player2Id === null) {
            bout.winnerId = bout.player1Id;
            bout.resolvedBy = 'bye';
            changed = true;
          } else if (bout.player2Id !== null && qf3Empty && bout.player1Id === null) {
            bout.winnerId = bout.player2Id;
            bout.resolvedBy = 'bye';
            changed = true;
          }
        } else if (i === 6) {
          // Final (feeders are 4 and 5)
          const sf1Empty =
            bouts[4]!.player1Id === null && bouts[4]!.player2Id === null && bouts[4]!.winnerId === null;
          const sf2Empty =
            bouts[5]!.player1Id === null && bouts[5]!.player2Id === null && bouts[5]!.winnerId === null;
          if (bout.player1Id !== null && sf2Empty && bout.player2Id === null) {
            bout.winnerId = bout.player1Id;
            bout.resolvedBy = 'bye';
            finalistId = bout.winnerId;
            changed = true;
          } else if (bout.player2Id !== null && sf1Empty && bout.player1Id === null) {
            bout.winnerId = bout.player2Id;
            bout.resolvedBy = 'bye';
            finalistId = bout.winnerId;
            changed = true;
          }
        }
      }

      // 2. Propagate winners forward
      if (bout.winnerId !== null) {
        if (i === 0 && bouts[4]!.player1Id !== bout.winnerId) {
          bouts[4]!.player1Id = bout.winnerId;
          changed = true;
        } else if (i === 1 && bouts[4]!.player2Id !== bout.winnerId) {
          bouts[4]!.player2Id = bout.winnerId;
          changed = true;
        } else if (i === 2 && bouts[5]!.player1Id !== bout.winnerId) {
          bouts[5]!.player1Id = bout.winnerId;
          changed = true;
        } else if (i === 3 && bouts[5]!.player2Id !== bout.winnerId) {
          bouts[5]!.player2Id = bout.winnerId;
          changed = true;
        } else if (i === 4 && bouts[6]!.player1Id !== bout.winnerId) {
          bouts[6]!.player1Id = bout.winnerId;
          changed = true;
        } else if (i === 5 && bouts[6]!.player2Id !== bout.winnerId) {
          bouts[6]!.player2Id = bout.winnerId;
          changed = true;
        } else if (i === 6) {
          finalistId = bout.winnerId;
        }
      }
    }
  }

  return { bouts, finalistId };
}

export type BoutResolution =
  | { outcome: 'winner'; winnerId: string; eliminatedId: string; reason: 'earliestCorrect' | 'opponentEliminated' }
  | { outcome: 'tieNoSubmissions' };

/**
 * Settles a 1-on-1 bout according to Ticket 04 rules:
 * 1. Earliest correct submission wins the bout, regardless of when the other Player submitted
 *    and regardless of whether the first submission was correct.
 * 2. When every submission is wrong and at least one Player submitted, the earliest submitter is
 *    eliminated and the other Player advances.
 * 3. When neither Player submitted, nobody is eliminated and the operator re-runs the bout.
 */
export function resolveBout(
  player1Id: string,
  player2Id: string,
  correctOptionId: string,
  submissions: readonly Submission[],
): BoutResolution {
  const boutSubs = submissions.filter((s) => s.playerId === player1Id || s.playerId === player2Id);

  const earliestCorrect = boutSubs.find((s) => s.optionId === correctOptionId);
  if (earliestCorrect) {
    const winnerId = earliestCorrect.playerId;
    const eliminatedId = winnerId === player1Id ? player2Id : player1Id;
    return { outcome: 'winner', winnerId, eliminatedId, reason: 'earliestCorrect' };
  }

  if (boutSubs.length > 0) {
    const earliestWrong = boutSubs[0]!;
    const eliminatedId = earliestWrong.playerId;
    const winnerId = eliminatedId === player1Id ? player2Id : player1Id;
    return { outcome: 'winner', winnerId, eliminatedId, reason: 'opponentEliminated' };
  }

  return { outcome: 'tieNoSubmissions' };
}

const revealAnswer = (state: GameState): GameState => {
  const question = state.question;
  if (!question) return state;

  const bank = findQuestion(question.id);
  const option = bank?.options.find((candidate) => candidate.id === bank.correctOptionId);
  // A question whose answer key is broken publishes nothing at all, rather
  // than publishing an answer nobody can trust.
  if (!bank || !option) return state;

  const answer: RevealedAnswer = {
    questionId: question.id,
    optionId: option.id,
    optionLabel: option.label,
    submissions: state.sealed,
  };

  // If in the Bracket:
  if (state.bracket !== null && state.bracket.currentBoutId !== null) {
    const bout = state.bracket.bouts.find((b) => b.id === state.bracket!.currentBoutId);
    if (bout && bout.player1Id !== null && bout.player2Id !== null) {
      const resolution = resolveBout(bout.player1Id, bout.player2Id, option.id, state.sealed);

      if (resolution.outcome === 'winner') {
        const updatedBouts = state.bracket.bouts.map((b) =>
          b.id === bout.id ? { ...b, winnerId: resolution.winnerId, resolvedBy: 'bout' as const } : b,
        );
        const { bouts: propagatedBouts, finalistId } = propagateBracket(updatedBouts);
        const nextBout = propagatedBouts.find(
          (b) => b.winnerId === null && b.player1Id !== null && b.player2Id !== null,
        );

        return {
          ...state,
          phase: 'revealed',
          sealed: [],
          answer,
          roster: state.roster.map((player) =>
            player.id === resolution.eliminatedId ? { ...player, standing: 'out' } : player,
          ),
          bracket: {
            ...state.bracket,
            bouts: propagatedBouts,
            currentBoutId: bout.id,
            finalistId,
          },
        };
      }

      // Neither Player submitted: nobody is eliminated! Operator can re-run the bout.
      return {
        ...state,
        phase: 'revealed',
        sealed: [],
        answer,
      };
    }
  }

  // The cull resolves in the same event that reveals the answer, which is what
  // makes the grid flip all at once: one event, one new state, every name.
  const answeredRight = new Set(
    state.sealed.filter((submission) => submission.optionId === option.id).map((submission) => submission.playerId),
  );

  let survivorIds = answeredRight;
  // Cull floor guarantee (03 amendment): The Cull never empties the room.
  // On Cull reveal, if no one answered correctly: the last submitter keeps their place;
  // if nobody submitted, the first joined Player who was still in keeps their place.
  if (survivorIds.size === 0) {
    if (state.sealed.length > 0) {
      const lastSubmitter = state.sealed[state.sealed.length - 1]!;
      survivorIds = new Set([lastSubmitter.playerId]);
    } else {
      const firstIn = state.roster.find((player) => player.standing === 'in');
      if (firstIn) {
        survivorIds = new Set([firstIn.id]);
      }
    }
  }

  return {
    ...state,
    phase: 'revealed',
    sealed: [],
    answer,
    // A correct submission survives and everyone else is out — which includes
    // every Player who never submitted, and every Player already out.
    roster: state.roster.map((player) => ({ ...player, standing: survivorIds.has(player.id) ? 'in' : 'out' })),
  };
};

/** The whole rules of the show: state is the event log, folded. */
export function fold(events: GameEvent[]): GameState {
  return events.reduce<GameState>(
    (state, event) => {
      switch (event.type) {
        case 'playerJoined':
          return {
            ...state,
            roster: [
              ...state.roster,
              {
                id: event.playerId,
                name: event.name,
                connected: true,
                standing: 'in',
                simulated: event.simulated ?? false,
              },
            ],
          };
        case 'playerDisconnected':
          return setConnected(state, event.playerId, false);
        case 'playerReconnected':
          return setConnected(state, event.playerId, true);
        case 'showStarted':
          return { ...state, phase: 'started' };
        case 'questionPresented': {
          const s = raise(state, event.questionId, event.at);
          if (s.bracket !== null) {
            const nextBout = s.bracket.bouts.find(
              (b) => b.winnerId === null && b.player1Id !== null && b.player2Id !== null,
            );
            return {
              ...s,
              bracket: {
                ...s.bracket,
                currentBoutId: nextBout ? nextBout.id : null,
              },
            };
          }
          return s;
        }
        case 'answerSubmitted':
          return { ...state, sealed: [...state.sealed, { playerId: event.playerId, optionId: event.optionId }] };
        case 'answerWindowClosed':
          return state.phase === 'answering' ? { ...state, phase: 'revealPending' } : state;
        case 'revealTriggered':
          return revealAnswer(state);
        case 'simulatedPlayersCleared':
          // The whole seeded roster goes, and not one real phone with it.
          return { ...state, roster: state.roster.filter((player) => !player.simulated) };
        case 'simulationSet':
          return { ...state, simulation: { armed: event.armed, mode: event.mode } };
        case 'cullTrimmed': {
          const survivorSet = new Set(event.survivorIds);
          return {
            ...state,
            roster: state.roster.map((player) => ({
              ...player,
              standing: survivorSet.has(player.id) ? player.standing : 'out',
            })),
          };
        }
        case 'bracketSeeded': {
          const empty = createEmptyBouts();
          const slots = seedEntrantsIntoSlots(event.entrants);
          empty[0]!.player1Id = slots[0] ?? null; empty[0]!.player2Id = slots[1] ?? null;
          empty[1]!.player1Id = slots[2] ?? null; empty[1]!.player2Id = slots[3] ?? null;
          empty[2]!.player1Id = slots[4] ?? null; empty[2]!.player2Id = slots[5] ?? null;
          empty[3]!.player1Id = slots[6] ?? null; empty[3]!.player2Id = slots[7] ?? null;

          const { bouts, finalistId } = propagateBracket(empty);
          const currentBout = bouts.find(
            (b) => b.winnerId === null && b.player1Id !== null && b.player2Id !== null,
          );

          return {
            ...state,
            bracket: {
              bouts,
              currentBoutId: currentBout ? currentBout.id : null,
              finalistId,
              seed: event.seed,
            },
          };
        }
        case 'boutRerun': {
          return {
            ...state,
            phase: 'started',
            question: null,
            answer: null,
            sealed: [],
          };
        }
        case 'eliminationReversed': {
          let nextBracket = state.bracket;
          if (state.bracket !== null) {
            const boutIndex = state.bracket.bouts.findIndex(
              (b) =>
                (b.player1Id === event.playerId || b.player2Id === event.playerId) &&
                b.winnerId !== null &&
                b.winnerId !== event.playerId,
            );
            if (boutIndex !== -1) {
              const bout = state.bracket.bouts[boutIndex]!;
              const formerWinner = bout.winnerId;
              const bouts = state.bracket.bouts.map((b, idx) =>
                idx === boutIndex ? { ...b, winnerId: null, resolvedBy: undefined } : { ...b },
              );
              for (let i = boutIndex + 1; i < bouts.length; i++) {
                if (bouts[i]!.player1Id === formerWinner) {
                  bouts[i]!.player1Id = null;
                  bouts[i]!.winnerId = null;
                  bouts[i]!.resolvedBy = undefined;
                }
                if (bouts[i]!.player2Id === formerWinner) {
                  bouts[i]!.player2Id = null;
                  bouts[i]!.winnerId = null;
                  bouts[i]!.resolvedBy = undefined;
                }
              }
              const { bouts: propagatedBouts, finalistId } = propagateBracket(bouts);
              const currentBout = propagatedBouts.find(
                (b) => b.winnerId === null && b.player1Id !== null && b.player2Id !== null,
              );
              nextBracket = {
                ...state.bracket,
                bouts: propagatedBouts,
                currentBoutId: currentBout ? currentBout.id : null,
                finalistId,
              };
            }
          }

          return {
            ...state,
            bracket: nextBracket,
            roster: state.roster.map((player) =>
              player.id === event.playerId ? { ...player, standing: 'in' } : player,
            ),
          };
        }
        case 'finaleStarted': {
          return {
            ...state,
            finale: {
              choice: null,
              drawnPrizeId: null,
              revealed: false,
              seed: event.seed,
            },
          };
        }
        case 'peraChosen': {
          if (state.finale === null) return state;
          return {
            ...state,
            finale: {
              ...state.finale,
              choice: 'pera',
              drawnPrizeId: Pera.id,
              revealed: true,
            },
          };
        }
        case 'kahonDrawn': {
          if (state.finale === null) return state;
          return {
            ...state,
            finale: {
              ...state.finale,
              choice: 'kahon',
              drawnPrizeId: event.prizeId,
              revealed: false,
              ...(event.seed !== undefined ? { seed: event.seed } : {}),
            },
          };
        }
        case 'kahonRevealed': {
          if (state.finale === null) return state;
          return {
            ...state,
            finale: {
              ...state.finale,
              revealed: true,
            },
          };
        }
        case 'deckOpened': {
          return {
            ...state,
            deck: {
              ...state.deck,
              active: true,
              slideIndex:
                event.slideIndex !== undefined
                  ? Math.max(0, Math.min(event.slideIndex, deckSlides.length - 1))
                  : state.deck.slideIndex,
              previousPhase: state.phase,
            },
          };
        }
        case 'deckClosed': {
          return {
            ...state,
            deck: {
              ...state.deck,
              active: false,
            },
          };
        }
        case 'deckSlideSet': {
          return {
            ...state,
            deck: {
              ...state.deck,
              slideIndex: Math.max(0, Math.min(event.slideIndex, deckSlides.length - 1)),
            },
          };
        }
      }
    },
    {
      phase: 'joining',
      roster: [],
      asked: [],
      question: null,
      answer: null,
      sealed: [],
      simulation: { armed: false, mode: 'mixed' },
      bracket: null,
      finale: null,
      deck: { active: false, slideIndex: 0 },
    },
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

/**
 * Everyone still in the show. The Backbone's survivor count is this length.
 *
 * These four read only the roster and the asked list, so they are typed on what
 * they need rather than on the whole state: a surface is handed the shown half
 * of it, and a Backbone should be able to count its survivors.
 */
export const survivors = (state: Pick<GameState, 'roster'>): Player[] =>
  state.roster.filter((player) => player.standing === 'in');

/** Questions the pool has not asked yet. */
export const questionsLeft = (state: Pick<GameState, 'asked'>, pool: PoolName = 'cull'): number =>
  questionsIn(pool).filter((question) => !state.asked.includes(question.id)).length;

/** Why the cull may not run another question, if it may not. */
export type CullOver = 'cullComplete' | 'queueEmpty' | null;

/**
 * The cull is adaptive (spec): it repeats until ten or fewer Players remain, or
 * until the bank cannot give it another question. Whichever way a round turned
 * out, asking for the next question is what decides.
 *
 * Before anything has been asked this is `null` however small the room is, so
 * the first question always goes up.
 */
export const cullOver = (state: Pick<GameState, 'roster' | 'asked'>, pool: PoolName = 'cull'): CullOver => {
  if (state.asked.length === 0) return null;
  if (survivors(state).length <= showConfig.cull.targetPlayers) return 'cullComplete';
  return questionsLeft(state, pool) === 0 ? 'queueEmpty' : null;
};

/** True when the Presenter should know the bank is nearly gone and the target
 *  is still unmet — the one moment a rehearsal fails for a reason nobody saw.
 *  A cull that has not started yet is not one of them: warning before the first
 *  question is noise in every show. */
export const cullLowOnQuestions = (state: Pick<GameState, 'roster' | 'asked'>): boolean =>
  state.asked.length > 0 &&
  cullOver(state) === null &&
  questionsLeft(state) <= showConfig.cull.queueWarning;

export type PresentPlan =
  | { outcome: 'presented'; event: Extract<GameEvent, { type: 'questionPresented' }> }
  | { outcome: 'notReady' }
  | { outcome: 'queueEmpty' }
  | { outcome: 'cullComplete' };

/**
 * The Presenter asks for a question; the machine picks it off the queue. Ticket
 * 01's lesson applies twice: an adapter that chose the question itself could
 * pick a spent one and never notice.
 *
 * A question may go up when the show is between questions — not while one is
 * open, because presenting over one would throw away the submissions sealed
 * against it, and not before the show has started. And not once the cull has
 * finished with the room; ticket 04 extends this to the bracket's own supply.
 */
export function planNextQuestion(state: GameState, at: number, pool?: PoolName): PresentPlan {
  if (state.phase === 'joining' || state.phase === 'answering' || state.phase === 'revealPending') {
    return { outcome: 'notReady' };
  }

  // Bracket questions
  if (state.bracket !== null) {
    if (state.bracket.finalistId !== null) return { outcome: 'cullComplete' };
    const nextBout = state.bracket.bouts.find(
      (b) => b.winnerId === null && b.player1Id !== null && b.player2Id !== null,
    );
    if (!nextBout) return { outcome: 'notReady' };

    const boutPool: PoolName = pool ?? 'bout';
    const next = questionsIn(boutPool).find((question) => !state.asked.includes(question.id));
    if (!next) return { outcome: 'queueEmpty' };

    return { outcome: 'presented', event: { type: 'questionPresented', questionId: next.id, at } };
  }

  // Cull questions
  const cullPool: PoolName = pool ?? 'cull';
  const over = cullOver(state, cullPool);
  if (over !== null) return { outcome: over };

  const next = questionsIn(cullPool).find((question) => !state.asked.includes(question.id));
  if (!next) return { outcome: 'queueEmpty' };

  return { outcome: 'presented', event: { type: 'questionPresented', questionId: next.id, at } };
}

/** The show's answer to a submission. The wording of each lives in content. */
export type AnswerOutcome = 'recorded' | 'alreadyAnswered' | 'windowClosed' | 'notPlaying' | 'notAnOption';

export type SubmitPlan =
  | { outcome: 'recorded'; event: Extract<GameEvent, { type: 'answerSubmitted' }> }
  | { outcome: Exclude<AnswerOutcome, 'recorded'> };

/**
 * A Player taps an option. The one-answer rule, the closed-window rule and the
 * "still in the show" rule are all here, so a socket that gets them wrong has
 * nowhere to get them right by accident.
 */
export function planSubmitAnswer(state: GameState, answer: { playerId: string; optionId: string }): SubmitPlan {
  const question = state.question;
  // An eliminated Player is not playing, so there is nothing for them to
  // submit to — which is also why the next round's survivors are a subset of
  // this round's, and why the cull cannot creep back up.
  const player = state.roster.find((candidate) => candidate.id === answer.playerId);
  if (!player || player.standing === 'out') return { outcome: 'notPlaying' };

  // In the bracket, only the two active Players in the current bout can submit
  if (state.bracket !== null && state.bracket.currentBoutId !== null) {
    const bout = state.bracket.bouts.find((b) => b.id === state.bracket!.currentBoutId);
    if (!bout || (bout.player1Id !== answer.playerId && bout.player2Id !== answer.playerId)) {
      return { outcome: 'notPlaying' };
    }
  }

  if (state.deck.active || state.phase !== 'answering' || !question) return { outcome: 'windowClosed' };
  if (!question.options.some((option) => option.id === answer.optionId)) return { outcome: 'notAnOption' };
  if (state.sealed.some((submission) => submission.playerId === answer.playerId)) {
    return { outcome: 'alreadyAnswered' };
  }

  return {
    outcome: 'recorded',
    event: { type: 'answerSubmitted', playerId: answer.playerId, optionId: answer.optionId },
  };
}

export type ClosePlan =
  | { outcome: 'closed'; event: Extract<GameEvent, { type: 'answerWindowClosed' }> }
  | { outcome: 'notOpen' };

/** The answer window closes on the adapter's clock. Whether it was open is the
 *  machine's to decide, so a timer that fires late cannot close a window that
 *  has already been revealed. */
export function planCloseAnswerWindow(state: GameState): ClosePlan {
  if (state.phase !== 'answering') return { outcome: 'notOpen' };

  return { outcome: 'closed', event: { type: 'answerWindowClosed' } };
}

export type RevealPlan =
  | { outcome: 'revealed'; event: Extract<GameEvent, { type: 'revealTriggered' }> }
  | { outcome: 'nothingToReveal' };

/**
 * The Presenter presses the reveal. It works exactly once, and only on a
 * question whose window has already closed: the room's suspense is the delay,
 * and a reveal that could fire early is not one.
 */
export function planReveal(state: GameState): RevealPlan {
  if (state.phase !== 'revealPending') return { outcome: 'nothingToReveal' };

  return { outcome: 'revealed', event: { type: 'revealTriggered' } };
}

/**
 * Seconds left in the answer window, never below zero. The machine reads no
 * clock, so the caller hands one in — which is what makes a ten-second window
 * assertable in microseconds.
 */
export function secondsLeft(askedAt: number, now: number): number {
  return Math.max(0, Math.ceil((showConfig.timings.answerSeconds * 1000 - (now - askedAt)) / 1000));
}

export type SeedPlan =
  | { outcome: 'seeded'; events: Extract<GameEvent, { type: 'playerJoined' }>[] }
  | { outcome: 'showStarted' }
  | { outcome: 'rosterFull' };

/**
 * A room of simulated Players, seeded rather than connected. Ticket 03's
 * Comments explain why: ADR-0004's guard means a socket that sends a `join`
 * loses every Presenter control, and from `started` onward the Presenter needs
 * those controls *while* driving this room. One socket cannot be both, so the
 * room is not made of sockets.
 */
export function planSimulatePlayers(state: GameState, count: number): SeedPlan {
  // Only before the show begins: a roster that changed under a running cull
  // would change the survivor set in front of the room.
  if (state.phase !== 'joining') return { outcome: 'showStarted' };

  const room = showConfig.playerCap - state.roster.length;
  const wanted = Math.min(Math.max(0, Math.floor(count)), room);
  if (wanted === 0) return { outcome: 'rosterFull' };

  return {
    outcome: 'seeded',
    events: Array.from({ length: wanted }, (_, offset) => ({
      type: 'playerJoined',
      playerId: `${showConfig.simulation.idPrefix}${state.roster.length + offset + 1}`,
      name: simulatedName(state.roster.length + offset),
      simulated: true,
    })),
  };
}

export type ClearPlan =
  | { outcome: 'cleared'; event: Extract<GameEvent, { type: 'simulatedPlayersCleared' }> }
  | { outcome: 'showStarted' };

/** The seeded roster goes, whole, and only before the show has begun. */
export function planClearSimulated(state: GameState): ClearPlan {
  if (state.phase !== 'joining') return { outcome: 'showStarted' };

  return { outcome: 'cleared', event: { type: 'simulatedPlayersCleared' } };
}

/** What a seeded Player does with the question in front of them. */
const simulatedOption = (
  mode: SimulationMode,
  index: number,
  correctId: string,
  wrongId: string | undefined,
): string | null => {
  if (mode === 'correct') return correctId;
  if (mode === 'wrong') return wrongId ?? null;
  // Mixed is right, wrong, silent, right, wrong, silent — by roster order, with
  // no randomness, so the same rehearsal replays the same way.
  return [correctId, wrongId ?? null, null][index % 3] ?? null;
};

export type AnswerPlan = { answers: Extract<GameEvent, { type: 'answerSubmitted' }>[] };

/**
 * What the seeded room does when a question goes up, and only then. Each answer
 * goes through `planSubmitAnswer` rather than around it, so the one-answer rule
 * and the closed window are the same rule for a seeded Player as for a phone —
 * there is no second door into the sealed list.
 */
export function planSimulateAnswers(state: GameState, mode: SimulationMode): AnswerPlan {
  const question = state.question;
  const bank = question ? findQuestion(question.id) : undefined;
  if (state.phase !== 'answering' || !question || !bank) return { answers: [] };

  const wrongId = question.options.find((option) => option.id !== bank.correctOptionId)?.id;
  const room = state.roster.filter((player) => player.simulated && player.standing === 'in');

  const answers = room.flatMap((player, index) => {
    const optionId = simulatedOption(mode, index, bank.correctOptionId, wrongId);
    if (optionId === null) return [];

    const plan = planSubmitAnswer(state, { playerId: player.id, optionId });
    return plan.outcome === 'recorded' ? [plan.event] : [];
  });

  return { answers };
}

export type TrimPlan =
  | { outcome: 'trimmed'; event: Extract<GameEvent, { type: 'cullTrimmed' }> }
  | { outcome: 'cullNotOver' }
  | { outcome: 'trimNotNeeded' }
  | { outcome: 'invalidCount' }
  | { outcome: 'invalidSurvivor' };

/** Presenters trim Cull survivors down to 8 to enter the bracket. */
export function planTrimCull(state: GameState, survivorIds: string[]): TrimPlan {
  if (cullOver(state) === null) return { outcome: 'cullNotOver' };
  const current = survivors(state);
  if (current.length <= 8) return { outcome: 'trimNotNeeded' };
  if (survivorIds.length !== 8) return { outcome: 'invalidCount' };

  const currentIds = new Set(current.map((p) => p.id));
  if (!survivorIds.every((id) => currentIds.has(id))) return { outcome: 'invalidSurvivor' };

  return {
    outcome: 'trimmed',
    event: { type: 'cullTrimmed', survivorIds },
  };
}

export type SeedBracketPlan =
  | { outcome: 'seeded'; event: Extract<GameEvent, { type: 'bracketSeeded' }> }
  | { outcome: 'alreadySeeded' }
  | { outcome: 'cullNotOver' }
  | { outcome: 'needsTrim'; count: number }
  | { outcome: 'noSurvivors' };

/** Seeds survivors into the single-elimination bracket using an injected PRNG or seed. */
export function planSeedBracket(
  state: GameState,
  generator?: number | (() => number),
): SeedBracketPlan {
  if (state.bracket !== null) return { outcome: 'alreadySeeded' };
  if (cullOver(state) === null) return { outcome: 'cullNotOver' };

  const current = survivors(state);
  if (current.length === 0) return { outcome: 'noSurvivors' };
  if (current.length > 8) return { outcome: 'needsTrim', count: current.length };

  const rng =
    typeof generator === 'function'
      ? generator
      : typeof generator === 'number'
        ? createRng(generator)
        : Math.random;

  const survivorIds = current.map((p) => p.id);
  const entrants = shuffle(survivorIds, rng);

  return {
    outcome: 'seeded',
    event: {
      type: 'bracketSeeded',
      entrants,
      ...(typeof generator === 'number' ? { seed: generator } : {}),
    },
  };
}

export type RerunPlan =
  | { outcome: 'rerun'; event: Extract<GameEvent, { type: 'boutRerun' }> }
  | { outcome: 'notInBout' }
  | { outcome: 'boutNotTied' };

/** Re-runs a bout when neither Player submitted. */
export function planRerunBout(state: GameState): RerunPlan {
  if (state.bracket === null || state.bracket.currentBoutId === null) return { outcome: 'notInBout' };
  const bout = state.bracket.bouts.find((b) => b.id === state.bracket!.currentBoutId);
  if (!bout || bout.winnerId !== null) return { outcome: 'boutNotTied' };
  if (state.phase !== 'revealed') return { outcome: 'notInBout' };

  return { outcome: 'rerun', event: { type: 'boutRerun' } };
}

export type ReversePlan =
  | { outcome: 'reversed'; event: Extract<GameEvent, { type: 'eliminationReversed' }> }
  | { outcome: 'unknownPlayer' }
  | { outcome: 'alreadyIn' };

/** Deliberate confirmed action to reverse a mistaken elimination. */
export function planReverseElimination(state: GameState, playerId: string): ReversePlan {
  const player = state.roster.find((p) => p.id === playerId);
  if (!player) return { outcome: 'unknownPlayer' };
  if (player.standing === 'in') return { outcome: 'alreadyIn' };

  return { outcome: 'reversed', event: { type: 'eliminationReversed', playerId } };
}

/** Currently active bout, or null if between bouts or bracket not started. */
export const activeBout = (state: Pick<GameState, 'bracket'>): Bout | null => {
  if (!state.bracket || !state.bracket.currentBoutId) return null;
  return state.bracket.bouts.find((b) => b.id === state.bracket!.currentBoutId) ?? null;
};

/** Whether a given Player is one of the two active Players in the current bout. */
export const isPlayerInCurrentBout = (state: Pick<GameState, 'bracket'>, playerId: string): boolean => {
  const current = activeBout(state);
  if (!current) return false;
  return current.player1Id === playerId || current.player2Id === playerId;
};

/** Draws a prize from the prize table using an injected PRNG or generator. */
export function drawKahonPrize(
  table: readonly Prize[] = kahonTable,
  rng: () => number = Math.random,
): Prize {
  const index = Math.floor(rng() * table.length);
  return table[index]!;
}

export type StartFinalePlan =
  | { outcome: 'started'; event: Extract<GameEvent, { type: 'finaleStarted' }> }
  | { outcome: 'noFinalist' }
  | { outcome: 'alreadyStarted' };

/** Presenter starts the Pera o Kahon finale for the crowned Finalist. */
export function planStartFinale(state: GameState, seed?: number): StartFinalePlan {
  if (!state.bracket || !state.bracket.finalistId) return { outcome: 'noFinalist' };
  if (state.finale !== null) return { outcome: 'alreadyStarted' };

  return {
    outcome: 'started',
    event: {
      type: 'finaleStarted',
      ...(typeof seed === 'number' ? { seed } : {}),
    },
  };
}

export type ChoosePeraPlan =
  | { outcome: 'chosen'; event: Extract<GameEvent, { type: 'peraChosen' }> }
  | { outcome: 'notInFinale' }
  | { outcome: 'alreadyChosen' };

/** Finalist (or Presenter on their behalf) chooses Pera (fixed voucher). */
export function planChoosePera(state: GameState): ChoosePeraPlan {
  if (state.finale === null) return { outcome: 'notInFinale' };
  if (state.finale.choice !== null) return { outcome: 'alreadyChosen' };

  return {
    outcome: 'chosen',
    event: { type: 'peraChosen' },
  };
}

export type ChooseKahonPlan =
  | { outcome: 'drawn'; event: Extract<GameEvent, { type: 'kahonDrawn' }> }
  | { outcome: 'notInFinale' }
  | { outcome: 'alreadyChosen' };

/** Finalist (or Presenter on their behalf) chooses the Kahon, drawing from the table via generator. */
export function planChooseKahon(
  state: GameState,
  generator?: number | (() => number),
): ChooseKahonPlan {
  if (state.finale === null) return { outcome: 'notInFinale' };
  if (state.finale.choice !== null) return { outcome: 'alreadyChosen' };

  const gen = generator ?? state.finale.seed;
  const rng =
    typeof gen === 'function'
      ? gen
      : typeof gen === 'number'
        ? createRng(gen)
        : Math.random;

  const prize = drawKahonPrize(kahonTable, rng);

  return {
    outcome: 'drawn',
    event: {
      type: 'kahonDrawn',
      prizeId: prize.id,
      ...(typeof gen === 'number' ? { seed: gen } : {}),
    },
  };
}

export type RevealKahonPlan =
  | { outcome: 'revealed'; event: Extract<GameEvent, { type: 'kahonRevealed' }> }
  | { outcome: 'notInFinale' }
  | { outcome: 'notDrawn' }
  | { outcome: 'alreadyRevealed' };

/** Presenter triggers the prop box reveal on Stage. */
export function planRevealKahon(state: GameState): RevealKahonPlan {
  if (state.finale === null) return { outcome: 'notInFinale' };
  if (state.finale.choice !== 'kahon' || state.finale.drawnPrizeId === null) return { outcome: 'notDrawn' };
  if (state.finale.revealed) return { outcome: 'alreadyRevealed' };

  return {
    outcome: 'revealed',
    event: { type: 'kahonRevealed' },
  };
}

export type OpenDeckPlan =
  | { outcome: 'opened'; event: Extract<GameEvent, { type: 'deckOpened' }> }
  | { outcome: 'alreadyOpen' };

/** Presenter switches the Stage into the Deck from any phase. */
export function planOpenDeck(state: GameState, slideIndex?: number): OpenDeckPlan {
  if (state.deck.active) return { outcome: 'alreadyOpen' };

  return {
    outcome: 'opened',
    event: {
      type: 'deckOpened',
      ...(slideIndex !== undefined ? { slideIndex } : {}),
    },
  };
}

export type CloseDeckPlan =
  | { outcome: 'closed'; event: Extract<GameEvent, { type: 'deckClosed' }> }
  | { outcome: 'notOpen' };

/** Presenter returns Stage from the Deck back to the interrupted game phase. */
export function planCloseDeck(state: GameState): CloseDeckPlan {
  if (!state.deck.active) return { outcome: 'notOpen' };

  return {
    outcome: 'closed',
    event: { type: 'deckClosed' },
  };
}

export type SetDeckSlidePlan =
  | { outcome: 'set'; event: Extract<GameEvent, { type: 'deckSlideSet' }> }
  | { outcome: 'invalidSlide' };

/** Presenter jumps directly to a specific slide in the Deck. */
export function planSetDeckSlide(state: GameState, slideIndex: number): SetDeckSlidePlan {
  if (slideIndex < 0 || slideIndex >= deckSlides.length) {
    return { outcome: 'invalidSlide' };
  }

  return {
    outcome: 'set',
    event: { type: 'deckSlideSet', slideIndex },
  };
}

export type SlideStepPlan =
  | { outcome: 'set'; event: Extract<GameEvent, { type: 'deckSlideSet' }> }
  | { outcome: 'atEdge' };

/** Presenter advances to the next Deck slide. */
export function planNextDeckSlide(state: GameState): SlideStepPlan {
  if (state.deck.slideIndex >= deckSlides.length - 1) return { outcome: 'atEdge' };

  return {
    outcome: 'set',
    event: { type: 'deckSlideSet', slideIndex: state.deck.slideIndex + 1 },
  };
}

/** Presenter steps back to the previous Deck slide. */
export function planPrevDeckSlide(state: GameState): SlideStepPlan {
  if (state.deck.slideIndex <= 0) return { outcome: 'atEdge' };

  return {
    outcome: 'set',
    event: { type: 'deckSlideSet', slideIndex: state.deck.slideIndex - 1 },
  };
}



