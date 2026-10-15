// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { Backbone } from './Backbone.tsx';
import { Stage } from './Stage.tsx';
import { Player } from './Player.tsx';
import type { ShownState, Player as RosterPlayer } from '../game/machine.ts';
import { copy, forPresenter, questionBank, showConfig } from '../content/show.ts';

/**
 * The Backbone is the one surface that speaks, and these tests are about what
 * it shows. The device is replaced so jsdom is not asked to make a noise it has
 * no way to make; the sound itself is tested in sound.test.ts and
 * useShowSound.test.tsx, both of which drive the real `createSound`.
 */
vi.mock('./sound.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sound.ts')>();
  return { ...actual, createSound: () => ({ play: () => {}, setMuted: () => {} }) };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const JOIN_URL = 'http://192.168.137.1:8787/play';

/**
 * What a socket is given: never the sealed submissions (ADR-0003), which is why
 * this builds a `ShownState` and not the machine's own.
 */
const aShow = (roster: RosterPlayer[] = [], phase: ShownState['phase'] = 'joining'): ShownState => ({
  phase,
  roster,
  asked: [],
  question: null,
  answer: null,
});

/** One question on screen, exactly as the machine would publish it. */
const [theQuestion] = questionBank;
if (!theQuestion) throw new Error('the question bank needs a question for these tests');

const asking = (over: Partial<ShownState> = {}): ShownState => ({
  ...aShow([], 'answering'),
  asked: [theQuestion.id],
  question: {
    id: theQuestion.id,
    prompt: theQuestion.prompt,
    options: theQuestion.options.map(({ id, label }) => ({ id, label })),
    askedAt: Date.now(),
  },
  ...over,
});

const revealed = (): ShownState => ({
  ...asking({ phase: 'revealed' }),
  answer: {
    questionId: theQuestion.id,
    optionId: theQuestion.correctOptionId,
    optionLabel: theQuestion.options.find((option) => option.id === theQuestion.correctOptionId)!.label,
    submissions: [{ playerId: 'p1', optionId: theQuestion.correctOptionId }],
  },
});

const ana: RosterPlayer = { id: 'p1', name: 'Ana', connected: true };
const ben: RosterPlayer = { id: 'p2', name: 'Ben', connected: false };

