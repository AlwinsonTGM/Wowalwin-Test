import { describe, expect, it } from 'vitest';
import {
  activeBout,
  cullLowOnQuestions,
  cullOver,
  createRng,
  fold,
  isPlayerInCurrentBout,
  planClearSimulated,
  planCloseAnswerWindow,
  planJoin,
  planNextQuestion,
  planReveal,
  planResume,
  planRerunBout,
  planResolveBoutDirectly,
  planReverseElimination,
  planSeedBracket,
  planSimulateAnswers,
  planSimulatePlayers,
  planSubmitAnswer,
  planTrimCull,
  drawKahonPrize,
  planStartFinale,
  planChoosePera,
  planChooseKahon,
  planRevealKahon,
  planOpenDeck,
  planCloseDeck,
  planSetDeckSlide,
  planNextDeckSlide,
  planPrevDeckSlide,
  questionsLeft,
  secondsLeft,
  shown,
  survivors,
} from './machine.ts';
import type { GameEvent, SimulationMode } from './events.ts';
import { showConfig, simulatedName } from '../content/show.ts';
import { boutQuestions, cullQuestions, forPresenter } from '../content/questions.ts';
import { Pera, Bokya, kahonTable, findPrize, peso } from '../content/prizes.ts';
import { deckSlides, trimTools, entrepreneurs } from '../content/deck.ts';

const aPlayer = (id: string, name: string): GameEvent => ({ type: 'playerJoined', playerId: id, name });
const showStarted: GameEvent = { type: 'showStarted' };

/** The first question of the queue, going up at a fixed instant. */
const firstQuestion = (at = 1000): GameEvent => ({ type: 'questionPresented', questionId: cullQuestions[0]!.id, at });

// These tests read the bank from content rather than inventing questions, so
// they cannot drift from the wording the presenters actually ship. Two entries
// are needed to show the queue advancing; the throw says so out loud if the
// file ever stops having them.
const questionOne = cullQuestions[0];
const questionTwo = cullQuestions[1];
if (!questionOne || !questionTwo) throw new Error('the question bank needs two questions for these tests');

const readyToAsk = (...log: GameEvent[]) => fold([aPlayer('p1', 'Ana'), showStarted, ...log]);

const submits = (playerId: string, optionId: string): GameEvent => ({
  type: 'answerSubmitted',
  playerId,
  optionId,
});

const asking = (...log: GameEvent[]) => readyToAsk(firstQuestion(), ...log);

describe('the roster', () => {
  it('is empty before anyone joins', () => {
    expect(fold([])).toEqual({
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
    });
  });

  it('holds a Player who joins, in the show and from a real phone', () => {
    expect(fold([aPlayer('p1', 'Ana')]).roster).toEqual([
      { id: 'p1', name: 'Ana', connected: true, standing: 'in', simulated: false },
    ]);
  });

  it('keeps Players in the order they joined', () => {
    const state = fold([aPlayer('p1', 'Ana'), aPlayer('p2', 'Ben'), aPlayer('p3', 'Cara')]);

    expect(state.roster.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Cara']);
  });
});

describe('joining', () => {
  it('puts the Player on the roster and says they are in', () => {
    const { event } = planJoin(fold([]), { id: 'p1', name: 'Ana' });

    expect(fold([event!]).roster).toEqual([
      { id: 'p1', name: 'Ana', connected: true, standing: 'in', simulated: false },
    ]);
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
      { id: 'p1', name: 'Ana', connected: false, standing: 'in', simulated: false },
      { id: 'p2', name: 'Ben', connected: true, standing: 'in', simulated: false },
    ]);
  });

  it('reconnects to the same place, not a new one', () => {
    const log: GameEvent[] = [aPlayer('p1', 'Ana'), aPlayer('p2', 'Ben'), { type: 'playerDisconnected', playerId: 'p1' }];

    const state = fold([...log, { type: 'playerReconnected', playerId: 'p1' }]);

    expect(state.roster.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(state.roster.every((p) => p.connected)).toBe(true);
  });

  it('resumes a Player the show already knows, whatever name the phone now sends', () => {
    const plan = planResume(fold([aPlayer('p1', 'Ana')]), 'p1');

    expect(plan).toEqual({
      outcome: 'resumed',
      event: { type: 'playerReconnected', playerId: 'p1' },
    });
  });

  it('does not pretend to know a Player it has never seen', () => {
    expect(planResume(fold([]), 'p9').outcome).toBe('unknownPlayer');
  });

  it('ignores presence for a Player who was never on the roster', () => {
    const state = fold([aPlayer('p1', 'Ana'), { type: 'playerDisconnected', playerId: 'ghost' }]);

    expect(state.roster).toEqual([
      { id: 'p1', name: 'Ana', connected: true, standing: 'in', simulated: false },
    ]);
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
        { id: 'p1', name: 'Ana', connected: true, standing: 'in', simulated: false },
        { id: 'p2', name: 'Ben', connected: false, standing: 'in', simulated: false },
      ],
      asked: [],
      question: null,
      answer: null,
      sealed: [],
      simulation: { armed: false, mode: 'mixed' },
      bracket: null,
      finale: null,
      deck: { active: false, slideIndex: 0 },
    });
  });

  it('rebuilds a whole question from the log alone, with nothing but the events', () => {
    const log: GameEvent[] = [
      aPlayer('p1', 'Ana'),
      showStarted,
      firstQuestion(),
      submits('p1', questionOne.correctOptionId),
      { type: 'answerWindowClosed' },
      { type: 'revealTriggered' },
    ];

    // A server that restarts mid-question folds exactly this and nothing else.
    const midQuestion = fold(log.slice(0, 4));
    expect(midQuestion.phase).toBe('answering');
    expect(midQuestion.sealed).toHaveLength(1);

    expect(fold(log).answer?.optionId).toBe(questionOne.correctOptionId);
  });
});

describe('asking a question', () => {
  it('puts the question and its options on screen the moment it is presented', () => {
    const state = readyToAsk(firstQuestion());

    expect(state.phase).toBe('answering');
    expect(state.question).toEqual({
      id: questionOne.id,
      prompt: questionOne.prompt,
      options: questionOne.options.map(({ id, label }) => ({ id, label })),
      askedAt: 1000,
    });
  });

  it('never puts the answer on screen', () => {
    const state = readyToAsk(firstQuestion());

    // The room cannot be shown the correct answer by accident, because there
    // is nothing on the state that says which option is correct.
    expect(JSON.stringify(state)).not.toContain('correct');
    expect(state.answer).toBeNull();
  });

  it('takes the next question off the queue, never a spent one', () => {
    const plan = planNextQuestion(readyToAsk(), 2000);

    expect(plan).toEqual({
      outcome: 'presented',
      event: { type: 'questionPresented', questionId: questionOne.id, at: 2000 },
    });
  });

  it('cannot be asked before the show has started', () => {
    expect(planNextQuestion(fold([aPlayer('p1', 'Ana')]), 0).outcome).toBe('notReady');
  });

  it('cannot be asked on top of a question that is still open', () => {
    expect(planNextQuestion(asking(), 2000).outcome).toBe('notReady');
    expect(planNextQuestion(asking({ type: 'answerWindowClosed' }), 2000).outcome).toBe('notReady');
  });

  it('says so plainly when the queue is spent', () => {
    // Forty Players who keep eleven of their number alive: the bank runs
    // out before the target does, which is the one way the cull ends early that
    // is not its target being met.
    const log: GameEvent[] = [...aRoom(showConfig.playerCap)];
    for (const q of cullQuestions) {
      log.push({ type: 'questionPresented', questionId: q.id, at: 2000 }, ...rightOn(q, 11), ...closed);
    }
    const spent = fold(log);

    expect(spent.asked).toEqual(cullQuestions.map((q) => q.id));
    expect(survivors(spent)).toHaveLength(11);
    expect(planNextQuestion(spent, 3000).outcome).toBe('queueEmpty');
    expect(cullOver(spent)).toBe('queueEmpty');
  });

  it('ignores a question the content file does not have', () => {
    const log = [showStarted, { type: 'questionPresented', questionId: 'nope', at: 1 }] satisfies GameEvent[];

    expect(fold(log)).toEqual(fold([showStarted]));
  });
});

