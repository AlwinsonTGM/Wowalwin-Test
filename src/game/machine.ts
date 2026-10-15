import type { GameEvent, SimulationMode } from './events.ts';
import { questionBank, showConfig, simulatedName } from '../content/show.ts';

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
  const question = questionBank.find((candidate) => candidate.id === id);
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

const revealAnswer = (state: GameState): GameState => {
  const question = state.question;
  if (!question) return state;

  const bank = questionBank.find((candidate) => candidate.id === question.id);
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

  // The cull resolves in the same event that reveals the answer, which is what
  // makes the grid flip all at once: one event, one new state, every name.
  const answeredRight = new Set(
    state.sealed.filter((submission) => submission.optionId === option.id).map((submission) => submission.playerId),
  );

  return {
    ...state,
    phase: 'revealed',
    sealed: [],
    answer,
    // A correct submission survives and everyone else is out — which includes
    // every Player who never submitted, and every Player already out.
    roster: state.roster.map((player) => ({ ...player, standing: answeredRight.has(player.id) ? 'in' : 'out' })),
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
        case 'questionPresented':
          return raise(state, event.questionId, event.at);
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

/** Questions the show has not asked yet. */
export const questionsLeft = (state: Pick<GameState, 'asked'>): number =>
  questionBank.filter((question) => !state.asked.includes(question.id)).length;

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
export const cullOver = (state: Pick<GameState, 'roster' | 'asked'>): CullOver => {
  if (state.asked.length === 0) return null;
  if (survivors(state).length <= showConfig.cull.targetPlayers) return 'cullComplete';
  return questionsLeft(state) === 0 ? 'queueEmpty' : null;
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
export function planNextQuestion(state: GameState, at: number): PresentPlan {
  if (state.phase === 'joining' || state.phase === 'answering' || state.phase === 'revealPending') {
    return { outcome: 'notReady' };
  }

  const over = cullOver(state);
  if (over !== null) return { outcome: over };

  const next = questionBank.find((question) => !state.asked.includes(question.id));
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
  if (state.phase !== 'answering' || !question) return { outcome: 'windowClosed' };
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
  const bank = question ? questionBank.find((candidate) => candidate.id === question.id) : undefined;
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
