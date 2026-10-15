import { describe, expect, it } from 'vitest';
import {
  fold,
  planCloseAnswerWindow,
  planJoin,
  planNextQuestion,
  planReveal,
  planResume,
  planSubmitAnswer,
  secondsLeft,
  shown,
} from './machine.ts';
import type { GameEvent } from './events.ts';
import { forPresenter, questionBank, showConfig } from '../content/show.ts';

const aPlayer = (id: string, name: string): GameEvent => ({ type: 'playerJoined', playerId: id, name });
const showStarted: GameEvent = { type: 'showStarted' };

/** The first question of the queue, going up at a fixed instant. */
const firstQuestion = (at = 1000): GameEvent => ({ type: 'questionPresented', questionId: questionBank[0]!.id, at });

// These tests read the bank from content rather than inventing questions, so
// they cannot drift from the wording the presenters actually ship. Two entries
// are needed to show the queue advancing; the throw says so out loud if the
// file ever stops having them.
const questionOne = questionBank[0];
const questionTwo = questionBank[1];
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
    });
  });

  it('holds a Player who joins', () => {
    expect(fold([aPlayer('p1', 'Ana')]).roster).toEqual([{ id: 'p1', name: 'Ana', connected: true }]);
  });

  it('keeps Players in the order they joined', () => {
    const state = fold([aPlayer('p1', 'Ana'), aPlayer('p2', 'Ben'), aPlayer('p3', 'Cara')]);

    expect(state.roster.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Cara']);
  });
});

describe('joining', () => {
  it('puts the Player on the roster and says they are in', () => {
    const { event } = planJoin(fold([]), { id: 'p1', name: 'Ana' });

    expect(fold([event!]).roster).toEqual([{ id: 'p1', name: 'Ana', connected: true }]);
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
      { id: 'p1', name: 'Ana', connected: false },
      { id: 'p2', name: 'Ben', connected: true },
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

    expect(state.roster).toEqual([{ id: 'p1', name: 'Ana', connected: true }]);
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
        { id: 'p1', name: 'Ana', connected: true },
        { id: 'p2', name: 'Ben', connected: false },
      ],
      asked: [],
      question: null,
      answer: null,
      sealed: [],
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
    const spent = readyToAsk(
      firstQuestion(2000),
      { type: 'questionPresented', questionId: questionTwo.id, at: 2000 },
      { type: 'answerWindowClosed' },
      { type: 'revealTriggered' },
    );

    expect(spent.asked).toEqual([questionOne.id, questionTwo.id]);
    expect(planNextQuestion(spent, 3000).outcome).toBe('queueEmpty');
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
    expect(Object.keys(shown(state)).sort()).toEqual(['answer', 'asked', 'phase', 'question', 'roster']);
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