describe('an answer arriving', () => {
  const answer = questionOne.correctOptionId;
  const wrong = questionOne.options.find((option) => option.id !== answer)!.id;

  it('is recorded against the Player who sent it, in receipt order', () => {
    const state = asking(submits('p1', answer), submits('p2', wrong));

    expect(state.sealed).toEqual([
      { playerId: 'p1', optionId: answer },
      { playerId: 'p2', optionId: wrong },
    ]);
  });

  it('reaches no surface, because `shown` has nowhere to put it', () => {
    const state = asking(submits('p1', answer));

    // ADR-0003: the grading is the server's and the timing is the Presenters'.
    // One broadcast carries all three surfaces, so the rule cannot be a surface
    // choosing not to draw something. These five names are every field a surface
    // can ever be given, and none of them holds a submission.
    expect(Object.keys(shown(state)).sort()).toEqual([
      'answer',
      'asked',
      'bracket',
      'deck',
      'finale',
      'phase',
      'question',
      'roster',
      'simulation',
    ]);
    expect(shown(state).answer).toBeNull();
  });

  it('is taken once per question', () => {
    const state = asking();

    expect(planSubmitAnswer(state, { playerId: 'p1', optionId: answer }).outcome).toBe('recorded');
    expect(planSubmitAnswer(asking(submits('p1', answer)), { playerId: 'p1', optionId: wrong }).outcome).toBe(
      'alreadyAnswered',
    );
  });

  it('is refused from anyone who is not a Player', () => {
    expect(planSubmitAnswer(asking(), { playerId: 'ghost', optionId: answer }).outcome).toBe('notPlaying');
  });

  it('is refused for an option the question never offered', () => {
    expect(planSubmitAnswer(asking(), { playerId: 'p1', optionId: 'zzz' }).outcome).toBe('notAnOption');
  });
});

describe('the answer window', () => {
  it('closes on its own, and only from open', () => {
    expect(planCloseAnswerWindow(asking()).outcome).toBe('closed');
    expect(planCloseAnswerWindow(readyToAsk()).outcome).toBe('notOpen');
  });

  it('takes no submission once it has closed', () => {
    const closed = asking({ type: 'answerWindowClosed' });

    expect(closed.phase).toBe('revealPending');
    expect(planSubmitAnswer(closed, { playerId: 'p1', optionId: questionOne.correctOptionId }).outcome).toBe(
      'windowClosed',
    );
  });

  it('does not close twice, however late the clock says it is', () => {
    const closed = asking({ type: 'answerWindowClosed' }, { type: 'answerWindowClosed' });

    expect(closed.phase).toBe('revealPending');
  });

  it('is counted down by whoever holds a clock, not by the machine', () => {
    const askedAt = 1000;
    const end = askedAt + showConfig.timings.answerSeconds * 1000;

    expect(secondsLeft(askedAt, askedAt)).toBe(showConfig.timings.answerSeconds);
    expect(secondsLeft(askedAt, end - 1000)).toBe(1);
    expect(secondsLeft(askedAt, end)).toBe(0);
    expect(secondsLeft(askedAt, end + 60000)).toBe(0);
  });
});

describe('the reveal', () => {
  const answer = questionOne.correctOptionId;
  const label = questionOne.options.find((option) => option.id === answer)!.label;

  it('waits for the Presenter, and happens exactly once', () => {
    const pending = asking(submits('p1', answer), { type: 'answerWindowClosed' });

    expect(pending.phase).toBe('revealPending');
    expect(pending.answer).toBeNull();
    expect(planReveal(pending).outcome).toBe('revealed');
    expect(planReveal(asking({ type: 'answerWindowClosed' }, { type: 'revealTriggered' })).outcome).toBe(
      'nothingToReveal',
    );
  });

  it('cannot be pulled early, while the room is still answering', () => {
    expect(planReveal(asking()).outcome).toBe('nothingToReveal');
  });

  it('shows the room the correct answer, and publishes the submissions with it', () => {
    const revealed = asking(submits('p1', answer), { type: 'answerWindowClosed' }, { type: 'revealTriggered' });

    expect(revealed.phase).toBe('revealed');
    expect(revealed.answer).toEqual({
      questionId: questionOne.id,
      optionId: answer,
      optionLabel: label,
      submissions: [{ playerId: 'p1', optionId: answer }],
    });
    expect(revealed.sealed).toEqual([]);
  });

  it('agrees with what the Backbone read from the content file all along', () => {
    const revealed = asking({ type: 'answerWindowClosed' }, { type: 'revealTriggered' });

    expect(forPresenter(questionOne.id)?.answer).toBe(revealed.answer?.optionLabel);
  });

  it('tells the Backbone the answer and the line, and nothing else, before the reveal', () => {
    const held = forPresenter(questionOne.id);

    expect(held).toEqual({ answer: label, cue: questionOne.cue });
  });
});

const correctOf = questionOne.correctOptionId;
const wrongOf = questionOne.options.find((option) => option.id !== correctOf)!.id;

/** The first `count` Players answering `question` correctly. */
const rightOn = (question: (typeof cullQuestions)[number], count: number): GameEvent[] =>
  Array.from({ length: count }, (_, i) => submits(`p${i}`, question.correctOptionId));

/** Seeded Players `from`..`from + count - 1` answering question one correctly. */
const rightOnSimulated = (from: number, count: number): GameEvent[] =>
  Array.from({ length: count }, (_, i) =>
    submits(`${showConfig.simulation.idPrefix}${from + i}`, questionOne.correctOptionId),
  );

/** A room of `size` players who have all joined, with the Presenter's start. */
const aRoom = (size: number): GameEvent[] => [
  ...Array.from({ length: size }, (_, i) => aPlayer(`p${i}`, `Player ${i}`)),
  showStarted,
];

const closed: GameEvent[] = [{ type: 'answerWindowClosed' }, { type: 'revealTriggered' }];

/** One whole-room question and its reveal, where `got` says who answered right. */
const aRound = (size: number, got: boolean[], at: number): GameEvent[] => [
  ...aRoom(size),
  { type: 'questionPresented', questionId: questionOne.id, at },
  ...got.flatMap((right, i) => (right ? [submits(`p${i}`, correctOf)] : [])),
  ...closed,
];

/**
 * Runs the cull for as long as the machine will let it, asking for the next
 * question each round — the same thing a Presenter pressing the button does.
 * One `got` entry per round; the cull stops early when it reaches the target.
 *
 * Submissions go through `planSubmitAnswer` rather than being written straight
 * into the log, so every property below covers the whole path a real answer
 * takes and not just the fold's half of it.
 */
function runTheCull(size: number, rounds: boolean[][]) {
  let log: GameEvent[] = aRoom(size);
  let state = fold(log);
  const afterEachRound = [state];

  for (const [index, got] of rounds.entries()) {
    const next = planNextQuestion(state, index * 1000);
    if (next.outcome !== 'presented') break;

    log = [...log, next.event];
    for (const [player, right] of got.entries()) {
      // The answer key belongs to the question that is actually on screen, which
      // is not the same one on the first round: the queue moves on.
      const asked = fold(log).question;
      const bank = cullQuestions.find((candidate) => candidate.id === asked?.id);
      if (!bank) throw new Error('a question should be on screen by now');
      const plan = planSubmitAnswer(fold(log), {
        playerId: `p${player}`,
        optionId: right ? bank.correctOptionId : bank.options.find((option) => option.id !== bank.correctOptionId)!.id,
      });
      if (plan.outcome === 'recorded') log.push(plan.event);
    }
    log = [...log, ...closed];
    state = fold(log);
    afterEachRound.push(state);
  }

  return { state, afterEachRound };
}

/** The seeded room the Presenter builds to rehearse with. */
function seedRoom(size: number): Extract<GameEvent, { type: 'playerJoined' }>[] {
  const plan = planSimulatePlayers(fold([]), size);
  if (plan.outcome !== 'seeded') throw new Error(`seeding ${size} should work, not ${plan.outcome}`);
  return plan.events;
}

/** Drives the whole cull from a seeded room, answering `mode`, to its end. */
function driveTheSeededCull(size: number, mode: SimulationMode) {
  const log: GameEvent[] = [...seedRoom(size), showStarted];
  let state = fold(log);

  for (const round of cullQuestions.keys()) {
    const next = planNextQuestion(state, round * 1000);
    if (next.outcome !== 'presented') break;

    log.push(next.event, ...planSimulateAnswers(fold(log), mode).answers, ...closed);
    state = fold(log);
  }

  return state;
}

