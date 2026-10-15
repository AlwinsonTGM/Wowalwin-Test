// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Player } from './Player.tsx';
import { useShow } from './useShow.ts';
import { copy } from '../content/show.ts';

const TOKEN_KEY = 'wowolwin.player-token';

/** Stands in for the network, which is the only thing this test replaces. */
class FakeSocket {
  static opened: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];

  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
  }

  static last(): FakeSocket {
    return FakeSocket.opened[FakeSocket.opened.length - 1]!;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.onclose?.();
  }

  open() {
    this.onopen?.();
  }

  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function Phone() {
  const show = useShow();
  return (
    <Player
      state={show.state}
      me={show.me}
      refusal={show.refusal}
      complaint={show.complaint}
      connection={show.connection}
      onJoin={show.join}
    />
  );
}

const joinState = { kind: 'state', state: { phase: 'joining', roster: [{ id: 'p1', name: 'Ana', connected: true }] } };

beforeEach(() => {
  FakeSocket.opened = [];
  localStorage.clear();
  vi.stubGlobal('WebSocket', FakeSocket);
  window.history.pushState({}, '', '/play');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a Player phone', () => {
  it('comes back to the same place on the roster with the token it kept', () => {
    localStorage.setItem(TOKEN_KEY, 'p1');
    render(<Phone />);

    act(() => FakeSocket.last().open());

    expect(FakeSocket.last().sent.map((s) => JSON.parse(s))).toEqual([{ kind: 'join', token: 'p1' }]);
  });

  it('keeps the token the server hands it, so a refresh does not lose the place', () => {
    render(<Phone />);
    const socket = FakeSocket.last();
    act(() => socket.open());

    act(() => socket.receive({ kind: 'joinAck', outcome: 'joined', token: 'p1' }));
    act(() => socket.receive(joinState));

    expect(localStorage.getItem(TOKEN_KEY)).toBe('p1');
    expect(screen.getByText(copy.player.joined('Ana'))).toBeTruthy();
  });

  it('is told plainly when the show has begun before it could join', () => {
    render(<Phone />);
    const socket = FakeSocket.last();
    act(() => socket.open());

    act(() => socket.receive({ kind: 'joinAck', outcome: 'showStarted' }));

    expect(screen.getByText(copy.player.refused.showStarted)).toBeTruthy();
  });

  it('shows the show’s complaint about a name next to the form', () => {
    render(<Phone />);
    const socket = FakeSocket.last();
    act(() => socket.open());

    act(() => socket.receive({ kind: 'joinAck', outcome: 'nameRequired' }));

    expect(screen.getByText(copy.player.nameRequired)).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.player.joinButton })).toBeTruthy();
  });

  it('does not claim a Player on the Backbone, which shares the presenter’s browser', () => {
    localStorage.setItem(TOKEN_KEY, 'p1');
    window.history.pushState({}, '', '/');
    render(<Phone />);

    act(() => FakeSocket.last().open());

    expect(FakeSocket.last().sent).toEqual([]);
  });

  it('reaches for the server again by itself after dropping off the hotspot', () => {
    vi.useFakeTimers();
    render(<Phone />);
    const socket = FakeSocket.last();
    act(() => socket.open());
    expect(FakeSocket.opened).toHaveLength(1);

    act(() => socket.close());
    expect(screen.getByText(copy.player.reconnecting)).toBeTruthy();

    act(() => void vi.advanceTimersByTime(1000));
    act(() => FakeSocket.last().open());

    expect(FakeSocket.opened).toHaveLength(2);
    expect(screen.queryByText(copy.player.reconnecting)).toBeNull();
  });
});