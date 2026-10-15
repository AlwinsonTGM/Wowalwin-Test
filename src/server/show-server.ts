import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import {
  fold,
  planClearSimulated,
  planCloseAnswerWindow,
  planJoin,
  planNextQuestion,
  planReveal,
  planResume,
  planRerunBout,
  planReverseElimination,
  planSeedBracket,
  planSimulateAnswers,
  planSimulatePlayers,
  planSubmitAnswer,
  planTrimCull,
  planStartFinale,
  planChoosePera,
  planChooseKahon,
  planRevealKahon,
  planOpenDeck,
  planCloseDeck,
  planSetDeckSlide,
  planNextDeckSlide,
  planPrevDeckSlide,
  shown,
} from '../game/machine.ts';
import type { GameEvent, SimulationMode } from '../game/events.ts';
import type { ClientMessage, ServerMessage } from '../shared/protocol.ts';
import { readEventLog, writeEventLog } from './event-log.ts';
import { reachableHost } from './address.ts';
import { CLIENT_DIR, DEFAULT_LOG_PATH } from './config.ts';
import { showConfig } from '../content/show.ts';

export type ShowServer = {
  port: number;
  joinHost: string | null;
  close: () => Promise<void>;
};

const MODES: SimulationMode[] = ['correct', 'wrong', 'mixed'];

const parse = (raw: RawData): ClientMessage | null => {
  try {
    const message = JSON.parse(String(raw)) as Record<string, unknown>;
    if (message?.kind === 'startShow') return { kind: 'startShow' };
    if (message?.kind === 'presentQuestion') return { kind: 'presentQuestion' };
    if (message?.kind === 'reveal') return { kind: 'reveal' };
    if (message?.kind === 'clearSimulated') return { kind: 'clearSimulated' };
    if (message?.kind === 'simulateAnswers') return { kind: 'simulateAnswers' };
    if (message?.kind === 'simulatePlayers') {
      return { kind: 'simulatePlayers', count: typeof message.count === 'number' ? message.count : 0 };
    }
    if (message?.kind === 'setSimulation') {
      const mode = MODES.find((candidate) => candidate === message.mode);
      if (!mode) return null;
      return { kind: 'setSimulation', armed: message.armed === true, mode };
    }
    if (message?.kind === 'submitAnswer') {
      return { kind: 'submitAnswer', optionId: typeof message.optionId === 'string' ? message.optionId : '' };
    }
    if (message?.kind === 'trimCull' && Array.isArray(message.survivorIds)) {
      return { kind: 'trimCull', survivorIds: message.survivorIds.filter((id) => typeof id === 'string') };
    }
    if (message?.kind === 'seedBracket') {
      return { kind: 'seedBracket', seed: typeof message.seed === 'number' ? message.seed : undefined };
    }
    if (message?.kind === 'rerunBout') return { kind: 'rerunBout' };
    if (message?.kind === 'reverseElimination' && typeof message.playerId === 'string') {
      return { kind: 'reverseElimination', playerId: message.playerId };
    }
    if (message?.kind === 'startFinale') {
      return { kind: 'startFinale', seed: typeof message.seed === 'number' ? message.seed : undefined };
    }
    if (message?.kind === 'choosePera') return { kind: 'choosePera' };
    if (message?.kind === 'chooseKahon') {
      return { kind: 'chooseKahon', seed: typeof message.seed === 'number' ? message.seed : undefined };
    }
    if (message?.kind === 'revealKahon') return { kind: 'revealKahon' };
    if (message?.kind === 'openDeck') {
      return { kind: 'openDeck', slideIndex: typeof message.slideIndex === 'number' ? message.slideIndex : undefined };
    }
    if (message?.kind === 'closeDeck') return { kind: 'closeDeck' };
    if (message?.kind === 'setDeckSlide' && typeof message.slideIndex === 'number') {
      return { kind: 'setDeckSlide', slideIndex: message.slideIndex };
    }
    if (message?.kind === 'nextDeckSlide') return { kind: 'nextDeckSlide' };
    if (message?.kind === 'prevDeckSlide') return { kind: 'prevDeckSlide' };
    if (message?.kind !== 'join') return null;

    const name = typeof message.name === 'string' ? message.name : undefined;
    const token = typeof message.token === 'string' ? message.token : undefined;
    return { kind: 'join', name, token };
  } catch {
    return null;
  }
};