describe('the cull', () => {
  it('keeps only the Players who answered correctly', () => {
    const { state } = runTheCull(12, [[true, ...Array.from({ length: 11 }, () => false)]]);

    expect(survivors(state).map((player) => player.name)).toEqual(['Player 0']);
    expect(state.roster.map((player) => player.standing)).toEqual(['in', ...Array.from({ length: 11 }, () => 'out')]);
  });

  it('eliminates a wrong answer and a missing one alike', () => {
    const wrong: GameEvent = submits('p1', wrongOf);
    const state = fold([...aRound(3, [true, false, false], 0), wrong]);

    // p1 answered and was wrong, p2 never answered at all. Both are out, and the
    // cull makes no distinction between the two — which is the whole rule.
    expect(survivors(state).map((player) => player.id)).toEqual(['p0']);
    expect(state.roster.map((player) => player.standing)).toEqual(['in', 'out', 'out']);
  });

  it('flips the whole grid in one event, because the reveal is one event', () => {
    const before = fold([...aRoom(12), { type: 'questionPresented', questionId: questionOne.id, at: 0 }]);
    const after = fold([...aRoom(12), { type: 'questionPresented', questionId: questionOne.id, at: 0 }, ...closed]);

    expect(before.roster.every((player) => player.standing === 'in')).toBe(true);
    // Cull floor guarantee: nobody submitted, so the first joined player keeps their place
    expect(after.roster.filter((player) => player.standing === 'out')).toHaveLength(11);
    expect(survivors(after)).toHaveLength(1);
  });

  it('puts everyone in the show, from the moment they join', () => {
    expect(fold(aRoom(3)).roster.every((player) => player.standing === 'in')).toBe(true);
  });

  it('does not let an eliminated Player back in on the next question', () => {
    const { state } = runTheCull(12, [[true, ...Array.from({ length: 11 }, () => false)]]);
    const next: GameEvent = { type: 'questionPresented', questionId: questionTwo.id, at: 9000 };
    const asked = fold([...aRoom(12), firstQuestion(), ...closed, next]);

    expect(survivors(state)).toHaveLength(1);
    expect(planSubmitAnswer(asked, { playerId: 'p11', optionId: questionTwo.correctOptionId }).outcome).toBe(
      'notPlaying',
    );
  });

  it('repeats for as many questions as it takes, not a fixed number', () => {
    // Eleven correct out of twelve leaves eleven, which is still above the
    // target, so the second question goes up — and its two survivors finish it.
    const slow = fold([
      ...aRoom(12),
      firstQuestion(),
      ...rightOn(questionOne, 11),
      ...closed,
      { type: 'questionPresented', questionId: questionTwo.id, at: 9000 },
      ...rightOn(questionTwo, 2),
      ...closed,
    ]);
    expect(survivors(slow)).toHaveLength(2);
    expect(slow.asked).toHaveLength(2);

    // Ten correct reaches the target in one question, and asks for no second.
    const quick = fold([...aRoom(12), firstQuestion(), ...rightOn(questionOne, 10), ...closed]);
    expect(survivors(quick)).toHaveLength(showConfig.cull.targetPlayers);
    expect(planNextQuestion(quick, 9000).outcome).toBe('cullComplete');
  });

  it('stops once ten or fewer are left', () => {
    const done = runTheCull(12, [Array.from({ length: 11 }, (_, i) => i < 10)]).state;

    expect(survivors(done)).toHaveLength(showConfig.cull.targetPlayers);
    expect(cullOver(done)).toBe('cullComplete');
    expect(planNextQuestion(done, 9000).outcome).toBe('cullComplete');
  });

  it('has not stopped while the target is still unmet', () => {
    const running = runTheCull(12, [Array.from({ length: 11 }, (_, i) => i < 10)]).afterEachRound[0]!;

    expect(cullOver(running)).toBeNull();
    expect(planNextQuestion(running, 1000).outcome).toBe('presented');
  });

  it('warns about the queue only while the target is unmet', () => {
    // Ask until 1 question is left in the cull queue
    const askedQuestions = cullQuestions.slice(0, cullQuestions.length - 1);
    const log: GameEvent[] = [...aRoom(12)];
    for (const q of askedQuestions) {
      log.push({ type: 'questionPresented', questionId: q.id, at: 1000 }, ...rightOn(q, 11), ...closed);
    }
    const stillRunning = fold(log);

    expect(survivors(stillRunning)).toHaveLength(11);
    expect(cullOver(stillRunning)).toBeNull();
    expect(questionsLeft(stillRunning)).toBe(1);
    expect(cullLowOnQuestions(stillRunning)).toBe(true);

    // Target met: the warning would be noise now.
    const met = fold([...aRoom(12), firstQuestion(), ...rightOn(questionOne, 10), ...closed]);
    expect(cullLowOnQuestions(met)).toBe(false);

    // And a cull that has not begun yet is not a warning either.
    expect(cullLowOnQuestions(fold(aRoom(12)))).toBe(false);
  });
});

describe('the cull, whatever the room does', () => {
  /** Every subset of `size` Players who answered correctly, as a pattern. */
  const everyPattern = (size: number): boolean[][] =>
    Array.from({ length: 2 ** size }, (_, mask) => Array.from({ length: size }, (_, i) => (mask >> i) % 2 === 1));

  /** One round's worth: the first `correct` Players answer correctly. */
  const bigRoom = (size: number, correct: number): boolean[] =>
    Array.from({ length: size }, (_, i) => i < correct);

  it('always terminates: from every way one room can answer, the cull is over', () => {
    // Four is below the target, so one round is all it takes — which is exactly
    // the claim: no combination of answers leaves the cull with work to do.
    const SIZE = 4;
    const patterns = everyPattern(SIZE);
    const outcomes: number[] = [];

    for (const first of patterns) {
      const { state } = runTheCull(SIZE, [first]);
      outcomes.push(survivors(state).length);

      expect(cullOver(state)).not.toBeNull();
    }

    expect(outcomes).toHaveLength(patterns.length);
    expect(Math.max(...outcomes)).toBeLessThanOrEqual(SIZE);
  });

  it('terminates across rounds too, when the first round is not enough', () => {
    // Twelve is above the target, so the cull has to keep going — and a room
    // that keeps eleven alive runs out of questions with the target unmet
    // rather than stopping on it.
    const SIZE = 12;

    for (const kept of [SIZE, SIZE - 1]) {
      const { state } = runTheCull(
        SIZE,
        Array.from({ length: cullQuestions.length }, () => bigRoom(SIZE, kept)),
      );

      expect(cullOver(state)).toBe('queueEmpty');
      expect(survivors(state)).toHaveLength(kept);
      expect(state.asked).toHaveLength(cullQuestions.length);
    }
  });

  it('never grows, over every combination of a second round’s answers', () => {
    // The convergence property the spec is reaching for, as far as the cull can
    // carry it: an eliminated Player cannot answer, so each round's survivors
    // are a subset of the last round's. That shrinking is the only reason
    // "exactly one survivor" is reachable once the bracket runs on top of it.
    //
    // Two things make this bite. The room is above the target, so a second
    // question really happens rather than the cull finishing after one round.
    // And the second round offers an answer to *every* Player, the one the first
    // round put out included — if the machine let them back in, this is where it
    // would show: a name in the second round that was not in the first.
    const SIZE = 12;
    const first = bigRoom(SIZE, SIZE - 1);
    const counts: number[] = [];

    for (const second of everyPattern(SIZE)) {
      const { afterEachRound } = runTheCull(SIZE, [first, second]);
      const before = survivors(afterEachRound[1]!);
      const after = survivors(afterEachRound[2] ?? afterEachRound[1]!);

      expect(after.every((player) => before.some((was) => was.id === player.id))).toBe(true);
      expect(after.length).toBeLessThanOrEqual(before.length);
      counts.push(after.length);
    }

    // Every combination really was tried, and the eliminated Player was refused
    // every single time — which is why the biggest round is eleven, not twelve.
    // The cull floor guarantee ensures at least one survivor remains.
    expect(counts).toHaveLength(2 ** SIZE);
    expect(Math.min(...counts)).toBe(1);
    expect(Math.max(...counts)).toBe(SIZE - 1);
  });

  it('leaves nobody both in and out, whichever way the room answered', () => {
    for (const first of everyPattern(4)) {
      const { state } = runTheCull(4, [first]);

      const alive = survivors(state).map((player) => player.id);
      const out = state.roster.filter((player) => player.standing === 'out').map((player) => player.id);
      expect(alive.filter((id) => out.includes(id))).toEqual([]);
    }
  });

  it('ends in a number the bracket can start from, whichever way the room behaves', () => {
    for (const mode of ['correct', 'wrong', 'mixed'] satisfies SimulationMode[]) {
      const state = driveTheSeededCull(12, mode);

      expect(cullOver(state)).not.toBeNull();
      expect(survivors(state).length).toBeLessThanOrEqual(showConfig.cull.targetPlayers);
    }
  });
});

