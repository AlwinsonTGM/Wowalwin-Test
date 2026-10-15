import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { startShowServer } from './show-server.ts';
import { writeEventLog } from './event-log.ts';
import { reachableHost } from './address.ts';
import type { ServerMessage, ClientMessage } from '../shared/protocol.ts';
import type { GameState, JoinOutcome } from '../game/machine.ts';
import { copy, showConfig } from '../content/show.ts';

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

      expect(dropped.state.roster).toEqual([{ id: token, name: 'Ana', connected: false }]);

      const returning = surface(port);
      await returning.ready;
      returning.send({ kind: 'join', token });
      const ack = (await returning.next('joinAck')) as Extract<ServerMessage, { kind: 'joinAck' }>;
      const back = (await backbone.next('state')) as Extract<ServerMessage, { kind: 'state' }>;

      expect(ack).toEqual({ kind: 'joinAck', outcome: 'resumed', token });
      expect(back.state.roster).toEqual([{ id: token, name: 'Ana', connected: true }]);
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

      expect(state.state.roster).toEqual([{ id: token, name: 'Ana', connected: true }]);
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

describe('the show at room scale', () => {
  const ROOM = 50;

  /** The next state this surface is told that matches: the ones before are the same show a moment earlier. */
  async function aStateWhere(s: ReturnType<typeof surface>, ok: (state: GameState) => boolean): Promise<GameState> {
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

        const full = (state: GameState) => state.roster.length === showConfig.playerCap;
        const seenByRoom = await Promise.all(live.map((s) => aStateWhere(s, full)));
        expect(seenByRoom.every((state) => state.roster.every((p) => p.connected))).toBe(true);

        const leaving = inRoom('joined').slice(0, 20);
        const witnesses = [...inRoom('joined').slice(20), ...inRoom('rosterFull')].map((i) => phones[i]!);
        leaving.forEach((i) => phones[i]!.drop());

        const gone = (state: GameState) => state.roster.filter((p) => !p.connected).length === leaving.length;
        const seenDrop = await Promise.all([...witnesses, presenter].map((s) => aStateWhere(s, gone)));
        expect(seenDrop.every(full)).toBe(true);

        const returning = leaving.map((i) => surface(port));
        live.push(...returning);
        await Promise.all(returning.map((s) => s.ready));
        returning.forEach((s, i) => s.send({ kind: 'join', token: acks[leaving[i]!]!.token }));
        await Promise.all(returning.map((s) => s.next('joinAck')));

        const everyone = [...witnesses, ...returning];
        const allBack = (state: GameState) => state.roster.every((p) => p.connected);
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

      expect(state.state.roster).toEqual([{ id: ack.token, name: 'Ana', connected: false }]);
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

      expect(state.state.roster).toEqual([{ id: 'p1', name: 'Ana', connected: false }]);
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