describe('the Backbone', () => {
  it('shows every Player who has joined', () => {
    render(<Backbone state={aShow([ana, ben])} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} />);

    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Ben')).toBeTruthy();
  });

  it('shows who is still connected, so a dropped phone is visible', () => {
    render(<Backbone state={aShow([ana, ben])} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} />);

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
        onPresentQuestion={() => {}}
        onReveal={() => {}}
      />,
    );

    expect(screen.getByText(copy.backbone.rosterFull)).toBeTruthy();
    expect(screen.getByText(copy.backbone.rosterCount(showConfig.playerCap))).toBeTruthy();
  });

  it('says when nobody has joined yet', () => {
    render(<Backbone state={aShow()} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} />);

    expect(screen.getByText(copy.backbone.rosterEmpty)).toBeTruthy();
  });

  it('starts the show when the Presenter says so, and only then', () => {
    const onStartShow = vi.fn();
    const { rerender } = render(
      <Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="online" onStartShow={onStartShow} onPresentQuestion={() => {}} onReveal={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: copy.backbone.startShow }));
    expect(onStartShow).toHaveBeenCalledTimes(1);

    rerender(<Backbone state={aShow([ana], 'started')} joinUrl={JOIN_URL} connection="online" onStartShow={onStartShow} onPresentQuestion={() => {}} onReveal={() => {}} />);
    expect(screen.queryByRole('button', { name: copy.backbone.startShow })).toBeNull();
    expect(screen.getByText(copy.backbone.showStarted)).toBeTruthy();
  });

  it('tells the Presenter where a phone should go, and that the firewall may need opening', () => {
    render(<Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} />);

    expect(screen.getByText(JOIN_URL)).toBeTruthy();
    expect(screen.getByText(copy.common.firewallNote)).toBeTruthy();
  });

  it('says so plainly when no address could be found', () => {
    render(<Backbone state={aShow([ana])} joinUrl={null} connection="online" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} />);

    expect(screen.getByText(copy.common.noAddress)).toBeTruthy();
  });

  it('says plainly when it has lost the server', () => {
    render(<Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="offline" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} />);

    expect(screen.getByText(copy.backbone.status.offline)).toBeTruthy();
  });

  it('offers no control it cannot deliver while the server is gone', () => {
    const onStartShow = vi.fn();
    render(<Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="offline" onStartShow={onStartShow} onPresentQuestion={() => {}} onReveal={() => {}} />);

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

  it('shows the question and every option, exactly as the phone is showing them', () => {
    render(<Stage state={asking()} joinUrl={JOIN_URL} />);

    expect(screen.getByText(theQuestion.prompt)).toBeTruthy();
    for (const option of theQuestion.options) {
      expect(screen.getByText(option.label)).toBeTruthy();
    }
  });

  it('holds the join screen back until a question goes up', () => {
    render(<Stage state={aShow()} joinUrl={JOIN_URL} />);
    expect(screen.queryByText(theQuestion.prompt)).toBeNull();
  });

  it('marks the correct answer and names it, the moment the Presenter reveals', () => {
    render(<Stage state={revealed()} joinUrl={JOIN_URL} />);

    const correct = theQuestion.options.find((option) => option.id === theQuestion.correctOptionId)!;
    expect(screen.getByText(correct.label)).toBeTruthy();
    expect(screen.getByText(copy.stage.answerHeading)).toBeTruthy();
    expect(screen.queryByRole('timer')).toBeNull();
  });

  it('never shows the Backbone’s answer or the Presenter’s line', () => {
    render(<Stage state={revealed()} joinUrl={JOIN_URL} />);

    expect(screen.queryByText(theQuestion.cue)).toBeNull();
    expect(screen.queryByText(copy.backbone.cueHeading)).toBeNull();
    expect(screen.queryByText(copy.backbone.answerHeading)).toBeNull();
  });
});

describe('the Backbone during a question', () => {
  const backbone = (state: ShownState, over: Partial<Parameters<typeof Backbone>[0]> = {}) => (
    <Backbone
      state={state}
      joinUrl={JOIN_URL}
      connection="online"
      onStartShow={() => {}}
      onPresentQuestion={() => {}}
      onReveal={() => {}}
      {...over}
    />
  );

  const held = forPresenter(theQuestion.id)!;

  it('counts down to the reveal, so the Presenter knows when to press it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    render(backbone(asking()));

    expect(screen.getByText(copy.backbone.countdown(showConfig.timings.answerSeconds))).toBeTruthy();

    act(() => void vi.advanceTimersByTime(4000));

    expect(screen.getByText(copy.backbone.countdown(showConfig.timings.answerSeconds - 4))).toBeTruthy();
  });

  it('offers the reveal only once the window has closed, and says so while it counts', () => {
    const { rerender } = render(backbone(asking()));
    expect(screen.queryByRole('button', { name: copy.backbone.reveal })).toBeNull();

    rerender(backbone(asking({ phase: 'revealPending' })));

    expect(screen.getByText(copy.backbone.windowClosed)).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.backbone.reveal })).toBeTruthy();
  });

  it('reveals when the Presenter presses it', () => {
    const onReveal = vi.fn();
    render(backbone(asking({ phase: 'revealPending' }), { onReveal }));

    fireEvent.click(screen.getByRole('button', { name: copy.backbone.reveal }));

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('asks for a question when the Presenter asks for one', () => {
    const onPresentQuestion = vi.fn();
    render(backbone(aShow([ana], 'started'), { onPresentQuestion }));

    fireEvent.click(screen.getByRole('button', { name: copy.backbone.presentQuestion }));

    expect(onPresentQuestion).toHaveBeenCalledTimes(1);
  });

  it('holds the correct answer and the cue line from the moment the question goes up', () => {
    render(backbone(asking()));

    expect(screen.getByText(held.answer)).toBeTruthy();
    expect(screen.getByText(held.cue)).toBeTruthy();
  });

  it('says nothing about who has answered until the reveal, then says how many did', () => {
    const { rerender } = render(backbone(asking()));

    expect(screen.queryByText(copy.backbone.submitted(1))).toBeNull();
    expect(screen.queryByText(copy.backbone.submittedNone)).toBeNull();

    rerender(backbone(revealed()));

    expect(screen.getByText(copy.backbone.submitted(1))).toBeTruthy();
  });

  it('offers one control that silences everything', () => {
    render(backbone(asking()));

    const mute = screen.getByRole('button', { name: copy.backbone.mute });
    fireEvent.click(mute);

    expect(screen.getByRole('button', { name: copy.backbone.unmute })).toBeTruthy();
    expect(screen.getByText(copy.backbone.muted)).toBeTruthy();
  });
});

