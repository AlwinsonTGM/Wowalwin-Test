import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, JoinOutcome, Player as RosterPlayer } from '../game/machine.ts';
import type { ServerMessage } from '../shared/protocol.ts';
import { copy, showConfig } from '../content/show.ts';

export type Connection = 'connecting' | 'online' | 'offline';

/** Held in the phone's own storage, so a reload or a locked screen comes back. */
const TOKEN_KEY = 'wowolwin.player-token';

// Only the Player phone holds a token. The Backbone and the Stage sit on the
// presenter's own laptop, so a token left in that browser would claim a Player
// who is not in the room.
const isPlayerPhone = () => location.pathname === showConfig.playerPath;

const complaintFor = (outcome: JoinOutcome): string | null => {
  if (outcome === 'nameRequired') return copy.player.nameRequired;
  if (outcome === 'nameTooLong') return copy.player.nameTooLong(showConfig.maxNameLength);
  return null;
};

/**
 * The socket, and nothing else: every surface is a renderer of the state this
 * returns and a sender of the events it accepts.
 */
export function useShow() {
  const [state, setState] = useState<GameState>({ phase: 'joining', roster: [] });
  /** undefined until the server says; null once it has said there is none. */
  const [joinHost, setJoinHost] = useState<string | null | undefined>(undefined);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [token, setToken] = useState<string | null>(() =>
    isPlayerPhone() ? localStorage.getItem(TOKEN_KEY) : null,
  );
  const [ack, setAck] = useState<Extract<ServerMessage, { kind: 'joinAck' }> | null>(null);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${scheme}://${location.host}/ws`);
      socket.current = ws;

      ws.onopen = () => {
        setConnection('online');
        const known = isPlayerPhone() ? localStorage.getItem(TOKEN_KEY) : null;
        if (known) ws.send(JSON.stringify({ kind: 'join', token: known }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as ServerMessage;

        if (message.kind === 'state') setState(message.state);
        if (message.kind === 'serverInfo') setJoinHost(message.joinHost);
        if (message.kind === 'joinAck') {
          setAck(message);
          if (message.token && isPlayerPhone()) {
            setToken(message.token);
            localStorage.setItem(TOKEN_KEY, message.token);
          }
        }
      };

      // A phone that sleeps and wakes drops its socket without a reload, so the
      // same place on the roster has to be re-claimed when it comes back.
      ws.onclose = () => {
        setConnection('offline');
        if (!closed) retry = setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      closed = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, []);

  const send = useCallback((message: unknown) => socket.current?.send(JSON.stringify(message)), []);

  const me: RosterPlayer | null = token ? (state.roster.find((player) => player.id === token) ?? null) : null;
  const outcome = ack?.outcome;
  const port = location.port ? `:${location.port}` : '';

  return {
    state,
    connection,
    me,
    /** The show's answer to a name it would not accept. */
    complaint: outcome ? complaintFor(outcome) : null,
    /** The show's answer to a Player who can no longer play. The other refusals are a name to retype. */
    refusal: outcome === 'rosterFull' || outcome === 'showStarted' ? copy.player.refused[outcome] : null,
    joinUrl: joinHost === undefined ? undefined : joinHost ? `${location.protocol}//${joinHost}${port}${showConfig.playerPath}` : null,
    join: (name: string) => send({ kind: 'join', name }),
    startShow: () => send({ kind: 'startShow' }),
  };
}