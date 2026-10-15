import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import { fold, planJoin, planResume } from '../game/machine.ts';
import type { GameEvent } from '../game/events.ts';
import type { ClientMessage, ServerMessage } from '../shared/protocol.ts';
import { readEventLog, writeEventLog } from './event-log.ts';
import { reachableHost } from './address.ts';
import { CLIENT_DIR, DEFAULT_LOG_PATH } from './config.ts';

export type ShowServer = {
  port: number;
  joinHost: string | null;
  close: () => Promise<void>;
};

const parse = (raw: RawData): ClientMessage | null => {
  try {
    const message = JSON.parse(String(raw)) as Record<string, unknown>;
    if (message?.kind === 'startShow') return { kind: 'startShow' };
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

  const record = (event: GameEvent) => {
    events.push(event);
    state = fold(events);
    writeEventLog(logPath, events);
    const payload = JSON.stringify({ kind: 'state', state } satisfies ServerMessage);
    for (const client of wss.clients) if (client.readyState === client.OPEN) client.send(payload);
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

    const claim = (id: string) => {
      if (playerId !== id) openSockets.set(id, (openSockets.get(id) ?? 0) + 1);
      playerId = id;
    };

    send(client, { kind: 'serverInfo', joinHost });
    send(client, { kind: 'state', state });

    client.on('message', (raw) => {
      const message = parse(raw);
      if (!message) return;

      if (message.kind === 'startShow') {
        // A Player phone has no business starting the show, so a socket that
        // has claimed a roster place never can. There is no Presenter identity
        // on a connection at all (ADR-0004); this is the part of that we can
        // hold honestly.
        if (playerId === undefined && state.phase === 'joining') record({ type: 'showStarted' });
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

  return {
    port: (http.address() as { port: number }).port,
    joinHost,
    close: () =>
      new Promise<void>((done) => {
        for (const client of wss.clients) client.terminate();
        wss.close();
        http.closeAllConnections();
        http.close(() => done());
      }),
  };
}