describe('the Player phone', () => {
  const phone = (over: Partial<Parameters<typeof Player>[0]> = {}) => (
    <Player
      state={aShow()}
      me={null}
      refusal={null}
      complaint={null}
      connection="online"
      answerNote={null}
      onJoin={() => {}}
      onSubmitAnswer={() => {}}
      {...over}
    />
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

  it('shows the question and every option while the window is open', () => {
    render(phone({ state: asking(), me: ana }));

    expect(screen.getByText(theQuestion.prompt)).toBeTruthy();
    for (const option of theQuestion.options) {
      expect(screen.getByRole('button', { name: option.label })).toBeTruthy();
    }
  });

  it('sends the option the Player tapped', () => {
    const onSubmitAnswer = vi.fn();
    render(phone({ state: asking(), me: ana, onSubmitAnswer }));

    fireEvent.click(screen.getByRole('button', { name: theQuestion.options[1]!.label }));

    expect(onSubmitAnswer).toHaveBeenCalledWith(theQuestion.options[1]!.id);
  });

  it('shows the show’s acknowledgement, so a Player knows it registered', () => {
    render(phone({ state: asking(), me: ana, answerNote: copy.player.answer.recorded }));

    expect(screen.getByText(copy.player.answer.recorded)).toBeTruthy();
  });

  it('shows nothing but the prompt when no answer is in yet', () => {
    render(phone({ state: asking(), me: ana }));

    expect(screen.getByText(copy.player.chooseAnswer)).toBeTruthy();
  });

  it('locks every option once the window has closed', () => {
    render(phone({ state: asking({ phase: 'revealPending' }), me: ana }));

    for (const option of theQuestion.options) {
      expect((screen.getByRole('button', { name: option.label }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByText(copy.player.windowClosed)).toBeTruthy();
  });

  it('never reveals, even after the answer is on the Stage', () => {
    render(phone({ state: revealed(), me: ana }));

    // The question is still on the phone, so the correct option is one
    // unremarkable disabled button among four. What the phone must not do is
    // single it out, name it, or repeat the line the Presenter reads from.
    const correct = theQuestion.options.find((option) => option.id === theQuestion.correctOptionId)!;
    expect((screen.getByRole('button', { name: correct.label }) as HTMLButtonElement).className).not.toContain(
      'is-correct',
    );
    expect(screen.queryByText(copy.stage.answerHeading)).toBeNull();
    expect(screen.queryByText(theQuestion.cue)).toBeNull();
  });

  it('shows no question at all to a Player who is not in the show', () => {
    render(phone({ state: asking(), me: null }));

    expect(screen.queryByText(theQuestion.prompt)).toBeNull();
  });
});