describe('the seeded roster', () => {
  it('puts a whole room on the roster in one ask', () => {
    const state = fold(seedRoom(12));

    expect(state.roster).toHaveLength(12);
    expect(state.roster.every((player) => player.simulated)).toBe(true);
    expect(new Set(state.roster.map((player) => player.name)).size).toBe(12);
  });

  it('never fills the room past the cap, whatever the Presenter asks for', () => {
    const oneShort = fold(Array.from({ length: showConfig.playerCap - 2 }, (_, i) => aPlayer(`p${i}`, `P${i}`)));
    const plan = planSimulatePlayers(oneShort, 40);

    expect(plan.outcome).toBe('seeded');
    if (plan.outcome !== 'seeded') return;
    expect(plan.events).toHaveLength(2);
    expect(planSimulatePlayers(oneShort, 0).outcome).toBe('rosterFull');
  });

  it('cannot be seeded once the show has begun, so the room cannot change under it', () => {
    expect(planSimulatePlayers(fold(aRoom(12)), 4).outcome).toBe('showStarted');
  });

  it('is torn down whole, leaving the real room untouched', () => {
    const real: GameEvent = aPlayer('real', 'Ana');
    const seeded = [...seedRoom(5)];
    const plan = planClearSimulated(fold([real, ...seeded]));

    expect(plan.outcome).toBe('cleared');
    if (plan.outcome !== 'cleared') return;
    expect(fold([real, ...seeded, plan.event]).roster.map((player) => player.id)).toEqual(['real']);
  });

  it('cannot be torn down once the show has begun', () => {
    expect(planClearSimulated(fold(aRoom(3))).outcome).toBe('showStarted');
  });

  it('takes its names from the content file, not from the server', () => {
    expect(seedRoom(3).map((event) => event.name)).toEqual([0, 1, 2].map((index) => simulatedName(index)));
  });
});

