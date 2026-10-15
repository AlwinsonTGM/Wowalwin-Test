import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnswerOutcome, JoinOutcome, ShownState } from '../game/machine.ts';
import type { Player as RosterPlayer } from '../game/machine.ts';
import type { SimulationMode } from '../game/events.ts';
import type { ServerMessage } from '../shared/protocol.ts';
import { copy, showConfig } from '../content/show.ts';
import { surfaceFor } from './surface.ts';

export type Connection = 'connecting' | 'online' | 'offline';

/** Held in the phone's own storage, so a reload or a locked screen comes back. */
const TOKEN_KEY = 'wowolwin.player-token';

// Only the Player phone holds a token. The Backbone and the Stage sit on the
// presenter's own laptop, so a token left in that browser would claim a Player
// who is not in the room.
const isPlayerPhone = () => surfaceFor(location.pathname) === 'player';

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
  const [state, setState] = useState<ShownState>({
    phase: 'joining',
    roster: [],
    asked: [],
    question: null,
    answer: null,
    simulation: { armed: false, mode: 'mixed' },
    bracket: null,
    finale: null,
    deck: { active: false, slideIndex: 0 },
  });
  /** undefined until the server says; null once it has said there is none. */
  const [joinHost, setJoinHost] = useState<string | null | undefined>(undefined);
  const [isRehearsal, setIsRehearsal] = useState<boolean>(false);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [token, setToken] = useState<string | null>(() =>
    isPlayerPhone() ? localStorage.getItem(TOKEN_KEY) : null,
  );
  const [ack, setAck] = useState<Extract<ServerMessage, { kind: 'joinAck' }> | null>(null);
  const [answerAck, setAnswerAck] = useState<AnswerOutcome | null>(null);
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
        if (message.kind === 'serverInfo') {
          setJoinHost(message.joinHost);
          if (message.isRehearsal !== undefined) setIsRehearsal(message.isRehearsal);
        }
        if (message.kind === 'answerAck') setAnswerAck(message.outcome);
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

  // A click in the second before the socket is back would go into a closed
  // socket, which the browser drops without a word: the Presenter taps "Simulan
  // ang show", the status says the connection is gone, and nothing happens.
  const send = useCallback(
    (message: unknown) => {
      if (connection !== 'online') return;
      socket.current?.send(JSON.stringify(message));
    },
    [connection],
  );

  const me: RosterPlayer | null = token ? (state.roster.find((player) => player.id === token) ?? null) : null;
  const outcome = ack?.outcome;
  const port = location.port ? `:${location.port}` : '';

  return {
    state,
    connection,
    isRehearsal,
    me,
    /** The show's answer to a name it would not accept. */
    complaint: outcome ? complaintFor(outcome) : null,
    /** The show's answer to a Player who can no longer play. The other refusals are a name to retype. */
    refusal: outcome === 'rosterFull' || outcome === 'showStarted' ? copy.player.refused[outcome] : null,
    joinUrl: joinHost === undefined ? undefined : joinHost ? `${location.protocol}//${joinHost}${port}${showConfig.playerPath}` : null,
    join: (name: string) => send({ kind: 'join', name }),
    startShow: () => send({ kind: 'startShow' }),
    presentQuestion: () => send({ kind: 'presentQuestion' }),
    submitAnswer: (optionId: string, playerId?: string) => send({ kind: 'submitAnswer', optionId, playerId }),
    reveal: () => send({ kind: 'reveal' }),
    /** The rehearsal room (ticket 03). Seeded server-side, never connected. */
    simulate: (count: number) => send({ kind: 'simulatePlayers', count }),
    clearSimulated: () => send({ kind: 'clearSimulated' }),
    simulateAnswers: () => send({ kind: 'simulateAnswers' }),
    setSimulation: (armed: boolean, mode: SimulationMode) => send({ kind: 'setSimulation', armed, mode }),
    /** Bracket actions (ticket 04) */
    trimCull: (survivorIds: string[]) => send({ kind: 'trimCull', survivorIds }),
    seedBracket: (seed?: number) => send({ kind: 'seedBracket', seed }),
    rerunBout: () => send({ kind: 'rerunBout' }),
    resolveBoutDirectly: (boutId: string, winnerId: string) =>
      send({ kind: 'resolveBoutDirectly', boutId, winnerId }),
    reverseElimination: (playerId: string) => send({ kind: 'reverseElimination', playerId }),
    /** Finale actions (ticket 05) */
    startFinale: (seed?: number) => send({ kind: 'startFinale', seed }),
    choosePera: () => send({ kind: 'choosePera' }),
    chooseKahon: (seed?: number) => send({ kind: 'chooseKahon', seed }),
    revealKahon: () => send({ kind: 'revealKahon' }),
    /** The Deck actions (ticket 07) */
    openDeck: (slideIndex?: number) => send({ kind: 'openDeck', slideIndex }),
    closeDeck: () => send({ kind: 'closeDeck' }),
    setDeckSlide: (slideIndex: number) => send({ kind: 'setDeckSlide', slideIndex }),
    nextDeckSlide: () => send({ kind: 'nextDeckSlide' }),
    prevDeckSlide: () => send({ kind: 'prevDeckSlide' }),
    /** The show's own words for how this phone's last submission went. */
    answerNote: answerAck === null ? null : copy.player.answer[answerAck],
  };
}