import { describe, expect, it } from 'vitest';
import {
  cullLowOnQuestions,
  cullOver,
  fold,
  planClearSimulated,
  planCloseAnswerWindow,
  planJoin,
  planNextQuestion,
  planReveal,
  planResume,
  planSimulateAnswers,
  planSimulatePlayers,
  planSubmitAnswer,
  questionsLeft,
  secondsLeft,
  shown,
  survivors,
} from './machine.ts';
import type { GameEvent, SimulationMode } from './events.ts';
import { showConfig, simulatedName } from '../content/show.ts';
import { cullQuestions, forPresenter } from '../content/questions.ts';

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
    expect(after.roster.filter((player) => player.standing === 'out')).toHaveLength(12);
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
    expect(counts).toHaveLength(2 ** SIZE);
    expect(Math.min(...counts)).toBe(0);
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