describe('a seeded room answering', () => {
  /** A seeded room with a question open and the answer window running. */
  const seededAndAsking = (size: number) => fold([...seedRoom(size), showStarted, firstQuestion()]);

  it('answers correctly when the round is an easy one', () => {
    const answers = planSimulateAnswers(seededAndAsking(12), 'correct').answers;

    expect(answers).toHaveLength(12);
    expect(answers.every((answer) => answer.optionId === correctOf)).toBe(true);
  });

  it('answers wrongly when the round is a hard one', () => {
    const answers = planSimulateAnswers(seededAndAsking(12), 'wrong').answers;

    expect(answers).toHaveLength(12);
    expect(answers.every((answer) => answer.optionId === wrongOf)).toBe(true);
  });

  it('leaves some silent in a mixed round, so the cull has non-submitters to judge', () => {
    const answers = planSimulateAnswers(seededAndAsking(12), 'mixed').answers;

    expect(answers.length).toBeLessThan(12);
    expect(answers.length).toBeGreaterThan(0);
  });

  it('answers once per Player, through the same rule a real phone is held to', () => {
    const answers = planSimulateAnswers(seededAndAsking(12), 'correct').answers;
    const ids = answers.map((answer) => answer.playerId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('repeats itself exactly, so a rehearsal replays the same way', () => {
    const first = planSimulateAnswers(seededAndAsking(12), 'mixed').answers;
    const second = planSimulateAnswers(seededAndAsking(12), 'mixed').answers;

    expect(first).toEqual(second);
  });

  it('says nothing at all when no question is open', () => {
    const shut = fold([...seedRoom(12), showStarted, firstQuestion(), { type: 'answerWindowClosed' }]);

    expect(planSimulateAnswers(shut, 'correct').answers).toEqual([]);
  });

  it('never answers for a Player who joined from a real phone', () => {
    const answers = planSimulateAnswers(fold([aPlayer('real', 'Ana'), ...seedRoom(3), showStarted, firstQuestion()]), 'correct').answers;

    expect(answers.map((answer) => answer.playerId)).not.toContain('real');
    expect(answers).toHaveLength(3);
  });

  it('never answers for a Player the last reveal put out', () => {
    const out = `${showConfig.simulation.idPrefix}1`;
    // The first seeded Player answers wrongly and is put out; the rest answer
    // correctly and survive, which is what leaves three to ask on question two.
    const asked = fold([
      ...seedRoom(4),
      showStarted,
      firstQuestion(),
      submits(out, wrongOf),
      ...rightOnSimulated(2, 3),
      ...closed,
      { type: 'questionPresented', questionId: questionTwo.id, at: 5000 },
    ]);
    expect(survivors(asked)).toHaveLength(3);

    const answers = planSimulateAnswers(asked, 'correct').answers;

    expect(answers.map((answer) => answer.playerId)).not.toContain(out);
    expect(answers).toHaveLength(3);
  });
});

describe('the bracket', () => {
  // Helper to construct a room of N players that has finished the Cull
  const finishCullWith = (count: number) => {
    const players = Array.from({ length: count }, (_, i) => aPlayer(`p${i + 1}`, `Player ${i + 1}`));
    const log: GameEvent[] = [
      ...players,
      showStarted,
      firstQuestion(),
      ...players.map((p) => submits((p as any).playerId, questionOne.correctOptionId)),
      ...closed,
    ];
    return fold(log);
  };

  describe('cull floor guarantee (ticket 03 amendment)', () => {
    it('spares the last submitter when everyone answered incorrectly on Cull reveal', () => {
      const players = [aPlayer('p1', 'Ana'), aPlayer('p2', 'Ben'), aPlayer('p3', 'Cara')];
      const wrongOption = questionOne.options.find((o) => o.id !== questionOne.correctOptionId)!.id;
      const state = fold([
        ...players,
        showStarted,
        firstQuestion(),
        submits('p1', wrongOption),
        submits('p2', wrongOption),
        submits('p3', wrongOption),
        ...closed,
      ]);

      // All answered wrong, but p3 was the last submitter
      expect(survivors(state)).toHaveLength(1);
      expect(survivors(state)[0]!.id).toBe('p3');
    });

    it('spares the first joined player still in when nobody submitted at all on Cull reveal', () => {
      const players = [aPlayer('p1', 'Ana'), aPlayer('p2', 'Ben'), aPlayer('p3', 'Cara')];
      const state = fold([
        ...players,
        showStarted,
        firstQuestion(),
        // Zero submissions
        ...closed,
      ]);

      // Nobody submitted, so p1 (first joined still in) survives
      expect(survivors(state)).toHaveLength(1);
      expect(survivors(state)[0]!.id).toBe('p1');
    });
  });

  describe('trimming the cull to eight', () => {
    it('trims > 8 survivors down to the chosen 8', () => {
      const state = finishCullWith(10);
      expect(survivors(state)).toHaveLength(10);

      const chosen8 = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
      const plan = planTrimCull(state, chosen8);
      expect(plan.outcome).toBe('trimmed');
      if (plan.outcome !== 'trimmed') return;

      const trimmed = fold([
        ...Array.from({ length: 10 }, (_, i) => aPlayer(`p${i + 1}`, `Player ${i + 1}`)),
        showStarted,
        firstQuestion(),
        ...Array.from({ length: 10 }, (_, i) => submits(`p${i + 1}`, questionOne.correctOptionId)),
        ...closed,
        plan.event,
      ]);

      expect(survivors(trimmed)).toHaveLength(8);
      expect(survivors(trimmed).map((p) => p.id)).toEqual(chosen8);
      expect(trimmed.roster.find((p) => p.id === 'p9')?.standing).toBe('out');
      expect(trimmed.roster.find((p) => p.id === 'p10')?.standing).toBe('out');
    });

    it('refuses to trim if there are 8 or fewer survivors', () => {
      const state = finishCullWith(8);
      const plan = planTrimCull(state, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
      expect(plan.outcome).toBe('trimNotNeeded');
    });

    it('refuses to trim if count is not exactly 8', () => {
      const state = finishCullWith(10);
      expect(planTrimCull(state, ['p1', 'p2', 'p3']).outcome).toBe('invalidCount');
      expect(planTrimCull(state, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']).outcome).toBe('invalidCount');
    });

    it('refuses if any chosen ID is not an active survivor', () => {
      const state = finishCullWith(10);
      expect(planTrimCull(state, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'unknown']).outcome).toBe('invalidSurvivor');
    });
  });

  describe('bracket seeding and PRNG', () => {
    it('refuses to seed before Cull is over', () => {
      const running = fold([aPlayer('p1', 'Ana'), aPlayer('p2', 'Ben'), showStarted]);
      expect(planSeedBracket(running).outcome).toBe('cullNotOver');
    });

    it('refuses to seed if more than 8 survivors remain (needs trim)', () => {
      const state = finishCullWith(10);
      expect(planSeedBracket(state)).toEqual({ outcome: 'needsTrim', count: 10 });
    });

    it('reproduces identical pairings with a pinned seed', () => {
      const state = finishCullWith(8);
      const plan1 = planSeedBracket(state, 12345);
      const plan2 = planSeedBracket(state, 12345);

      expect(plan1.outcome).toBe('seeded');
      expect(plan2.outcome).toBe('seeded');
      if (plan1.outcome === 'seeded' && plan2.outcome === 'seeded') {
        expect(plan1.event.entrants).toEqual(plan2.event.entrants);
        expect(plan1.event.seed).toBe(12345);
      }
    });

    it('seeds entrants into quarterfinal bouts and sets active bout', () => {
      const state = finishCullWith(8);
      const plan = planSeedBracket(state, 42);
      expect(plan.outcome).toBe('seeded');
      if (plan.outcome !== 'seeded') return;

      const seeded = fold([
        ...Array.from({ length: 8 }, (_, i) => aPlayer(`p${i + 1}`, `Player ${i + 1}`)),
        showStarted,
        firstQuestion(),
        ...Array.from({ length: 8 }, (_, i) => submits(`p${i + 1}`, questionOne.correctOptionId)),
        ...closed,
        plan.event,
      ]);

      expect(seeded.bracket).not.toBeNull();
      expect(seeded.bracket!.bouts).toHaveLength(7);
      expect(seeded.bracket!.currentBoutId).toBe('bout-1');
      expect(activeBout(seeded)?.id).toBe('bout-1');
    });

    it('symmetrically places byes when fewer than 8 players advance', () => {
      // 5 survivors -> 3 byes in QF
      const state = finishCullWith(5);
      const plan = planSeedBracket(state, 99);
      expect(plan.outcome).toBe('seeded');
      if (plan.outcome !== 'seeded') return;

      const seeded = fold([
        ...Array.from({ length: 5 }, (_, i) => aPlayer(`p${i + 1}`, `Player ${i + 1}`)),
        showStarted,
        firstQuestion(),
        ...Array.from({ length: 5 }, (_, i) => submits(`p${i + 1}`, questionOne.correctOptionId)),
        ...closed,
        plan.event,
      ]);

      expect(seeded.bracket).not.toBeNull();
      // Byes automatically advance to semifinals
      const qfBouts = seeded.bracket!.bouts.filter((b) => b.round === 'quarter');
      const byeBouts = qfBouts.filter((b) => b.resolvedBy === 'bye');
      expect(byeBouts.length).toBe(3);
    });
  });

  describe('bout submission constraints', () => {
    it('restricts submissions to only the 2 active bout players', () => {
      const state = finishCullWith(8);
      const plan = planSeedBracket(state, 42);
      if (plan.outcome !== 'seeded') throw new Error('seeding failed');

      const seeded = fold([
        ...Array.from({ length: 8 }, (_, i) => aPlayer(`p${i + 1}`, `Player ${i + 1}`)),
        showStarted,
        firstQuestion(),
        ...Array.from({ length: 8 }, (_, i) => submits(`p${i + 1}`, questionOne.correctOptionId)),
        ...closed,
        plan.event,
      ]);

      const bout = activeBout(seeded)!;
      const b1 = boutQuestions[0]!;
      const askingBout = fold([
        ...Array.from({ length: 8 }, (_, i) => aPlayer(`p${i + 1}`, `Player ${i + 1}`)),
        showStarted,
        firstQuestion(),
        ...Array.from({ length: 8 }, (_, i) => submits(`p${i + 1}`, questionOne.correctOptionId)),
        ...closed,
        plan.event,
        { type: 'questionPresented', questionId: b1.id, at: 1000 },
      ]);

      // Fighter 1 can submit
      expect(planSubmitAnswer(askingBout, { playerId: bout.player1Id!, optionId: 'a' }).outcome).toBe('recorded');
      // Fighter 2 can submit
      expect(planSubmitAnswer(askingBout, { playerId: bout.player2Id!, optionId: 'a' }).outcome).toBe('recorded');

      // Player waiting in bracket cannot submit
      const waitingPlayerId = seeded.roster.find((p) => p.id !== bout.player1Id && p.id !== bout.player2Id)!.id;
      expect(planSubmitAnswer(askingBout, { playerId: waitingPlayerId, optionId: 'a' }).outcome).toBe('notPlaying');
    });
  });

  describe('bout resolution rules', () => {
    const setupBout = () => {
      const state = finishCullWith(8);
      const seedPlan = planSeedBracket(state, 42);
      if (seedPlan.outcome !== 'seeded') throw new Error('seeding failed');

      const baseLog: GameEvent[] = [
        ...Array.from({ length: 8 }, (_, i) => aPlayer(`p${i + 1}`, `Player ${i + 1}`)),
        showStarted,
        firstQuestion(),
        ...Array.from({ length: 8 }, (_, i) => submits(`p${i + 1}`, questionOne.correctOptionId)),
        ...closed,
        seedPlan.event,
      ];

      const seeded = fold(baseLog);
      const bout = activeBout(seeded)!;
      const bQuestion = boutQuestions[0]!;
      const correctOpt = bQuestion.correctOptionId;
      const wrongOpt = bQuestion.options.find((o) => o.id !== correctOpt)!.id;

      return { baseLog, bout, bQuestion, correctOpt, wrongOpt };
    };

    it('earliest correct wins even if opponent submitted earlier and wrong', () => {
      const { baseLog, bout, bQuestion, correctOpt, wrongOpt } = setupBout();
      const p1 = bout.player1Id!;
      const p2 = bout.player2Id!;

      // p1 submits wrong at t=100, p2 submits correct at t=200
      const resolved = fold([
        ...baseLog,
        { type: 'questionPresented', questionId: bQuestion.id, at: 1000 },
        submits(p1, wrongOpt),
        submits(p2, correctOpt),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
      ]);

      const boutAfter = resolved.bracket!.bouts.find((b) => b.id === bout.id)!;
      expect(boutAfter.winnerId).toBe(p2);
      expect(resolved.roster.find((p) => p.id === p2)?.standing).toBe('in');
      expect(resolved.roster.find((p) => p.id === p1)?.standing).toBe('out');
    });

    it('earliest correct wins when both answer correctly', () => {
      const { baseLog, bout, bQuestion, correctOpt } = setupBout();
      const p1 = bout.player1Id!;
      const p2 = bout.player2Id!;

      // p1 submits correct first, p2 submits correct second
      const resolved = fold([
        ...baseLog,
        { type: 'questionPresented', questionId: bQuestion.id, at: 1000 },
        submits(p1, correctOpt),
        submits(p2, correctOpt),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
      ]);

      const boutAfter = resolved.bracket!.bouts.find((b) => b.id === bout.id)!;
      expect(boutAfter.winnerId).toBe(p1);
      expect(resolved.roster.find((p) => p.id === p1)?.standing).toBe('in');
      expect(resolved.roster.find((p) => p.id === p2)?.standing).toBe('out');
    });

    it('correct wins when opponent never submitted', () => {
      const { baseLog, bout, bQuestion, correctOpt } = setupBout();
      const p1 = bout.player1Id!;
      const p2 = bout.player2Id!;

      // p2 submits correct, p1 is silent
      const resolved = fold([
        ...baseLog,
        { type: 'questionPresented', questionId: bQuestion.id, at: 1000 },
        submits(p2, correctOpt),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
      ]);

      const boutAfter = resolved.bracket!.bouts.find((b) => b.id === bout.id)!;
      expect(boutAfter.winnerId).toBe(p2);
      expect(resolved.roster.find((p) => p.id === p1)?.standing).toBe('out');
    });

    it('eliminates earliest submitter when all submitted answers are wrong', () => {
      const { baseLog, bout, bQuestion, wrongOpt } = setupBout();
      const p1 = bout.player1Id!;
      const p2 = bout.player2Id!;

      // p1 submits wrong first, p2 submits wrong second
      // Rule: earliest submitter is eliminated, other advances
      const resolved = fold([
        ...baseLog,
        { type: 'questionPresented', questionId: bQuestion.id, at: 1000 },
        submits(p1, wrongOpt),
        submits(p2, wrongOpt),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
      ]);

      const boutAfter = resolved.bracket!.bouts.find((b) => b.id === bout.id)!;
      expect(boutAfter.winnerId).toBe(p2);
      expect(resolved.roster.find((p) => p.id === p1)?.standing).toBe('out');
      expect(resolved.roster.find((p) => p.id === p2)?.standing).toBe('in');
    });

    it('eliminates wrong submitter when only one submitted and was wrong', () => {
      const { baseLog, bout, bQuestion, wrongOpt } = setupBout();
      const p1 = bout.player1Id!;
      const p2 = bout.player2Id!;

      // p1 submits wrong, p2 never submitted
      // Rule: earliest submitter eliminated, other advances
      const resolved = fold([
        ...baseLog,
        { type: 'questionPresented', questionId: bQuestion.id, at: 1000 },
        submits(p1, wrongOpt),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
      ]);

      const boutAfter = resolved.bracket!.bouts.find((b) => b.id === bout.id)!;
      expect(boutAfter.winnerId).toBe(p2);
      expect(resolved.roster.find((p) => p.id === p1)?.standing).toBe('out');
      expect(resolved.roster.find((p) => p.id === p2)?.standing).toBe('in');
    });

    it('nobody is eliminated when neither player submitted; operator re-runs bout', () => {
      const { baseLog, bout, bQuestion } = setupBout();
      const p1 = bout.player1Id!;
      const p2 = bout.player2Id!;

      // Neither submits
      const resolved = fold([
        ...baseLog,
        { type: 'questionPresented', questionId: bQuestion.id, at: 1000 },
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
      ]);

      const boutAfter = resolved.bracket!.bouts.find((b) => b.id === bout.id)!;
      expect(boutAfter.winnerId).toBeNull();
      expect(resolved.roster.find((p) => p.id === p1)?.standing).toBe('in');
      expect(resolved.roster.find((p) => p.id === p2)?.standing).toBe('in');

      // Operator re-runs bout
      const rerunPlan = planRerunBout(resolved);
      expect(rerunPlan.outcome).toBe('rerun');
      if (rerunPlan.outcome !== 'rerun') return;

      const rerunning = fold([
        ...baseLog,
        { type: 'questionPresented', questionId: bQuestion.id, at: 1000 },
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
        rerunPlan.event,
      ]);

      expect(rerunning.phase).toBe('started');
      expect(rerunning.question).toBeNull();
      expect(activeBout(rerunning)?.id).toBe(bout.id);
    });
  });

  describe('bracket progression and convergence to single Finalist', () => {
    it('advances through 7 bouts step by step to crown 1 Finalist', () => {
      const state = finishCullWith(8);
      const seedPlan = planSeedBracket(state, 42);
      if (seedPlan.outcome !== 'seeded') throw new Error('seeding failed');

      const log: GameEvent[] = [
        ...Array.from({ length: 8 }, (_, i) => aPlayer(`p${i + 1}`, `Player ${i + 1}`)),
        showStarted,
        firstQuestion(),
        ...Array.from({ length: 8 }, (_, i) => submits(`p${i + 1}`, questionOne.correctOptionId)),
        ...closed,
        seedPlan.event,
      ];

      for (let i = 0; i < 7; i++) {
        const curState = fold(log);
        const presPlan = planNextQuestion(curState, Date.now());
        expect(presPlan.outcome).toBe('presented');
        if (presPlan.outcome !== 'presented') break;
        log.push(presPlan.event);

        const afterAsk = fold(log);
        const bout = activeBout(afterAsk)!;
        const q = boutQuestions.find((candidate) => candidate.id === presPlan.event.questionId)!;

        // Fighter 1 submits correct answer
        log.push(submits(bout.player1Id!, q.correctOptionId));
        log.push({ type: 'answerWindowClosed' });
        log.push({ type: 'revealTriggered' });
      }

      const finalState = fold(log);
      expect(finalState.bracket?.finalistId).not.toBeNull();
      expect(survivors(finalState)).toHaveLength(1);
      expect(survivors(finalState)[0]!.id).toBe(finalState.bracket?.finalistId);
      expect(finalState.roster.filter((p) => p.standing === 'out')).toHaveLength(7);
      expect(planNextQuestion(finalState, Date.now()).outcome).toBe('cullComplete');
    });
  });

  describe('deliberate confirmed elimination reversal', () => {
    it('reverses mistaken elimination, restores player, and rolls back bracket propagation', () => {
      const state = finishCullWith(8);
      const seedPlan = planSeedBracket(state, 42);
      if (seedPlan.outcome !== 'seeded') throw new Error('seeding failed');

      const log: GameEvent[] = [
        ...Array.from({ length: 8 }, (_, i) => aPlayer(`p${i + 1}`, `Player ${i + 1}`)),
        showStarted,
        firstQuestion(),
        ...Array.from({ length: 8 }, (_, i) => submits(`p${i + 1}`, questionOne.correctOptionId)),
        ...closed,
        seedPlan.event,
      ];

      const curState = fold(log);
      const presPlan = planNextQuestion(curState, Date.now()) as Extract<ReturnType<typeof planNextQuestion>, { outcome: 'presented' }>;
      log.push(presPlan.event);

      const asked = fold(log);
      const bout = activeBout(asked)!;
      const p1 = bout.player1Id!;
      const p2 = bout.player2Id!;
      const q = boutQuestions.find((candidate) => candidate.id === presPlan.event.questionId)!;

      // p1 submits correct and mistakenly wins, p2 eliminated
      log.push(submits(p1, q.correctOptionId));
      log.push({ type: 'answerWindowClosed' });
      log.push({ type: 'revealTriggered' });

      const resolved = fold(log);
      expect(resolved.roster.find((p) => p.id === p2)?.standing).toBe('out');

      // Operator reverses elimination of p2
      const revPlan = planReverseElimination(resolved, p2);
      expect(revPlan.outcome).toBe('reversed');
      if (revPlan.outcome !== 'reversed') return;

      log.push(revPlan.event);
      const reversed = fold(log);

      // p2 is restored to 'in'
      expect(reversed.roster.find((p) => p.id === p2)?.standing).toBe('in');
      // Bout 1 is reset
      const resetBout = reversed.bracket!.bouts.find((b) => b.id === bout.id)!;
      expect(resetBout.winnerId).toBeNull();
      // Active bout points back to Bout 1
      expect(activeBout(reversed)?.id).toBe(bout.id);
    });
  });

  describe('Pera o Kahon (Ticket 05 finale)', () => {
    const setupFinalist = () => {
      const crownedLog: GameEvent[] = [
        aPlayer('p1', 'Ana'),
        aPlayer('p2', 'Ben'),
        showStarted,
        firstQuestion(),
        submits('p1', questionOne.correctOptionId),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
        { type: 'bracketSeeded', entrants: ['p1', 'p2'] },
        { type: 'questionPresented', questionId: boutQuestions[0]!.id, at: 2000 },
        submits('p1', boutQuestions[0]!.correctOptionId),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
      ];
      const crownedState = fold(crownedLog);
      return { crownedLog, crownedState };
    };

    it('requires a crowned Finalist to start the finale', () => {
      const unstarted = fold([aPlayer('p1', 'Ana'), showStarted]);
      expect(planStartFinale(unstarted).outcome).toBe('noFinalist');

      const { crownedLog, crownedState } = setupFinalist();
      expect(crownedState.bracket?.finalistId).toBe('p1');

      const startPlan = planStartFinale(crownedState);
      expect(startPlan.outcome).toBe('started');
      if (startPlan.outcome !== 'started') return;

      const finaleState = fold([...crownedLog, startPlan.event]);
      expect(planStartFinale(finaleState).outcome).toBe('alreadyStarted');
    });

    it('offers the Finalist a clear choice between Pera and Kahon', () => {
      const { crownedState } = setupFinalist();
      const startPlan = planStartFinale(crownedState);
      if (startPlan.outcome !== 'started') throw new Error('finale failed to start');

      const stateInFinale = fold([...crownedState.roster.map((p) => aPlayer(p.id, p.name)), showStarted, startPlan.event]);
      expect(stateInFinale.finale).not.toBeNull();
      expect(stateInFinale.finale!.choice).toBeNull();
      expect(stateInFinale.finale!.drawnPrizeId).toBeNull();
      expect(stateInFinale.finale!.revealed).toBe(false);
    });

    it('resolves choosing Pera to the fixed small guaranteed voucher', () => {
      const { crownedState } = setupFinalist();
      const startPlan = planStartFinale(crownedState);
      if (startPlan.outcome !== 'started') throw new Error('finale failed to start');

      const stateInFinale = fold([...crownedState.roster.map((p) => aPlayer(p.id, p.name)), showStarted, startPlan.event]);

      const choosePeraPlan = planChoosePera(stateInFinale);
      expect(choosePeraPlan.outcome).toBe('chosen');
      if (choosePeraPlan.outcome !== 'chosen') return;

      const peraState = fold([
        ...crownedState.roster.map((p) => aPlayer(p.id, p.name)),
        showStarted,
        startPlan.event,
        choosePeraPlan.event,
      ]);

      expect(peraState.finale!.choice).toBe('pera');
      expect(peraState.finale!.drawnPrizeId).toBe(Pera.id);
      expect(peraState.finale!.revealed).toBe(true);

      const prize = findPrize(peraState.finale!.drawnPrizeId!);
      expect(prize).toEqual(Pera);
      expect(prize!.value).toBe(50);
      expect(peso(prize!.value)).toBe('₱50');

      expect(planChoosePera(peraState).outcome).toBe('alreadyChosen');
      expect(planChooseKahon(peraState).outcome).toBe('alreadyChosen');
    });

    it('draws from kahonTable using an injected generator rather than an unseeded random source', () => {
      const { crownedState } = setupFinalist();
      const startPlan = planStartFinale(crownedState);
      if (startPlan.outcome !== 'started') throw new Error('finale failed to start');

      const stateInFinale = fold([...crownedState.roster.map((p) => aPlayer(p.id, p.name)), showStarted, startPlan.event]);

      const choosePlan1 = planChooseKahon(stateInFinale, () => 0.0);
      expect(choosePlan1.outcome).toBe('drawn');
      if (choosePlan1.outcome !== 'drawn') return;
      expect(choosePlan1.event.prizeId).toBe(kahonTable[0]!.id);

      const expectedIndex = Math.floor(0.5 * kahonTable.length);
      const choosePlan2 = planChooseKahon(stateInFinale, () => 0.5);
      expect(choosePlan2.outcome).toBe('drawn');
      if (choosePlan2.outcome !== 'drawn') return;
      expect(choosePlan2.event.prizeId).toBe(kahonTable[expectedIndex]!.id);
    });

    it('reproduces the exact same draw on every run with a pinned seed', () => {
      const { crownedState } = setupFinalist();
      const startPlan = planStartFinale(crownedState);
      if (startPlan.outcome !== 'started') throw new Error('finale failed to start');

      const stateInFinale = fold([...crownedState.roster.map((p) => aPlayer(p.id, p.name)), showStarted, startPlan.event]);

      const SEED = 98765;
      const planA = planChooseKahon(stateInFinale, SEED);
      const planB = planChooseKahon(stateInFinale, SEED);

      expect(planA.outcome).toBe('drawn');
      expect(planB.outcome).toBe('drawn');
      if (planA.outcome !== 'drawn' || planB.outcome !== 'drawn') return;

      expect(planA.event.prizeId).toBe(planB.event.prizeId);
      expect(planA.event.seed).toBe(SEED);
    });

    it('makes Bokya reachable as a genuine outcome from the table', () => {
      const { crownedState } = setupFinalist();
      const startPlan = planStartFinale(crownedState);
      if (startPlan.outcome !== 'started') throw new Error('finale failed to start');

      const stateInFinale = fold([...crownedState.roster.map((p) => aPlayer(p.id, p.name)), showStarted, startPlan.event]);

      const bokyaPlan = planChooseKahon(stateInFinale, () => 0.95);
      expect(bokyaPlan.outcome).toBe('drawn');
      if (bokyaPlan.outcome !== 'drawn') return;

      expect(bokyaPlan.event.prizeId).toBe(Bokya.id);
      const prize = findPrize(bokyaPlan.event.prizeId);
      expect(prize).toEqual(Bokya);
      expect(prize!.value).toBe(0);
    });

    it('keeps the drawn prize unrevealed until the operator triggers the reveal', () => {
      const { crownedState } = setupFinalist();
      const startPlan = planStartFinale(crownedState);
      if (startPlan.outcome !== 'started') throw new Error('finale failed to start');

      const stateInFinale = fold([...crownedState.roster.map((p) => aPlayer(p.id, p.name)), showStarted, startPlan.event]);
      const drawPlan = planChooseKahon(stateInFinale, () => 0.2);
      if (drawPlan.outcome !== 'drawn') throw new Error('draw failed');

      const drawnState = fold([
        ...crownedState.roster.map((p) => aPlayer(p.id, p.name)),
        showStarted,
        startPlan.event,
        drawPlan.event,
      ]);

      expect(drawnState.finale!.drawnPrizeId).toBe(drawPlan.event.prizeId);
      expect(drawnState.finale!.revealed).toBe(false);

      const revealPlan = planRevealKahon(drawnState);
      expect(revealPlan.outcome).toBe('revealed');
      if (revealPlan.outcome !== 'revealed') return;

      const revealedState = fold([
        ...crownedState.roster.map((p) => aPlayer(p.id, p.name)),
        showStarted,
        startPlan.event,
        drawPlan.event,
        revealPlan.event,
      ]);

      expect(revealedState.finale!.revealed).toBe(true);
      expect(planRevealKahon(revealedState).outcome).toBe('alreadyRevealed');
    });

    it('reconstructs the entire finale deterministically from the pure event log', () => {
      const log: GameEvent[] = [
        aPlayer('p1', 'Ana'),
        aPlayer('p2', 'Ben'),
        showStarted,
        firstQuestion(),
        submits('p1', questionOne.correctOptionId),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
        { type: 'bracketSeeded', entrants: ['p1', 'p2'] },
        { type: 'questionPresented', questionId: boutQuestions[0]!.id, at: 2000 },
        submits('p1', boutQuestions[0]!.correctOptionId),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
        { type: 'finaleStarted' },
        { type: 'kahonDrawn', prizeId: 'kahon-4' },
        { type: 'kahonRevealed' },
      ];

      const finalState = fold(log);
      expect(finalState.finale).toEqual({
        choice: 'kahon',
        drawnPrizeId: 'kahon-4',
        revealed: true,
      });
      const prize = findPrize(finalState.finale!.drawnPrizeId!);
      expect(prize!.label).toBe('Isang libre para sa merienda');
      expect(prize!.value).toBe(100);
    });
  });

  describe('the deck (HTML slides & live safety net)', () => {
    it('runs on its own with no dependency on Cull, Bracket, or Finale completion', () => {
      const state = fold([]);
      expect(state.phase).toBe('joining');
      expect(state.deck).toEqual({ active: false, slideIndex: 0 });

      const plan = planOpenDeck(state);
      expect(plan.outcome).toBe('opened');
      if (plan.outcome !== 'opened') throw new Error('plan failed');
      const opened = fold([plan.event]);
      expect(opened.deck.active).toBe(true);
      expect(opened.deck.slideIndex).toBe(0);
      expect(opened.phase).toBe('joining');
    });

    it('can switch into the deck from ANY phase, including while a question is running', () => {
      // 1. Joining phase
      const sJoin = fold([]);
      expect(planOpenDeck(sJoin).outcome).toBe('opened');

      // 2. Answering phase (question is actively running!)
      const sAnswering = fold([aPlayer('p1', 'Ana'), showStarted, firstQuestion(1000)]);
      expect(sAnswering.phase).toBe('answering');
      expect(sAnswering.question).not.toBeNull();
      const planFromAnswering = planOpenDeck(sAnswering);
      expect(planFromAnswering.outcome).toBe('opened');
      if (planFromAnswering.outcome !== 'opened') throw new Error('plan failed');
      const openDuringAnswering = fold([
        aPlayer('p1', 'Ana'),
        showStarted,
        firstQuestion(1000),
        planFromAnswering.event,
      ]);
      expect(openDuringAnswering.deck.active).toBe(true);
      expect(openDuringAnswering.deck.previousPhase).toBe('answering');
      expect(openDuringAnswering.phase).toBe('answering');
      expect(openDuringAnswering.question?.id).toBe(cullQuestions[0]!.id);

      // 3. Reveal pending phase
      const sRevealPending = fold([aPlayer('p1', 'Ana'), showStarted, firstQuestion(1000), { type: 'answerWindowClosed' }]);
      expect(planOpenDeck(sRevealPending).outcome).toBe('opened');

      // 4. Bracket phase
      const sBracket = fold([
        aPlayer('p1', 'Ana'),
        aPlayer('p2', 'Ben'),
        showStarted,
        firstQuestion(1000),
        submits('p1', questionOne.correctOptionId),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
        { type: 'bracketSeeded', entrants: ['p1', 'p2'] },
      ]);
      expect(sBracket.bracket).not.toBeNull();
      expect(planOpenDeck(sBracket).outcome).toBe('opened');

      // 5. Finale phase
      const sFinale = fold([
        aPlayer('p1', 'Ana'),
        aPlayer('p2', 'Ben'),
        showStarted,
        firstQuestion(1000),
        submits('p1', questionOne.correctOptionId),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
        { type: 'bracketSeeded', entrants: ['p1', 'p2'] },
        { type: 'questionPresented', questionId: boutQuestions[0]!.id, at: 2000 },
        submits('p1', boutQuestions[0]!.correctOptionId),
        { type: 'answerWindowClosed' },
        { type: 'revealTriggered' },
        { type: 'finaleStarted' },
      ]);
      expect(sFinale.finale).not.toBeNull();
      expect(planOpenDeck(sFinale).outcome).toBe('opened');
    });

    it('returns Stage to whatever phase the deck interrupted and game resumes where it left off', () => {
      // Question running with a submission
      const stateBeforeDeck = fold([
        aPlayer('p1', 'Ana'),
        aPlayer('p2', 'Ben'),
        showStarted,
        firstQuestion(1000),
        submits('p1', questionOne.options[0]!.id),
      ]);

      expect(stateBeforeDeck.phase).toBe('answering');
      expect(stateBeforeDeck.sealed).toHaveLength(1);

      // Open deck
      const openPlan = planOpenDeck(stateBeforeDeck);
      if (openPlan.outcome !== 'opened') throw new Error('plan failed');
      const stateInDeck = fold([
        aPlayer('p1', 'Ana'),
        aPlayer('p2', 'Ben'),
        showStarted,
        firstQuestion(1000),
        submits('p1', questionOne.options[0]!.id),
        openPlan.event,
      ]);
      expect(stateInDeck.deck.active).toBe(true);

      // Close deck
      const closePlan = planCloseDeck(stateInDeck);
      expect(closePlan.outcome).toBe('closed');
      if (closePlan.outcome !== 'closed') throw new Error('plan failed');
      const resumedState = fold([
        aPlayer('p1', 'Ana'),
        aPlayer('p2', 'Ben'),
        showStarted,
        firstQuestion(1000),
        submits('p1', questionOne.options[0]!.id),
        openPlan.event,
        closePlan.event,
      ]);

      // Game resumes exactly where it left off
      expect(resumedState.deck.active).toBe(false);
      expect(resumedState.phase).toBe('answering');
      expect(resumedState.question?.id).toBe(cullQuestions[0]!.id);
      expect(resumedState.sealed).toHaveLength(1);
      expect(resumedState.sealed[0]?.playerId).toBe('p1');
    });

    it('refuses to open deck if already open, and refuses to close if not open', () => {
      const closedState = fold([]);
      expect(planCloseDeck(closedState).outcome).toBe('notOpen');

      const openedState = fold([{ type: 'deckOpened' }]);
      expect(planOpenDeck(openedState).outcome).toBe('alreadyOpen');
    });

    it('pauses answer submissions while the deck is active', () => {
      const activeDeckState = fold([
        aPlayer('p1', 'Ana'),
        showStarted,
        firstQuestion(1000),
        { type: 'deckOpened' },
      ]);
      expect(activeDeckState.deck.active).toBe(true);

      const plan = planSubmitAnswer(activeDeckState, { playerId: 'p1', optionId: questionOne.options[0]!.id });
      expect(plan.outcome).toBe('windowClosed');
    });

    it('advances, retreats, and sets deck slides within bounds', () => {
      let state = fold([{ type: 'deckOpened' }]);
      expect(state.deck.slideIndex).toBe(0);

      // At start, prev returns atEdge
      expect(planPrevDeckSlide(state).outcome).toBe('atEdge');

      // Next advances to slide 1
      const nextPlan = planNextDeckSlide(state);
      expect(nextPlan.outcome).toBe('set');
      if (nextPlan.outcome !== 'set') throw new Error('plan failed');
      state = fold([{ type: 'deckOpened' }, nextPlan.event]);
      expect(state.deck.slideIndex).toBe(1);

      // Jump to slide 5
      const setPlan = planSetDeckSlide(state, 5);
      expect(setPlan.outcome).toBe('set');
      if (setPlan.outcome !== 'set') throw new Error('plan failed');
      state = fold([{ type: 'deckOpened' }, nextPlan.event, setPlan.event]);
      expect(state.deck.slideIndex).toBe(5);

      // Previous returns to slide 4
      const prevPlan = planPrevDeckSlide(state);
      expect(prevPlan.outcome).toBe('set');
      if (prevPlan.outcome !== 'set') throw new Error('plan failed');
      state = fold([{ type: 'deckOpened' }, nextPlan.event, setPlan.event, prevPlan.event]);
      expect(state.deck.slideIndex).toBe(4);

      // Setting invalid slides is rejected
      expect(planSetDeckSlide(state, -1).outcome).toBe('invalidSlide');
      expect(planSetDeckSlide(state, deckSlides.length).outcome).toBe('invalidSlide');

      // Jump to final slide
      const lastIndex = deckSlides.length - 1;
      const lastPlan = planSetDeckSlide(state, lastIndex);
      if (lastPlan.outcome !== 'set') throw new Error('plan failed');
      state = fold([{ type: 'deckOpened' }, lastPlan.event]);
      expect(state.deck.slideIndex).toBe(lastIndex);
      // At end, next returns atEdge
      expect(planNextDeckSlide(state).outcome).toBe('atEdge');
    });

    it('contains all 5 TRIM instruments in depth and 8 entrepreneurs in typed data', () => {
      expect(trimTools).toHaveLength(5);
      for (const tool of trimTools) {
        expect(tool.name).toBeTruthy();
        expect(tool.purpose).toBeTruthy();
        expect(tool.covers.length).toBeGreaterThanOrEqual(4);
        expect(tool.when).toBeTruthy();
      }

      expect(entrepreneurs).toHaveLength(8);
      for (const ent of entrepreneurs) {
        expect(ent.name).toBeTruthy();
        expect(ent.knownFor).toBeTruthy();
        expect(ent.failedAt).toBeTruthy();
        expect(ent.lesson).toBeTruthy();
      }

      // Check all 17 slides in deckSlides
      expect(deckSlides.length).toBe(17);
      const trimSlides = deckSlides.filter((s) => s.kind === 'trim-tool');
      expect(trimSlides).toHaveLength(5);

      const entSlides = deckSlides.filter((s) => s.kind === 'entrepreneur');
      expect(entSlides).toHaveLength(8);
    });
  });

  describe('direct bout resolution (ticket 08 fallback)', () => {
    const entrants = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const bracketEvents: GameEvent[] = [
      ...entrants.map((id) => aPlayer(id, `Player ${id}`)),
      showStarted,
      firstQuestion(),
      ...entrants.map((id) => submits(id, questionOne.correctOptionId)),
      ...closed,
      { type: 'bracketSeeded', entrants },
    ];

    it('refuses direct resolution when not in bracket', () => {
      const state = fold([aPlayer('p1', 'Ana'), showStarted]);
      expect(planResolveBoutDirectly(state, 'bout-1', 'p1').outcome).toBe('notInBracket');
    });

    it('refuses direct resolution when bout does not exist', () => {
      const state = fold(bracketEvents);
      expect(planResolveBoutDirectly(state, 'bout-999', 'p1').outcome).toBe('boutNotFound');
    });

    it('refuses direct resolution when declared winner is not a competitor in the bout', () => {
      const state = fold(bracketEvents);
      expect(planResolveBoutDirectly(state, 'bout-1', 'p3').outcome).toBe('invalidWinner');
    });

    it('refuses direct resolution when bout is already resolved', () => {
      const state = fold([
        ...bracketEvents,
        { type: 'boutResolvedDirectly', boutId: 'bout-1', winnerId: 'p1' },
      ]);
      expect(planResolveBoutDirectly(state, 'bout-1', 'p2').outcome).toBe('alreadyResolved');
    });

    it('plans direct resolution for an active bout', () => {
      const state = fold(bracketEvents);
      const plan = planResolveBoutDirectly(state, 'bout-1', 'p1');
      expect(plan.outcome).toBe('resolved');
      if (plan.outcome !== 'resolved') return;
      expect(plan.event).toEqual({
        type: 'boutResolvedDirectly',
        boutId: 'bout-1',
        winnerId: 'p1',
      });
    });

    it('folds direct resolution: advances winner, eliminates loser, and propagates forward', () => {
      const [boutQ] = boutQuestions;
      if (!boutQ) throw new Error('bout question required');

      // Present question for bout-1
      const askingState = fold([
        ...bracketEvents,
        { type: 'questionPresented', questionId: boutQ.id, at: 1000 },
        submits('p1', boutQ.options[0]!.id),
      ]);

      expect(askingState.sealed).toHaveLength(1);

      // Resolve directly for p1
      const resolved = fold([
        ...bracketEvents,
        { type: 'questionPresented', questionId: boutQ.id, at: 1000 },
        submits('p1', boutQ.options[0]!.id),
        { type: 'boutResolvedDirectly', boutId: 'bout-1', winnerId: 'p1' },
      ]);

      // Phase is revealed, sealed is cleared, answer is formed
      expect(resolved.phase).toBe('revealed');
      expect(resolved.sealed).toEqual([]);
      expect(resolved.answer?.questionId).toBe(boutQ.id);

      // Winner and loser standings
      expect(resolved.roster.find((p) => p.id === 'p1')?.standing).toBe('in');
      expect(resolved.roster.find((p) => p.id === 'p2')?.standing).toBe('out');

      // Bout state
      const bout1 = resolved.bracket?.bouts.find((b) => b.id === 'bout-1');
      expect(bout1?.winnerId).toBe('p1');
      expect(bout1?.resolvedBy).toBe('manual');

      // Propagated to Semifinal 1 (bout-5)
      const bout5 = resolved.bracket?.bouts.find((b) => b.id === 'bout-5');
      expect(bout5?.player1Id).toBe('p1');
    });

    it('crowns the finalist when resolving the final bout directly', () => {
      // In a 2-entrant bracket, bout-7 is the final
      const twoEntrants = ['p1', 'p2'];
      const finalEvents: GameEvent[] = [
        ...twoEntrants.map((id) => aPlayer(id, `Player ${id}`)),
        showStarted,
        firstQuestion(),
        ...twoEntrants.map((id) => submits(id, questionOne.correctOptionId)),
        ...closed,
        { type: 'bracketSeeded', entrants: twoEntrants },
      ];

      const state = fold(finalEvents);
      expect(state.bracket?.currentBoutId).toBe('bout-7');

      const resolved = fold([
        ...finalEvents,
        { type: 'boutResolvedDirectly', boutId: 'bout-7', winnerId: 'p2' },
      ]);

      expect(resolved.bracket?.finalistId).toBe('p2');
      expect(resolved.roster.find((p) => p.id === 'p1')?.standing).toBe('out');
      expect(resolved.roster.find((p) => p.id === 'p2')?.standing).toBe('in');
    });
  });
});
