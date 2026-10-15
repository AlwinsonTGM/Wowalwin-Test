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
  planSimulateAnswers,
  planSimulatePlayers,
  planSubmitAnswer,
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

  const record = (event: GameEvent) => {
    events.push(event);
    state = fold(events);
    writeEventLog(logPath, events);
    // `shown`, not the raw state: the sealed submissions never leave the machine
    // (ADR-0003), so a socket physically cannot deliver them to the Backbone.
    const payload = JSON.stringify({ kind: 'state', state: shown(state) } satisfies ServerMessage);
    for (const client of wss.clients) if (client.readyState === client.OPEN) client.send(payload);

    armAnswerWindow();

    // An armed rehearsal room answers the moment its question goes up, not when
    // somebody remembers to press anything. Keyed off the question rather than
    // off `record`, so an answer cannot cause another answer.
    if (event.type === 'questionPresented') {
      for (const answer of planSimulateAnswers(state, state.simulation.mode).answers) record(answer);
    }
  };

  const armAnswerWindow = () => {
    clearTimeout(windowTimer);
    const question = state.question;
    if (state.phase !== 'answering' || !question) return;

    // Counted from when the question went up rather than from now, so a server
    // that restarts mid-question closes the window when it was always going to
    // close, not ten seconds after the restart.
    const leftMs = showConfig.timings.answerSeconds * 1000 - (Date.now() - question.askedAt);
    windowTimer = setTimeout(() => {
      const plan = planCloseAnswerWindow(state);
      if (plan.outcome === 'closed') record(plan.event);
    }, Math.max(0, leftMs));
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
  armAnswerWindow();

  return {
    port: (http.address() as { port: number }).port,
    joinHost,
    close: () =>
      new Promise<void>((done) => {
        clearTimeout(windowTimer);
        for (const client of wss.clients) client.terminate();
        wss.close();
        http.closeAllConnections();
        http.close(() => done());
      }),
  };
}