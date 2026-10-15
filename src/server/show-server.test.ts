import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { startShowServer } from './show-server.ts';
import { writeEventLog } from './event-log.ts';
import { reachableHost } from './address.ts';
import type { ServerMessage, ClientMessage } from '../shared/protocol.ts';
import type { ShownState, JoinOutcome } from '../game/machine.ts';
import { copy, showConfig } from '../content/show.ts';
import { cullQuestions, boutQuestions } from '../content/questions.ts';
import { Pera } from '../content/prizes.ts';
import type { GameEvent } from '../game/events.ts';

const aTempLog = () => join(mkdtempSync(join(tmpdir(), 'wowolwin-')), 'event-log.json');

async function withServer<T>(run: (port: number) => Promise<T>, seedLog?: unknown[]): Promise<T> {
  const logPath = aTempLog();
  if (seedLog) writeFileSync(logPath, JSON.stringify(seedLog));

  const server = await startShowServer({ port: 0, logPath });
  try {
    return await run(server.port);
  } finally {
    await server.close();
  }
}

/** A stand-in for one of the three surfaces. */
function surface(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox: ServerMessage[] = [];
  const waiting: { kind: ServerMessage['kind']; resolve: (m: ServerMessage) => void }[] = [];

  ws.on('message', (raw) => {
    const message = JSON.parse(String(raw)) as ServerMessage;
    const waiter = waiting.findIndex((w) => w.kind === message.kind);
    if (waiter === -1) inbox.push(message);
    else waiting.splice(waiter, 1)[0]!.resolve(message);
  });

  return {
    send: (message: ClientMessage) => ws.send(JSON.stringify(message)),
    /** A hard drop, the way a phone leaves the hotspot or locks. */
    drop: () => ws.terminate(),
    /** Throw away everything already heard, so the next thing awaited is only
     *  about what happens from here on. One broadcast counts once. */
    drain: () => {
      inbox.length = 0;
      waiting.length = 0;
    },
    next: (kind: ServerMessage['kind']): Promise<ServerMessage> => {
      const seen = inbox.findIndex((m) => m.kind === kind);
      if (seen !== -1) return Promise.resolve(inbox.splice(seen, 1)[0]!);
      return new Promise((resolve) => waiting.push({ kind, resolve }));
    },
    ready: new Promise<void>((resolve) => ws.on('open', () => resolve())),
  };
}

describe('the join link', () => {
  it('tells a surface the hotspot address a phone can actually reach', async () => {
    await withServer(async (port) => {
      const phone = surface(port);
      const message = (await phone.next('serverInfo')) as Extract<ServerMessage, { kind: 'serverInfo' }>;

      expect(message.joinHost).toBe(reachableHost());
    });
  });
});