/**
 * The whole server is an adapter around one function: receive an event, fold
 * it, tell every surface the new state. The rules live in src/game/machine.
 */
export async function startShowServer({
  port,
  logPath = DEFAULT_LOG_PATH,
}: {
  port: number;
  logPath?: string;
}): Promise<ShowServer> {
  const events: GameEvent[] = readEventLog(logPath);
  let state = fold(events);

  // Nothing is connected the moment the server boots, so nobody may claim to be.
  const stale = state.roster.filter((player) => player.connected);
  if (stale.length > 0) {
    for (const player of stale) events.push({ type: 'playerDisconnected', playerId: player.id });
    state = fold(events);
    writeEventLog(logPath, events);
  }

  const app = express();
  if (existsSync(CLIENT_DIR)) {
    app.use(express.static(CLIENT_DIR));
    app.use((_req, res) => res.sendFile(resolve(CLIENT_DIR, 'index.html')));
  }

  const http = createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  // ADR-0002: binding to 0.0.0.0 is the whole point. `localhost` would mean this
  // machine only, and a phone on the hotspot could never reach it.
  http.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws') wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    else socket.destroy();
  });

  const send = (client: WebSocket, message: ServerMessage) => client.send(JSON.stringify(message));

  /**
   * The clock the machine is not allowed to read. One timer, rearmed whenever
   * the state changes, emits the close; whether a window was open is still the
   * machine's call, so a late or duplicated timer cannot close a window that
   * has already been revealed.
   */
  let windowTimer: NodeJS.Timeout | undefined;
  let suspenseTimer: NodeJS.Timeout | undefined;
  let winnerTimer: NodeJS.Timeout | undefined;

  const record = (event: GameEvent) => {
    events.push(event);
    state = fold(events);
    writeEventLog(logPath, events);
    // `shown`, not the raw state: the sealed submissions never leave the machine
    // (ADR-0003), so a socket physically cannot deliver them to the Backbone.
    const payload = JSON.stringify({ kind: 'state', state: shown(state) } satisfies ServerMessage);
    for (const client of wss.clients) if (client.readyState === client.OPEN) client.send(payload);

    armTimers();

    // An armed rehearsal room answers the moment its question goes up, not when
    // somebody remembers to press anything. Keyed off the question rather than
    // off `record`, so an answer cannot cause another answer.
    if (event.type === 'questionPresented') {
      for (const answer of planSimulateAnswers(state, state.simulation.mode).answers) record(answer);
    }
  };

  const armTimers = () => {
    clearTimeout(windowTimer);
    clearTimeout(suspenseTimer);
    clearTimeout(winnerTimer);

    if (state.deck.active) return;

    const question = state.question;
    if (state.phase === 'answering' && question) {
      const leftMs = showConfig.timings.answerSeconds * 1000 - (Date.now() - question.askedAt);
      windowTimer = setTimeout(() => {
        const plan = planCloseAnswerWindow(state);
        if (plan.outcome === 'closed') record(plan.event);
      }, Math.max(0, leftMs));
      return;
    }

    // In a bout, auto-advance through suspense (5s) and winner display (5s)
    if (state.bracket !== null) {
      if (state.phase === 'revealPending') {
        suspenseTimer = setTimeout(() => {
          const plan = planReveal(state);
          if (plan.outcome === 'revealed') record(plan.event);
        }, showConfig.timings.suspenseSeconds * 1000);
      } else if (state.phase === 'revealed' && state.bracket.currentBoutId !== null) {
        const currentBout = state.bracket.bouts.find((b) => b.id === state.bracket!.currentBoutId);
        if (state.bracket.finalistId === null && currentBout && currentBout.winnerId !== null) {
          const nextBout = state.bracket.bouts.find(
            (b) => b.winnerId === null && b.player1Id !== null && b.player2Id !== null,
          );
          if (nextBout) {
            winnerTimer = setTimeout(() => {
              const plan = planNextQuestion(state, Date.now());
              if (plan.outcome === 'presented') record(plan.event);
            }, showConfig.timings.winnerSeconds * 1000);
          }
        }
      }
    }
  };

  // A Player with the show link open twice is still one Player: only the last
  // socket closing counts them as gone.
  const openSockets = new Map<string, number>();

  // The hotspot cannot change mid-show, so this is read once: forty phones
  // joining should not mean forty walks of every network adapter, and the Stage
  // and the console must not be able to disagree about the address.
  const joinHost = reachableHost();

  wss.on('connection', (client) => {
    let playerId: string | undefined;
    // Whether this socket ever *asked* to play. Not the same question as whether
    // it got in: `planJoin` refuses a phone without a claim, and a refused phone
    // still has to be nobody.
    let triedToJoin = false;

    const claim = (id: string) => {
      if (playerId !== id) openSockets.set(id, (openSockets.get(id) ?? 0) + 1);
      playerId = id;
    };

    send(client, { kind: 'serverInfo', joinHost });
    send(client, { kind: 'state', state: shown(state) });

    client.on('message', (raw) => {
      const message = parse(raw);
      if (!message) return;
      if (message.kind === 'join') triedToJoin = true;

      // Presenter-side controls, closed to any socket that has asked to be a
      // Player — let in or turned away — for the same reason `startShow` is
      // (ADR-0004). A refusal is the sharp case: it is the one outcome that leaves
      // a socket with no claim and no roster place, so `playerId` on its own
      // cannot tell a phone the show turned away from the Presenter. The rule
      // itself — whether a reveal may happen — is the machine's.
      const isPresenter = playerId === undefined && !triedToJoin;

      if (message.kind === 'startShow') {
        if (isPresenter && state.phase === 'joining') record({ type: 'showStarted' });
        return;
      }

      if (message.kind === 'presentQuestion') {
        if (!isPresenter) return;
        const plan = planNextQuestion(state, Date.now());
        if (plan.outcome === 'presented') record(plan.event);
        return;
      }

      if (message.kind === 'reveal') {
        if (!isPresenter) return;
        const plan = planReveal(state);
        if (plan.outcome === 'revealed') record(plan.event);
        return;
      }

      if (message.kind === 'submitAnswer') {
        // The Player is whoever this socket claimed, so a phone can only ever
        // answer for itself. Submitting on someone else's behalf is ticket 08's
        // fallback, and it gets the same rule through the same planner.
        if (playerId === undefined) return;
        const plan = planSubmitAnswer(state, { playerId, optionId: message.optionId });
        if (plan.outcome === 'recorded') record(plan.event);
        // The acknowledgement is about this socket's own submission, so it goes
        // to this socket alone and says nothing about anybody else's.
        send(client, { kind: 'answerAck', outcome: plan.outcome });
        return;
      }

      // The rehearsal room. Seeded, never connected — see ticket 03's Comments.
      // Every one of these is a Presenter control on the same terms as the
      // three above, and every rule behind them is the machine's to decide.
      if (message.kind === 'simulatePlayers') {
        if (!isPresenter) return;
        const plan = planSimulatePlayers(state, message.count);
        if (plan.outcome === 'seeded') for (const event of plan.events) record(event);
        return;
      }

      if (message.kind === 'clearSimulated') {
        if (!isPresenter) return;
        const plan = planClearSimulated(state);
        if (plan.outcome === 'cleared') record(plan.event);
        return;
      }

      if (message.kind === 'setSimulation') {
        if (!isPresenter) return;
        record({ type: 'simulationSet', armed: message.armed, mode: message.mode });
        return;
      }

      if (message.kind === 'simulateAnswers') {
        if (!isPresenter) return;
        for (const answer of planSimulateAnswers(state, state.simulation.mode).answers) record(answer);
        return;
      }

      if (message.kind === 'trimCull') {
        if (!isPresenter) return;
        const plan = planTrimCull(state, message.survivorIds);
        if (plan.outcome === 'trimmed') record(plan.event);
        return;
      }

      if (message.kind === 'seedBracket') {
        if (!isPresenter) return;
        const plan = planSeedBracket(state, message.seed);
        if (plan.outcome === 'seeded') record(plan.event);
        return;
      }

      if (message.kind === 'rerunBout') {
        if (!isPresenter) return;
        const plan = planRerunBout(state);
        if (plan.outcome === 'rerun') record(plan.event);
        return;
      }

      if (message.kind === 'reverseElimination') {
        if (!isPresenter) return;
        const plan = planReverseElimination(state, message.playerId);
        if (plan.outcome === 'reversed') record(plan.event);
        return;
      }

      if (message.kind === 'startFinale') {
        if (!isPresenter) return;
        const plan = planStartFinale(state, message.seed);
        if (plan.outcome === 'started') record(plan.event);
        return;
      }

      if (message.kind === 'choosePera') {
        const isFinalist = playerId !== undefined && state.bracket?.finalistId === playerId;
        if (!isPresenter && !isFinalist) return;
        const plan = planChoosePera(state);
        if (plan.outcome === 'chosen') record(plan.event);
        return;
      }

      if (message.kind === 'chooseKahon') {
        const isFinalist = playerId !== undefined && state.bracket?.finalistId === playerId;
        if (!isPresenter && !isFinalist) return;
        const plan = planChooseKahon(state, message.seed);
        if (plan.outcome === 'drawn') record(plan.event);
        return;
      }

      if (message.kind === 'revealKahon') {
        if (!isPresenter) return;
        const plan = planRevealKahon(state);
        if (plan.outcome === 'revealed') record(plan.event);
        return;
      }

      if (message.kind === 'openDeck') {
        if (!isPresenter) return;
        const plan = planOpenDeck(state, message.slideIndex);
        if (plan.outcome === 'opened') record(plan.event);
        return;
      }

      if (message.kind === 'closeDeck') {
        if (!isPresenter) return;
        const plan = planCloseDeck(state);
        if (plan.outcome === 'closed') record(plan.event);
        return;
      }

      if (message.kind === 'setDeckSlide') {
        if (!isPresenter) return;
        const plan = planSetDeckSlide(state, message.slideIndex);
        if (plan.outcome === 'set') record(plan.event);
        return;
      }

      if (message.kind === 'nextDeckSlide') {
        if (!isPresenter) return;
        const plan = planNextDeckSlide(state);
        if (plan.outcome === 'set') record(plan.event);
        return;
      }

      if (message.kind === 'prevDeckSlide') {
        if (!isPresenter) return;
        const plan = planPrevDeckSlide(state);
        if (plan.outcome === 'set') record(plan.event);
        return;
      }

      const known = message.token;
      const resume = known ? planResume(state, known) : null;
      if (resume?.outcome === 'resumed') {
        claim(resume.event.playerId);
        record(resume.event);
        send(client, { kind: 'joinAck', outcome: 'resumed', token: resume.event.playerId });
        return;
      }

      // A token the show has never seen is a phone from an earlier show: it
      // joins afresh, and the cap and the phase decide whether it still can.
      const id = known ?? randomUUID();
      const plan = planJoin(state, { id, name: message.name ?? '' });

      if (plan.outcome === 'joined' && plan.event) {
        claim(id);
        record(plan.event);
        send(client, { kind: 'joinAck', outcome: 'joined', token: id });
      } else {
        send(client, { kind: 'joinAck', outcome: plan.outcome });
      }
    });

    client.on('close', () => {
      if (playerId === undefined) return;
      const left = (openSockets.get(playerId) ?? 1) - 1;
      openSockets.set(playerId, left);

      const player = state.roster.find((p) => p.id === playerId);
      if (left <= 0 && player?.connected) record({ type: 'playerDisconnected', playerId: player.id });
    });
  });

  await new Promise<void>((ready) => http.listen(port, '0.0.0.0', ready));

  // A log rebuilt from disk can already be mid-question; the window still has
  // to close on its own without anyone pressing anything.
  armTimers();

  return {
    port: (http.address() as { port: number }).port,
    joinHost,
    close: () =>
      new Promise<void>((done) => {
        clearTimeout(windowTimer);
        clearTimeout(suspenseTimer);
        clearTimeout(winnerTimer);
        for (const client of wss.clients) client.terminate();
        wss.close();
        http.closeAllConnections();
        http.close(() => done());
      }),
  };
}