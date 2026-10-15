// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Backbone } from './Backbone.tsx';
import { Stage } from './Stage.tsx';
import { Player } from './Player.tsx';
import type { GameState, Player as RosterPlayer } from '../game/machine.ts';
import { copy, showConfig } from '../content/show.ts';

afterEach(cleanup);

const JOIN_URL = 'http://192.168.137.1:8787/play';

const aShow = (roster: RosterPlayer[] = [], phase: GameState['phase'] = 'joining'): GameState => ({
  phase,
  roster,
});

const ana: RosterPlayer = { id: 'p1', name: 'Ana', connected: true };
const ben: RosterPlayer = { id: 'p2', name: 'Ben', connected: false };

describe('the Backbone', () => {
  it('shows every Player who has joined', () => {
    render(<Backbone state={aShow([ana, ben])} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} />);

    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Ben')).toBeTruthy();
  });

  it('shows who is still connected, so a dropped phone is visible', () => {
    render(<Backbone state={aShow([ana, ben])} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} />);

    expect(screen.getAllByLabelText(copy.backbone.connection.online)).toHaveLength(1);
    expect(screen.getAllByLabelText(copy.backbone.connection.offline)).toHaveLength(1);
  });

  it('says how full the roster is against the cap', () => {
    render(
      <Backbone
        state={aShow(Array.from({ length: showConfig.playerCap }, (_, i) => ({ id: `p${i}`, name: `P${i}`, connected: true })))}
        joinUrl={JOIN_URL}
        connection="online"
        onStartShow={() => {}}
      />,
    );

    expect(screen.getByText(copy.backbone.rosterFull)).toBeTruthy();
    expect(screen.getByText(copy.backbone.rosterCount(showConfig.playerCap))).toBeTruthy();
  });

  it('says when nobody has joined yet', () => {
    render(<Backbone state={aShow()} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} />);

    expect(screen.getByText(copy.backbone.rosterEmpty)).toBeTruthy();
  });

  it('starts the show when the Presenter says so, and only then', () => {
    const onStartShow = vi.fn();
    const { rerender } = render(
      <Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="online" onStartShow={onStartShow} />,
    );

    fireEvent.click(screen.getByRole('button', { name: copy.backbone.startShow }));
    expect(onStartShow).toHaveBeenCalledTimes(1);

    rerender(<Backbone state={aShow([ana], 'started')} joinUrl={JOIN_URL} connection="online" onStartShow={onStartShow} />);
    expect(screen.queryByRole('button', { name: copy.backbone.startShow })).toBeNull();
    expect(screen.getByText(copy.backbone.showStarted)).toBeTruthy();
  });

  it('tells the Presenter where a phone should go, and that the firewall may need opening', () => {
    render(<Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} />);

    expect(screen.getByText(JOIN_URL)).toBeTruthy();
    expect(screen.getByText(copy.common.firewallNote)).toBeTruthy();
  });

  it('says so plainly when no address could be found', () => {
    render(<Backbone state={aShow([ana])} joinUrl={null} connection="online" onStartShow={() => {}} />);

    expect(screen.getByText(copy.common.noAddress)).toBeTruthy();
  });

  it('says plainly when it has lost the server', () => {
    render(<Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="offline" onStartShow={() => {}} />);

    expect(screen.getByText(copy.backbone.status.offline)).toBeTruthy();
  });

  it('offers no control it cannot deliver while the server is gone', () => {
    const onStartShow = vi.fn();
    render(<Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="offline" onStartShow={onStartShow} />);

    // A click here would reach a closed socket and vanish silently, which reads
    // to a Presenter as a broken button rather than a broken connection.
    const button = screen.getByRole('button', { name: copy.backbone.startShow }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    expect(onStartShow).not.toHaveBeenCalled();
  });
});

describe('the Stage', () => {
  it('shows the address a phone can open, so nobody has to guess it', () => {
    render(<Stage state={aShow()} joinUrl={JOIN_URL} />);

    expect(screen.getByText(JOIN_URL)).toBeTruthy();
  });

  it('tells the room what to do if a phone cannot get in', () => {
    render(<Stage state={aShow()} joinUrl={JOIN_URL} />);

    expect(screen.getByText(copy.common.firewallNote)).toBeTruthy();
  });

  it('says so plainly when no address could be found', () => {
    render(<Stage state={aShow()} joinUrl={null} />);

    expect(screen.getByText(copy.common.noAddress)).toBeTruthy();
  });

  it('says nothing about the address until the server has answered', () => {
    render(<Stage state={aShow()} joinUrl={undefined} />);

    expect(screen.queryByText(copy.common.noAddress)).toBeNull();
  });

  it('shows every Player who has joined', () => {
    render(<Stage state={aShow([ana, ben])} joinUrl={JOIN_URL} />);

    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Ben')).toBeTruthy();
    expect(screen.getByText(copy.stage.rosterCount(2))).toBeTruthy();
  });

  it('waits for Players instead of showing an empty grid', () => {
    render(<Stage state={aShow()} joinUrl={JOIN_URL} />);

    expect(screen.getByText(copy.stage.rosterEmpty)).toBeTruthy();
  });
});

describe('the Player phone', () => {
  const phone = (over: Partial<Parameters<typeof Player>[0]> = {}) => (
    <Player state={aShow()} me={null} refusal={null} complaint={null} connection="online" onJoin={() => {}} {...over} />
  );

  it('sends the name that was typed, and lets the show decide whether it stands', () => {
    const onJoin = vi.fn();
    render(phone({ onJoin }));

    fireEvent.change(screen.getByPlaceholderText(copy.player.namePlaceholder), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: copy.player.joinButton }));

    expect(onJoin).toHaveBeenCalledWith('Ana');
  });

  it('shows the show’s complaint about a name next to the form, so it can be retyped', () => {
    render(phone({ complaint: copy.player.nameRequired }));

    expect(screen.getByText(copy.player.nameRequired)).toBeTruthy();
    expect(screen.getByPlaceholderText(copy.player.namePlaceholder)).toBeTruthy();
  });

  it('confirms the Player is in, by name, so nobody joins anonymously by surprise', () => {
    render(phone({ state: aShow([ana, ben]), me: ana }));

    expect(screen.getByText(copy.player.joined('Ana'))).toBeTruthy();
    expect(screen.getByText(copy.player.joinedCount(2))).toBeTruthy();
    expect(screen.queryByPlaceholderText(copy.player.namePlaceholder)).toBeNull();
  });

  it('tells a Player who cannot play why, instead of leaving them waiting', () => {
    render(phone({ refusal: copy.player.refused.rosterFull }));

    expect(screen.getByText(copy.player.refused.rosterFull)).toBeTruthy();
    expect(screen.queryByRole('button', { name: copy.player.joinButton })).toBeNull();
  });

  it('says it is reconnecting rather than pretending it is fine', () => {
    render(phone({ state: aShow([ana]), me: ana, connection: 'connecting' }));

    expect(screen.getByText(copy.player.reconnecting)).toBeTruthy();
  });
});