describe('a Player who joins', () => {
  it('appears on the roster on every other surface', async () => {
    await withServer(async (port) => {
      const phone = surface(port);
      const stage = surface(port);
      await Promise.all([phone.ready, stage.ready, phone.next('state'), stage.next('state')]);

      phone.send({ kind: 'join', name: 'Ana' });

      const onStage = (await stage.next('state')) as Extract<ServerMessage, { kind: 'state' }>;
      expect(onStage.state.roster.map((p) => p.name)).toEqual(['Ana']);
    });
  });

  it('is told they are in, and given a token to come back with', async () => {
    await withServer(async (port) => {
      const phone = surface(port);
      await phone.ready;

      phone.send({ kind: 'join', name: 'Ana' });
      const ack = (await phone.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>;

      expect(ack).toEqual({ kind: 'joinAck', outcome: 'joined', token: expect.any(String) });
    });
  });

  it('is turned away once the roster is at the hard cap', async () => {
    const full = Array.from({ length: showConfig.playerCap }, (_, i) => ({
      type: 'playerJoined',
      playerId: `seeded-${i}`,
      name: `Player ${i}`,
    }));

    await withServer(async (port) => {
      const phone = surface(port);
      await phone.ready;

      phone.send({ kind: 'join', name: 'Late' });
      const ack = (await phone.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>;

      expect(ack.outcome).toBe('rosterFull');
    }, full);
  });
});

describe('the Backbone reloading', () => {
  it('finds the show already running, roster and all', async () => {
    await withServer(async (port) => {
      const phone = surface(port);
      await phone.ready;
      await phone.next('state');
      phone.send({ kind: 'join', name: 'Ana' });
      await phone.next('joinAck');
      const before = (await phone.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      const reloaded = surface(port);
      const after = (await reloaded.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(after.state).toEqual(before.state);
      expect(after.state.roster.map((p) => p.name)).toEqual(['Ana']);
    });
  });
});

describe('a phone that drops', () => {
  it('shows as disconnected on the Backbone without losing its place', async () => {
    await withServer(async (port) => {
      const phone = surface(port);
      const backbone = surface(port);
      await Promise.all([phone.ready, backbone.ready, phone.next('state'), backbone.next('state')]);
      phone.send({ kind: 'join', name: 'Ana' });
      const token = ((await phone.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>).token!;
      await backbone.next('state');

      phone.drop();
      const dropped = (await backbone.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(dropped.state.roster).toEqual([{ id: token, name: 'Ana', connected: false, standing: 'in', simulated: false }]);

      const returning = surface(port);
      await returning.ready;
      returning.send({ kind: 'join', token });
      const ack = (await returning.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>;
      const back = (await backbone.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(ack).toEqual({ kind: 'joinAck', outcome: 'resumed', token });
      expect(back.state.roster).toEqual([{ id: token, name: 'Ana', connected: true, standing: 'in', simulated: false }]);
    });
  });

  it('stays connected while a second tab of the same phone is still open', async () => {
    await withServer(async (port) => {
      const phone = surface(port);
      const backbone = surface(port);
      await Promise.all([phone.ready, backbone.ready, phone.next('state'), backbone.next('state')]);
      phone.send({ kind: 'join', name: 'Ana' });
      const token = ((await phone.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>).token!;
      await backbone.next('state');

      const secondTab = surface(port);
      await Promise.all([secondTab.ready, secondTab.next('state')]);
      secondTab.send({ kind: 'join', token });
      await secondTab.next('joinAck');
      await backbone.next('state');

      phone.drop();

      const latecomer = surface(port);
      const state = (await latecomer.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(state.state.roster).toEqual([{ id: token, name: 'Ana', connected: true, standing: 'in', simulated: false }]);
    });
  });
});

describe('starting the show', () => {
  it('happens only when the Presenter says so', async () => {
    await withServer(async (port) => {
      const backbone = surface(port);
      await backbone.ready;
      expect(((await backbone.next('state')) as Extract<ServerMessage, { kind: 'state' }>).state.phase).toBe('joining');

      backbone.send({ kind: 'startShow' });
      const started = (await backbone.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(started.state.phase).toBe('started');
    });
  });

  it('cannot be started from a Player phone', async () => {
    await withServer(async (port) => {
      const phone = surface(port);
      await phone.ready;
      await phone.next('state');
      phone.send({ kind: 'join', name: 'Ana' });
      await phone.next('joinAck');
      await phone.next('state');

      phone.send({ kind: 'startShow' });

      const watcher = surface(port);
      await watcher.ready;
      const after = (await watcher.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(after.state.phase).toBe('joining');
    });
  });
});

describe('a phone the show turned away', () => {
  /** How long a Backbone is given to hear something that should not exist.
   *  Loopback puts a broadcast a millisecond away, so this only ever costs time
   *  when silence really is the answer. */
  const SILENCE = 1000;

  /** What this surface is told next, or `'nothing'` when the server says nothing
   *  at all. A control the server drops is answered with silence, so silence is
   *  the only honest way to assert one had no effect. */
  function within<T>(p: Promise<T>): Promise<T | 'nothing'> {
    return Promise.race([p, new Promise<'nothing'>((r) => setTimeout(() => r('nothing'), SILENCE))]);
  }

  /**
   * A refusal is the one join outcome that leaves a socket exactly as it found
   * it: no `playerId`, no roster place, and no broadcast to prove it was ever
   * here. So if the server sorts Presenter from Player by a claimed place, a
   * turned-away phone looks exactly like the Presenter and every control on the
   * Backbone is one tap away on any phone that opens the link mid-show (ADR-0004).
   *
   * Each test therefore drains the Backbone before the attempt and then waits for
   * nothing. Draining is what makes these tests honest: one broadcast in the inbox
   * is indistinguishable from a leak, and the handshake leaves one there for free.
   */
  it('cannot put the next question up, having never claimed a place', async () => {
    await withServer(async (port) => {
      const presenter = surface(port);
      await presenter.ready;
      await presenter.next('state');

      const latecomer = surface(port);
      await latecomer.ready;
      latecomer.send({ kind: 'join', name: 'Latecomer' });
      const ack = (await latecomer.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>;
      expect(ack.outcome).toBe('showStarted');

      presenter.drain();
      latecomer.send({ kind: 'presentQuestion' });

      // A leak prints the whole broadcast it let through, answer included.
      expect(await within(presenter.next('state'))).toBe('nothing');
    }, [{ type: 'showStarted' }]);
  });

  it('cannot reveal an answer it was never shown', async () => {
    const [question] = cullQuestions;
    if (!question) throw new Error('the question bank needs a question for this test');

    await withServer(
      async (port) => {
        const presenter = surface(port);
        await presenter.ready;
        await presenter.next('state');

        const latecomer = surface(port);
        await latecomer.ready;
        latecomer.send({ kind: 'join', name: 'Latecomer' });
        const ack = (await latecomer.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>;
        expect(ack.outcome).toBe('showStarted');

        // The log is seeded straight to the suspense pause — question up, window
        // closed — so the reveal is the only thing left for anyone to press.
        presenter.drain();
        latecomer.send({ kind: 'reveal' });

        expect(await within(presenter.next('state'))).toBe('nothing');
      },
      [
        { type: 'showStarted' },
        { type: 'questionPresented', questionId: question.id, at: Date.now() },
        { type: 'answerWindowClosed' },
      ],
    );
  });

  it('cannot start a show it was turned away from joining', async () => {
    await withServer(async (port) => {
      const presenter = surface(port);
      await presenter.ready;
      await presenter.next('state');

      const latecomer = surface(port);
      await latecomer.ready;
      // `planJoin` settles a bad name before it ever looks at the phase, so this
      // refusal happens while the show is still gathering and the Presenter's
      // start button is still live — and the gate has no reason to care which
      // refusal it was.
      latecomer.send({ kind: 'join', name: '' });
      const ack = (await latecomer.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>;
      expect(ack.outcome).toBe('nameRequired');

      presenter.drain();
      latecomer.send({ kind: 'startShow' });

      expect(await within(presenter.next('state'))).toBe('nothing');
    });
  });
});

describe('one question, answered and revealed', () => {
  const [question] = cullQuestions;
  if (!question) throw new Error('the question bank needs a question for these tests');

  /** The next state this surface is told that matches: the ones before are the same show a moment earlier. */
  async function until(s: ReturnType<typeof surface>, ok: (state: ShownState) => boolean): Promise<ShownState> {
    for (;;) {
      const message = (await s.next('state')) as Extract<ServerMessage, { kind: 'state' }>;
      if (ok(message.state)) return message.state;
    }
  }

  /** A joined phone, the Stage, and the Presenter's laptop, with a question open. */
  async function aQuestionOnScreen(port: number) {
    const phone = surface(port);
    const stage = surface(port);
    const presenter = surface(port);
    await Promise.all([phone.ready, stage.ready, presenter.ready]);
    await Promise.all([phone.next('state'), stage.next('state'), presenter.next('state')]);

    phone.send({ kind: 'join', name: 'Ana' });
    const ack = (await phone.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>;
    await Promise.all([phone.next('state'), stage.next('state'), presenter.next('state')]);

    presenter.send({ kind: 'startShow' });
    await presenter.next('state');
    presenter.send({ kind: 'presentQuestion' });

    return { phone, stage, presenter, playerId: ack.token! };
  }

  it('puts the question on the Stage and on every phone in the same broadcast', async () => {
    await withServer(async (port) => {
      const { phone, stage } = await aQuestionOnScreen(port);

      const onStage = await until(stage, (state) => state.question !== null);
      const onPhone = await until(phone, (state) => state.question !== null);

      expect(onStage).toEqual(onPhone);
      expect(onStage.phase).toBe('answering');
      expect(onStage.question?.prompt).toBe(question.prompt);
      expect(onStage.question?.options.map((option) => option.label)).toEqual(question.options.map((o) => o.label));
    });
  });

  it('acknowledges a submission to the phone that made it, and to nobody else', async () => {
    await withServer(async (port) => {
      const { phone, stage, presenter } = await aQuestionOnScreen(port);

      phone.send({ kind: 'submitAnswer', optionId: question.correctOptionId });

      expect(await phone.next('answerAck')).toEqual({ kind: 'answerAck', outcome: 'recorded' });
      // The other two surfaces are told the show moved. They are not told how.
      expect(await stage.next('state')).toBeTruthy();
      expect(await presenter.next('state')).toBeTruthy();
    });
  });

  it('tells no surface anything about a submission, before the reveal', async () => {
    await withServer(async (port) => {
      const { phone, stage, presenter, playerId } = await aQuestionOnScreen(port);

      phone.send({ kind: 'submitAnswer', optionId: question.correctOptionId });
      await phone.next('answerAck');
      const seenByStage = (await stage.next('state')) as Extract<ServerMessage, { kind: 'state' }>;
      const seenByBackbone = (await presenter.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      // ADR-0003. One broadcast carries all three surfaces, so the rule cannot
      // be a surface choosing not to draw something: these five names are every
      // field a socket can be given while the answer is sealed, and none of
      // them is a submission — not the option, not the Player, not a count.
      expect(Object.keys(seenByBackbone.state).sort()).toEqual([
        'answer',
        'asked',
        'bracket',
        'finale',
        'phase',
        'question',
        'roster',
        'simulation',
      ]);
      expect(Object.keys(seenByStage.state)).not.toContain('sealed');
      expect(JSON.stringify(seenByBackbone.state)).not.toContain('correct');
      expect(seenByBackbone.state.answer).toBeNull();
      // Every option is on screen, so the option ids are on the wire — what is
      // not on the wire is any record of who picked one. `optionId` is how a
      // submission names itself, and it appears nowhere.
      expect(JSON.stringify(seenByBackbone.state)).not.toContain('optionId');
      expect(seenByBackbone.state.roster.some((player) => player.id === playerId)).toBe(true);
    });
  });

  it('takes one answer per Player and refuses the second', async () => {
    await withServer(async (port) => {
      const { phone } = await aQuestionOnScreen(port);

      phone.send({ kind: 'submitAnswer', optionId: question.correctOptionId });
      await phone.next('answerAck');

      phone.send({ kind: 'submitAnswer', optionId: question.options[0]!.id });

      expect(await phone.next('answerAck')).toEqual({ kind: 'answerAck', outcome: 'alreadyAnswered' });
    });
  });

  it('closes the window on its own and takes nothing afterwards', async () => {
    await withServer(async (port) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const { phone, stage, presenter } = await aQuestionOnScreen(port);
        await until(stage, (state) => state.phase === 'answering');

        await vi.advanceTimersByTimeAsync(showConfig.timings.answerSeconds * 1000 + 100);

        const closed = await until(stage, (state) => state.phase === 'revealPending');
        expect(closed.answer).toBeNull();

        // Late is late: the phone is told the window has shut, and the Presenter
        // is still looking at nothing, which is what suspense is made of.
        phone.send({ kind: 'submitAnswer', optionId: question.correctOptionId });
        expect(await phone.next('answerAck')).toEqual({ kind: 'answerAck', outcome: 'windowClosed' });
        expect((await until(presenter, (state) => state.phase === 'revealPending')).answer).toBeNull();

        presenter.send({ kind: 'reveal' });
        const revealed = await until(stage, (state) => state.answer !== null);

        expect(revealed.answer).toEqual({
          questionId: question.id,
          optionId: question.correctOptionId,
          optionLabel: question.options.find((option) => option.id === question.correctOptionId)!.label,
          submissions: [],
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('reveals exactly once, and only when the window has closed', async () => {
    await withServer(async (port) => {
      const { phone, stage, presenter } = await aQuestionOnScreen(port);
      await until(stage, (state) => state.phase === 'answering');

      // Pressing early is not a reveal. Nothing is recorded and nothing is
      // broadcast, which is why the next state any surface is told comes from
      // an event that genuinely moves the show.
      presenter.send({ kind: 'reveal' });
      presenter.send({ kind: 'reveal' });

      phone.send({ kind: 'submitAnswer', optionId: question.correctOptionId });
      const after = (await stage.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(after.state.phase).toBe('answering');
      expect(after.state.answer).toBeNull();
      expect(await phone.next('answerAck')).toEqual({ kind: 'answerAck', outcome: 'recorded' });
    });
  });

  it('keeps the Presenter’s controls away from a Player phone', async () => {
    await withServer(async (port) => {
      const { phone, stage } = await aQuestionOnScreen(port);
      await until(stage, (state) => state.phase === 'answering');

      phone.send({ kind: 'reveal' });
      phone.send({ kind: 'presentQuestion' });

      // None of that records anything, so the next broadcast comes from the one
      // thing that does: the phone answering its own question.
      phone.send({ kind: 'submitAnswer', optionId: question.correctOptionId });
      const after = (await stage.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      // No second question went up, and nothing was revealed.
      expect(after.state.asked).toHaveLength(1);
      expect(after.state.answer).toBeNull();
      expect(await phone.next('answerAck')).toEqual({ kind: 'answerAck', outcome: 'recorded' });
    });
  });
});

describe('the cull over the wire', () => {
  const ROOM = 11;

  /**
   * Fake timers, because the answer window is ten seconds of real time and no
   * test should sit through it. `shouldAdvanceTime` keeps the socket's own I/O
   * moving, which the real event loop would otherwise drive.
   */
  const withCull = async (run: (port: number) => Promise<void>) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await withServer(run);
    } finally {
      vi.useRealTimers();
    }
  };

  const stateWhere = async (s: ReturnType<typeof surface>, ok: (state: ShownState) => boolean): Promise<ShownState> => {
    for (;;) {
      const message = (await s.next('state')) as Extract<ServerMessage, { kind: 'state' }>;
      if (ok(message.state)) return message.state;
    }
  };

  /** A phone that has joined, a Stage, a Presenter, and `size` seeded Players. */
  async function aSeededCull(port: number, size = ROOM, started = true) {
    const phone = surface(port);
    const stage = surface(port);
    const presenter = surface(port);
    await Promise.all([phone.ready, stage.ready, presenter.ready]);
    await Promise.all([phone.next('state'), stage.next('state'), presenter.next('state')]);

    phone.send({ kind: 'join', name: 'Ana' });
    await phone.next('joinAck');
    await Promise.all([phone.next('state'), stage.next('state'), presenter.next('state')]);

    presenter.send({ kind: 'simulatePlayers', count: size });
    // Every seeded Player is its own event, and so its own broadcast: wait for
    // the room to be the size asked for, not for the first name to arrive.
    await stateWhere(stage, (state) => state.roster.length === size + 1);

    if (started) {
      presenter.send({ kind: 'startShow' });
      await stateWhere(presenter, (state) => state.phase === 'started');
    }

    return { phone, stage, presenter };
  }

  /** Asks for a question and lets its window run out, as it would on the day. */
  async function askAndClose(presenter: ReturnType<typeof surface>, stage: ReturnType<typeof surface>) {
    presenter.send({ kind: 'presentQuestion' });
    await stateWhere(stage, (state) => state.phase === 'answering');

    await vi.advanceTimersByTimeAsync(showConfig.timings.answerSeconds * 1000 + 100);
    await stateWhere(stage, (state) => state.phase === 'revealPending');
  }

  it('puts a whole simulated room on the Stage in one press', async () => {
    await withServer(async (port) => {
      const { stage } = await aSeededCull(port);

      const seeded = await stateWhere(stage, (state) => state.roster.length === ROOM + 1);
      expect(seeded.roster.filter((player) => player.simulated)).toHaveLength(ROOM);
      expect(seeded.roster.find((player) => player.simulated)?.name).toBeTruthy();
    });
  });

  it('has the seeded room answer on its own once it is armed', async () => {
    await withCull(async (port) => {
      const { stage, presenter } = await aSeededCull(port);

      presenter.send({ kind: 'setSimulation', armed: true, mode: 'correct' });
      await stateWhere(presenter, (state) => state.simulation.armed);
      await askAndClose(presenter, stage);

      presenter.send({ kind: 'reveal' });
      const revealed = await stateWhere(stage, (state) => state.answer !== null);

      // The question going up is one event and the seeded room answering is a
      // dozen more — well, eleven: the real phone on this socket never submitted,
      // and the cull does not spare anyone for not having answered.
      expect(revealed.answer?.submissions).toHaveLength(ROOM);
      expect(revealed.answer?.submissions.map((submission) => submission.playerId)).not.toContain(
        (revealed.roster.find((player) => !player.simulated))?.id,
      );
    });
  });

  it('answers on demand, with the Presenter pressing it', async () => {
    await withCull(async (port) => {
      const { stage, presenter } = await aSeededCull(port, 4);

      presenter.send({ kind: 'setSimulation', armed: false, mode: 'mixed' });
      await stateWhere(presenter, (state) => state.simulation.mode === 'mixed');
      await askAndClose(presenter, stage);

      presenter.send({ kind: 'simulateAnswers' });
      presenter.send({ kind: 'reveal' });
      const revealed = await stateWhere(stage, (state) => state.answer !== null);

      // Mixed is a third right, a third wrong, a third silent — so fewer than
      // the five who are in the room, and at least one.
      expect(revealed.answer?.submissions.length).toBeGreaterThan(0);
      expect(revealed.answer?.submissions.length).toBeLessThan(5);
    });
  });

  it('flips the whole grid at once on the Stage, which is what the drama is', async () => {
    await withCull(async (port) => {
      const { stage, presenter } = await aSeededCull(port);

      presenter.send({ kind: 'setSimulation', armed: true, mode: 'mixed' });
      await stateWhere(presenter, (state) => state.simulation.armed);
      presenter.send({ kind: 'presentQuestion' });
      const asking = await stateWhere(stage, (state) => state.phase === 'answering');

      // Nothing has flipped yet, and the room cannot see who answered.
      expect(asking.roster.every((player) => player.standing === 'in')).toBe(true);
      expect(JSON.stringify(asking)).not.toContain('optionId');

      await vi.advanceTimersByTimeAsync(showConfig.timings.answerSeconds * 1000 + 100);
      presenter.send({ kind: 'reveal' });
      const revealed = await stateWhere(stage, (state) => state.answer !== null);

      // One event, one new state, and the whole grid has moved together.
      expect(revealed.roster.some((player) => player.standing === 'out')).toBe(true);
      expect(revealed.roster.some((player) => player.standing === 'in')).toBe(true);
    });
  });

  it('keeps culling while the target is unmet, and stops when the bank runs out', async () => {
    await withCull(async (port) => {
      const { presenter, stage } = await aSeededCull(port);

      // Everyone correct leaves twelve, which is above the target of ten, so
      // the cull does not stop and asks for another question.
      presenter.send({ kind: 'setSimulation', armed: true, mode: 'correct' });
      await stateWhere(presenter, (state) => state.simulation.armed);

      for (let i = 0; i < cullQuestions.length; i++) {
        await askAndClose(presenter, stage);
        presenter.send({ kind: 'reveal' });
        await stateWhere(stage, (state) => state.answer !== null && state.asked.length === i + 1);
      }

      // The bank ran out before the target was reached, and the show says so
      // rather than asking past the end of the bank: a refusal broadcasts nothing,
      // so the only way to see it is to make something else broadcast and check.
      stage.drain();
      presenter.send({ kind: 'presentQuestion' });
      presenter.send({ kind: 'setSimulation', armed: false, mode: 'correct' });
      const after = await stateWhere(stage, (state) => state.simulation.armed === false);

      expect(after.asked).toHaveLength(cullQuestions.length);
      expect(after.roster.filter((player) => player.standing === 'in').length).toBeGreaterThan(
        showConfig.cull.targetPlayers,
      );
    });
  });

  it('tears the seeded room down without touching a real phone', async () => {
    await withServer(async (port) => {
      // Before the show, which is the only time it can be torn down: once the
      // cull is running, the roster *is* the show.
      const { stage, presenter } = await aSeededCull(port, 4, false);

      presenter.send({ kind: 'clearSimulated' });
      const cleared = await stateWhere(stage, (state) => state.roster.length === 1);

      expect(cleared.roster[0]?.simulated).toBe(false);
      expect(cleared.roster[0]?.name).toBe('Ana');
    });
  });

  it('keeps the rehearsal controls away from a Player phone', async () => {
    await withServer(async (port) => {
      // Not started: that is the only moment every control here is live. Once
      // the show has begun, seeding and clearing are refused by the *machine*,
      // and a test leaning on that would pass against a server with no guard.
      const { phone, stage, presenter } = await aSeededCull(port, 3, false);

      phone.drain();
      stage.drain();
      presenter.drain();
      phone.send({ kind: 'simulatePlayers', count: 30 });
      phone.send({ kind: 'clearSimulated' });
      phone.send({ kind: 'setSimulation', armed: false, mode: 'correct' });

      // Nothing a phone sent records anything, so the next broadcast is one the
      // Presenter causes. Everything that rode along with it is what was tried.
      presenter.send({ kind: 'setSimulation', armed: true, mode: 'wrong' });
      const seenByStage = await stateWhere(stage, (state) => state.simulation.armed);

      expect(seenByStage.roster).toHaveLength(4);
      expect(seenByStage.simulation).toEqual({ armed: true, mode: 'wrong' });
    });
  });

  it('stops the cull itself once ten or fewer are left', async () => {
    await withCull(async (port) => {
      const { stage, presenter } = await aSeededCull(port);

      // Mixed leaves about a third standing, which is under the target at once.
      presenter.send({ kind: 'setSimulation', armed: true, mode: 'mixed' });
      await stateWhere(presenter, (state) => state.simulation.armed);
      await askAndClose(presenter, stage);
      presenter.send({ kind: 'reveal' });

      const done = await stateWhere(stage, (state) => state.answer !== null);
      expect(done.roster.filter((player) => player.standing === 'in').length).toBeLessThanOrEqual(10);
      expect(done.asked).toHaveLength(1);

      stage.drain();
      presenter.send({ kind: 'presentQuestion' });
      presenter.send({ kind: 'setSimulation', armed: false, mode: 'mixed' });
      const after = await stateWhere(stage, (state) => state.simulation.armed === false);

      expect(after.asked).toHaveLength(1);
      expect(after.phase).toBe('revealed');
    });
  });
});

describe('the show at room scale', () => {
  const ROOM = 50;

  /** The next state this surface is told that matches: the ones before are the same show a moment earlier. */
  async function aStateWhere(s: ReturnType<typeof surface>, ok: (state: ShownState) => boolean): Promise<ShownState> {
    for (;;) {
      const message = (await s.next('state')) as Extract<ServerMessage, { kind: 'state' }>;
      if (ok(message.state)) return message.state;
    }
  }

  it('holds the cap, the whole room seeing it, a drop-and-return, and the Presenter start', async () => {
    await withServer(async (port) => {
      const phones = Array.from({ length: ROOM }, () => surface(port));
      const presenter = surface(port);
      const live = [...phones, presenter];

      try {
        await Promise.all(live.map((s) => s.ready));

        const joinedAt = Date.now();
        phones.forEach((phone, i) => phone.send({ kind: 'join', name: `Player ${i}` }));
        const acks = (await Promise.all(phones.map((p) => p.next('joinAck')))) as Extract<ServerMessage, { kind: 'joinAck' }>[];

        const inRoom = (outcome: JoinOutcome) => acks.flatMap((ack, i) => (ack.outcome === outcome ? [i] : []));
        expect(inRoom('joined')).toHaveLength(showConfig.playerCap);
        expect(inRoom('rosterFull')).toHaveLength(ROOM - showConfig.playerCap);

        const full = (state: ShownState) => state.roster.length === showConfig.playerCap;
        const seenByRoom = await Promise.all(live.map((s) => aStateWhere(s, full)));
        expect(seenByRoom.every((state) => state.roster.every((p) => p.connected))).toBe(true);

        const leaving = inRoom('joined').slice(0, 20);
        const witnesses = [...inRoom('joined').slice(20), ...inRoom('rosterFull')].map((i) => phones[i]!);
        leaving.forEach((i) => phones[i]!.drop());

        const gone = (state: ShownState) => state.roster.filter((p) => !p.connected).length === leaving.length;
        const seenDrop = await Promise.all([...witnesses, presenter].map((s) => aStateWhere(s, gone)));
        expect(seenDrop.every(full)).toBe(true);

        const returning = leaving.map((i) => surface(port));
        live.push(...returning);
        await Promise.all(returning.map((s) => s.ready));
        returning.forEach((s, i) => s.send({ kind: 'join', token: acks[leaving[i]!]!.token }));
        await Promise.all(returning.map((s) => s.next('joinAck')));

        const everyone = [...witnesses, ...returning];
        const allBack = (state: ShownState) => state.roster.every((p) => p.connected);
        const seenReturn = await Promise.all(everyone.map((s) => aStateWhere(s, allBack)));
        expect(seenReturn.every(full)).toBe(true);

        presenter.send({ kind: 'startShow' });
        const started = await Promise.all([...everyone, presenter].map((s) => aStateWhere(s, (state) => state.phase === 'started')));
        expect(started).toHaveLength(ROOM + 1); // the fifty phones, and the Backbone that started it

        const late = surface(port);
        live.push(late);
        await late.ready;
        late.send({ kind: 'join', name: 'Late' });
        expect(await late.next('joinAck')).toEqual({ kind: 'joinAck', outcome: 'showStarted' });

        // A canary against a pathological regression, not a benchmark: 50
        // loopback sockets are not 50 phones, but this ran in ~110ms, so 2s only
        // fires when something is genuinely wrong. Everything asserted above is
        // state, never latency.
        expect(Date.now() - joinedAt).toBeLessThan(2000);
      } finally {
        // ws keeps the event loop alive while a socket is open, so a failed
        // assertion that leaves them behind hangs vitest instead of reporting
        // the failure.
        for (const s of live) s.drop();
      }
    });
  });
});

describe('the finale (Pera o Kahon)', () => {
  const SILENCE = 100;
  async function assertSilence(s: ReturnType<typeof surface>, timeout = SILENCE) {
    const outcome = await Promise.race([
      s.next('state').then((msg) => msg),
      new Promise<'nothing'>((r) => setTimeout(() => r('nothing'), timeout)),
    ]);
    s.drain();
    expect(outcome).toBe('nothing');
  }

  const crownedSeedLog: GameEvent[] = [
    { type: 'playerJoined', playerId: 'p1', name: 'Ana' },
    { type: 'playerJoined', playerId: 'p2', name: 'Ben' },
    { type: 'showStarted' },
    { type: 'questionPresented', questionId: cullQuestions[0]!.id, at: 1000 },
    { type: 'answerSubmitted', playerId: 'p1', optionId: cullQuestions[0]!.correctOptionId },
    { type: 'answerWindowClosed' },
    { type: 'revealTriggered' },
    { type: 'bracketSeeded', entrants: ['p1', 'p2'] },
    { type: 'questionPresented', questionId: boutQuestions[0]!.id, at: 2000 },
    { type: 'answerSubmitted', playerId: 'p1', optionId: boutQuestions[0]!.correctOptionId },
    { type: 'answerWindowClosed' },
    { type: 'revealTriggered' },
  ];

  it('allows Presenter to start the finale and ignores non-presenter attempts', async () => {
    await withServer(async (port) => {
      const presenter = surface(port);
      const finalist = surface(port);
      const other = surface(port);
      const live = [presenter, finalist, other];
      try {
        await Promise.all(live.map((s) => s.ready));
        await Promise.all(live.map((s) => s.next('state')));

        finalist.send({ kind: 'join', token: 'p1' });
        await finalist.next('joinAck');
        await Promise.all(live.map((s) => s.next('state')));

        other.send({ kind: 'join', token: 'p2' });
        await other.next('joinAck');
        await Promise.all(live.map((s) => s.next('state')));

        // A Player phone attempts to start finale: should be ignored
        presenter.drain();
        finalist.drain();
        other.drain();
        finalist.send({ kind: 'startFinale' });
        await assertSilence(presenter);

        other.send({ kind: 'startFinale' });
        await assertSilence(presenter);

        // Presenter starts finale: state broadcast with finale initialized
        presenter.send({ kind: 'startFinale' });
        const nextState = (await presenter.next('state')) as Extract<ServerMessage, { kind: 'state' }>;
        expect(nextState.state.finale).toEqual({
          choice: null,
          drawnPrizeId: null,
          revealed: false,
        });
      } finally {
        for (const s of live) s.drop();
      }
    }, crownedSeedLog);
  });

  it('allows Finalist phone or Presenter to choose Pera, and ignores non-finalist phones', async () => {
    const finaleStartedLog: GameEvent[] = [
      ...crownedSeedLog,
      { type: 'finaleStarted' },
    ];

    await withServer(async (port) => {
      const presenter = surface(port);
      const finalist = surface(port);
      const other = surface(port);
      const live = [presenter, finalist, other];
      try {
        await Promise.all(live.map((s) => s.ready));
        await Promise.all(live.map((s) => s.next('state')));

        finalist.send({ kind: 'join', token: 'p1' });
        await finalist.next('joinAck');
        await Promise.all(live.map((s) => s.next('state')));

        other.send({ kind: 'join', token: 'p2' });
        await other.next('joinAck');
        await Promise.all(live.map((s) => s.next('state')));

        // Non-finalist attempts to choose Pera: ignored
        presenter.drain();
        finalist.drain();
        other.drain();
        other.send({ kind: 'choosePera' });
        await assertSilence(presenter);

        // Finalist chooses Pera: resolves to guaranteed Pera prize
        finalist.send({ kind: 'choosePera' });
        const chosenState = (await presenter.next('state')) as Extract<ServerMessage, { kind: 'state' }>;
        expect(chosenState.state.finale).toEqual({
          choice: 'pera',
          drawnPrizeId: Pera.id,
          revealed: true,
        });
      } finally {
        for (const s of live) s.drop();
      }
    }, finaleStartedLog);

    // Also verify Presenter can choose Pera on finalist's behalf
    await withServer(async (port) => {
      const presenter = surface(port);
      try {
        await presenter.ready;
        await presenter.next('state');

        presenter.send({ kind: 'choosePera' });
        const chosenState = (await presenter.next('state')) as Extract<ServerMessage, { kind: 'state' }>;
        expect(chosenState.state.finale?.choice).toBe('pera');
        expect(chosenState.state.finale?.drawnPrizeId).toBe(Pera.id);
      } finally {
        presenter.drop();
      }
    }, finaleStartedLog);
  });

  it('allows Finalist phone or Presenter to choose Kahon, keeps drawn prize hidden until operator reveals it', async () => {
    const finaleStartedLog: GameEvent[] = [
      ...crownedSeedLog,
      { type: 'finaleStarted' },
    ];

    await withServer(async (port) => {
      const presenter = surface(port);
      const finalist = surface(port);
      const other = surface(port);
      const live = [presenter, finalist, other];
      try {
        await Promise.all(live.map((s) => s.ready));
        await Promise.all(live.map((s) => s.next('state')));

        finalist.send({ kind: 'join', token: 'p1' });
        await finalist.next('joinAck');
        await Promise.all(live.map((s) => s.next('state')));

        other.send({ kind: 'join', token: 'p2' });
        await other.next('joinAck');
        await Promise.all(live.map((s) => s.next('state')));

        // Non-finalist cannot choose Kahon
        presenter.drain();
        other.send({ kind: 'chooseKahon' });
        await assertSilence(presenter);

        // Finalist chooses Kahon: drawn prize set, revealed is false
        finalist.send({ kind: 'chooseKahon' });
        const drawnState = (await presenter.next('state')) as Extract<ServerMessage, { kind: 'state' }>;
        expect(drawnState.state.finale?.choice).toBe('kahon');
        expect(drawnState.state.finale?.drawnPrizeId).not.toBeNull();
        expect(drawnState.state.finale?.revealed).toBe(false);

        // Non-presenter cannot trigger revealKahon
        finalist.drain();
        presenter.drain();
        other.drain();
        finalist.send({ kind: 'revealKahon' });
        await assertSilence(presenter);

        other.send({ kind: 'revealKahon' });
        await assertSilence(presenter);

        // Presenter triggers revealKahon: revealed becomes true
        presenter.send({ kind: 'revealKahon' });
        const revealedState = (await presenter.next('state')) as Extract<ServerMessage, { kind: 'state' }>;
        expect(revealedState.state.finale?.revealed).toBe(true);
      } finally {
        for (const s of live) s.drop();
      }
    }, finaleStartedLog);
  });
});

describe('the event log on disk', () => {
  it('is the state a restarted server rebuilds from', async () => {
    const logPath = aTempLog();

    const first = await startShowServer({ port: 0, logPath });
    const phone = surface(first.port);
    await phone.ready;
    phone.send({ kind: 'join', name: 'Ana' });
    const ack = (await phone.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>;
    phone.drop();
    await first.close();

    const restarted = await startShowServer({ port: 0, logPath });
    try {
      const reloaded = surface(restarted.port);
      const state = (await reloaded.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(state.state.roster).toEqual([{ id: ack.token, name: 'Ana', connected: false, standing: 'in', simulated: false }]);
    } finally {
      await restarted.close();
    }
  });

  it('starts from the last whole log, not from a scratch file a crash left behind', async () => {
    const logPath = aTempLog();
    writeEventLog(logPath, [{ type: 'playerJoined', playerId: 'p1', name: 'Ana' }]);

    // A crash between writing the scratch file and renaming it leaves the real
    // log whole, which is the point of the rename: before it, the crash
    // truncated the log itself and the next server began with no roster and no
    // reason why. This guards the leftover, not the rename — that guarantee is
    // the filesystem's, and nothing here can fail it.
    writeFileSync(`${logPath}.tmp`, '[{"type":"playerJoined","playerI');

    const server = await startShowServer({ port: 0, logPath });
    try {
      const phone = surface(server.port);
      const state = (await phone.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(state.state.roster).toEqual([{ id: 'p1', name: 'Ana', connected: false, standing: 'in', simulated: false }]);
    } finally {
      await server.close();
    }
  });

  it('starts empty and says so out loud when the log cannot be read', async () => {
    const logPath = aTempLog();
    writeFileSync(logPath, '{not json');
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const server = await startShowServer({ port: 0, logPath });
    try {
      const phone = surface(server.port);
      const state = (await phone.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(state.state.roster).toEqual([]);
      // Silence here is how a lost roster becomes a mystery instead of a fact.
      expect(warned).toHaveBeenCalledWith(copy.common.logUnreadable(logPath), expect.anything());
    } finally {
      warned.mockRestore();
      await server.close();
    }
  });
});