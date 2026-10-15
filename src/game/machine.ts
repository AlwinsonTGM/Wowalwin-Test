import type { GameEvent } from './events.ts';
import { questionBank, showConfig } from '../content/show.ts';

export type Player = {
  id: string;
  name: string;
  connected: boolean;
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

  return {
    ...state,
    phase: 'revealed',
    sealed: [],
    answer: {
      questionId: question.id,
      optionId: option.id,
      optionLabel: option.label,
      submissions: state.sealed,
    },
  };
};

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
        case 'questionPresented':
          return raise(state, event.questionId, event.at);
        case 'answerSubmitted':
          return { ...state, sealed: [...state.sealed, { playerId: event.playerId, optionId: event.optionId }] };
        case 'answerWindowClosed':
          return state.phase === 'answering' ? { ...state, phase: 'revealPending' } : state;
        case 'revealTriggered':
          return revealAnswer(state);
      }
    },
    { phase: 'joining', roster: [], asked: [], question: null, answer: null, sealed: [] },
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

export type PresentPlan =
  | { outcome: 'presented'; event: Extract<GameEvent, { type: 'questionPresented' }> }
  | { outcome: 'notReady' }
  | { outcome: 'queueEmpty' };

/**
 * The Presenter asks for a question; the machine picks it off the queue. Ticket
 * 01's lesson applies twice: an adapter that chose the question itself could
 * pick a spent one and never notice.
 *
 * A question may go up when the show is between questions — not while one is
 * open, because presenting over one would throw away the submissions sealed
 * against it, and not before the show has started.
 */
export function planNextQuestion(state: GameState, at: number): PresentPlan {
  if (state.phase === 'joining' || state.phase === 'answering' || state.phase === 'revealPending') {
    return { outcome: 'notReady' };
  }

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
 * A Player taps an option. The one-answer rule and the closed-window rule are
 * both here, so a socket that gets them wrong has nowhere to get them right by
 * accident.
 */
export function planSubmitAnswer(state: GameState, answer: { playerId: string; optionId: string }): SubmitPlan {
  const question = state.question;

  if (!state.roster.some((player) => player.id === answer.playerId)) return { outcome: 'notPlaying' };
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