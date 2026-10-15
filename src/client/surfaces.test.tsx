// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { Backbone } from './Backbone.tsx';
import { Stage } from './Stage.tsx';
import { Player } from './Player.tsx';
import type { ShownState, Player as RosterPlayer, BracketState } from '../game/machine.ts';
import { copy, showConfig } from '../content/show.ts';
import { cullQuestions, forPresenter } from '../content/questions.ts';
import { questionsLeft } from '../game/machine.ts';

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
  simulation: { armed: false, mode: 'mixed' },
  bracket: null,
});

/** One question on screen, exactly as the machine would publish it. */
const [theQuestion] = cullQuestions;
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

const ana: RosterPlayer = { id: 'p1', name: 'Ana', connected: true, standing: 'in', simulated: false };
const ben: RosterPlayer = { id: 'p2', name: 'Ben', connected: false, standing: 'in', simulated: false };

describe('the Backbone', () => {
  it('shows every Player who has joined', () => {
    render(<Backbone state={aShow([ana, ben])} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} onSimulate={() => {}} onClearSimulated={() => {}} onSimulateAnswers={() => {}} onSetSimulation={() => {}} />);

    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Ben')).toBeTruthy();
  });

  it('shows who is still connected, so a dropped phone is visible', () => {
    render(<Backbone state={aShow([ana, ben])} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} onSimulate={() => {}} onClearSimulated={() => {}} onSimulateAnswers={() => {}} onSetSimulation={() => {}} />);

    expect(screen.getAllByLabelText(copy.backbone.connection.online)).toHaveLength(1);
    expect(screen.getAllByLabelText(copy.backbone.connection.offline)).toHaveLength(1);
  });

  it('says how full the roster is against the cap', () => {
    render(
      <Backbone
        state={aShow(
          Array.from(
            { length: showConfig.playerCap },
            (_, i) => ({ id: `p${i}`, name: `P${i}`, connected: true, standing: 'in', simulated: false }),
          ),
        )}
        joinUrl={JOIN_URL}
        connection="online"
        onStartShow={() => {}}
        onPresentQuestion={() => {}}
        onReveal={() => {}}
        onSimulate={() => {}}
        onClearSimulated={() => {}}
        onSimulateAnswers={() => {}}
        onSetSimulation={() => {}}
      />,
    );

    expect(screen.getByText(copy.backbone.rosterFull)).toBeTruthy();
    expect(screen.getByText(copy.backbone.rosterCount(showConfig.playerCap))).toBeTruthy();
  });

  it('says when nobody has joined yet', () => {
    render(<Backbone state={aShow()} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} onSimulate={() => {}} onClearSimulated={() => {}} onSimulateAnswers={() => {}} onSetSimulation={() => {}} />);

    expect(screen.getByText(copy.backbone.rosterEmpty)).toBeTruthy();
  });

  it('starts the show when the Presenter says so, and only then', () => {
    const onStartShow = vi.fn();
    const { rerender } = render(
      <Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="online" onStartShow={onStartShow} onPresentQuestion={() => {}} onReveal={() => {}} onSimulate={() => {}} onClearSimulated={() => {}} onSimulateAnswers={() => {}} onSetSimulation={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: copy.backbone.startShow }));
    expect(onStartShow).toHaveBeenCalledTimes(1);

    rerender(<Backbone state={aShow([ana], 'started')} joinUrl={JOIN_URL} connection="online" onStartShow={onStartShow} onPresentQuestion={() => {}} onReveal={() => {}} onSimulate={() => {}} onClearSimulated={() => {}} onSimulateAnswers={() => {}} onSetSimulation={() => {}} />);
    expect(screen.queryByRole('button', { name: copy.backbone.startShow })).toBeNull();
    expect(screen.getByText(copy.backbone.showStarted)).toBeTruthy();
  });

  it('tells the Presenter where a phone should go, and that the firewall may need opening', () => {
    render(<Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="online" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} onSimulate={() => {}} onClearSimulated={() => {}} onSimulateAnswers={() => {}} onSetSimulation={() => {}} />);

    expect(screen.getByText(JOIN_URL)).toBeTruthy();
    expect(screen.getByText(copy.common.firewallNote)).toBeTruthy();
  });

  it('says so plainly when no address could be found', () => {
    render(<Backbone state={aShow([ana])} joinUrl={null} connection="online" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} onSimulate={() => {}} onClearSimulated={() => {}} onSimulateAnswers={() => {}} onSetSimulation={() => {}} />);

    expect(screen.getByText(copy.common.noAddress)).toBeTruthy();
  });

  it('says plainly when it has lost the server', () => {
    render(<Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="offline" onStartShow={() => {}} onPresentQuestion={() => {}} onReveal={() => {}} onSimulate={() => {}} onClearSimulated={() => {}} onSimulateAnswers={() => {}} onSetSimulation={() => {}} />);

    expect(screen.getByText(copy.backbone.status.offline)).toBeTruthy();
  });

  it('offers no control it cannot deliver while the server is gone', () => {
    const onStartShow = vi.fn();
    render(<Backbone state={aShow([ana])} joinUrl={JOIN_URL} connection="offline" onStartShow={onStartShow} onPresentQuestion={() => {}} onReveal={() => {}} onSimulate={() => {}} onClearSimulated={() => {}} onSimulateAnswers={() => {}} onSetSimulation={() => {}} />);

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

  it('shows the whole grid beside the question, because that is the show', () => {
    render(<Stage state={asking({ roster: [ana, ben] })} joinUrl={JOIN_URL} />);

    expect(screen.getByText(theQuestion.prompt)).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Ben')).toBeTruthy();
  });

  it('marks nobody before the reveal, so the room cannot guess who answered', () => {
    render(<Stage state={asking({ roster: [ana, ben] })} joinUrl={JOIN_URL} />);

    expect(screen.queryByText(copy.stage.survived)).toBeNull();
    expect(screen.queryByText(copy.stage.eliminated)).toBeNull();
  });

  it('flips every name at once, and says which way each one went', () => {
    const roster = [
      { ...ana, standing: 'in' as const },
      { ...ben, standing: 'out' as const },
    ];
    render(<Stage state={asking({ roster, phase: 'revealed' })} joinUrl={JOIN_URL} />);

    expect(screen.getByText(copy.stage.survived)).toBeTruthy();
    expect(screen.getByText(copy.stage.eliminated)).toBeTruthy();
  });

  it('tells the two standings apart in the markup, not only in colour', () => {
    const roster = [
      { ...ana, standing: 'in' as const },
      { ...ben, standing: 'out' as const },
    ];
    const { container } = render(<Stage state={asking({ roster, phase: 'revealed' })} joinUrl={JOIN_URL} />);

    // A projector in a bright room with a colour-blind audience: the words are
    // what carry it, and the class is what a screenshot of the grid will show.
    const inName = screen.getByText('Ana').closest('li')!;
    const outName = screen.getByText('Ben').closest('li')!;

    expect(inName.className).toContain('is-in');
    expect(outName.className).toContain('is-out');
    expect(container.querySelectorAll('.names li')).toHaveLength(2);
  });
});

describe('the Backbone during a question', () => {
  const noop = () => {};

  const backbone = (state: ShownState, over: Partial<Parameters<typeof Backbone>[0]> = {}) => (
    <Backbone
      state={state}
      joinUrl={JOIN_URL}
      connection="online"
      onStartShow={noop}
      onPresentQuestion={noop}
      onReveal={noop}
      onSimulate={noop}
      onClearSimulated={noop}
      onSimulateAnswers={noop}
      onSetSimulation={noop}
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

describe('the cull on the Backbone', () => {
  const noop = () => {};

  const backbone = (state: ShownState, over: Partial<Parameters<typeof Backbone>[0]> = {}) => (
    <Backbone
      state={state}
      joinUrl={JOIN_URL}
      connection="online"
      onStartShow={noop}
      onPresentQuestion={noop}
      onReveal={noop}
      onSimulate={noop}
      onClearSimulated={noop}
      onSimulateAnswers={noop}
      onSetSimulation={noop}
      {...over}
    />
  );

  /** Twelve Players after a reveal, of whom `alive` are still in. */
  const cull = (alive: number, over: Partial<ShownState> = {}): ShownState => ({
    ...aShow(
      Array.from({ length: 12 }, (_, i) => ({
        id: `p${i}`,
        name: `Player ${i}`,
        connected: true,
        standing: i < alive ? ('in' as const) : ('out' as const),
        simulated: false,
      })),
      'revealed',
    ),
    asked: [theQuestion.id],
    question: {
      id: theQuestion.id,
      prompt: theQuestion.prompt,
      options: theQuestion.options.map(({ id, label }) => ({ id, label })),
      askedAt: Date.now(),
    },
    answer: {
      questionId: theQuestion.id,
      optionId: theQuestion.correctOptionId,
      optionLabel: theQuestion.options.find((option) => option.id === theQuestion.correctOptionId)!.label,
      submissions: [],
    },
    ...over,
  });

  it('shows the survivor count at all times, even before anything has been asked', () => {
    render(backbone(aShow([ana, ben], 'started')));

    expect(screen.getByText(copy.backbone.survivors(2))).toBeTruthy();
  });

  it('counts only the Players still in', () => {
    render(backbone(cull(8)));

    expect(screen.getByText(copy.backbone.survivors(8))).toBeTruthy();
    expect(screen.queryByText(copy.backbone.survivors(12))).toBeNull();
  });

  it('says the cull is over once the target is met, and offers no further question', () => {
    render(backbone(cull(showConfig.cull.targetPlayers)));

    expect(screen.getByText(copy.backbone.cullComplete)).toBeTruthy();
    expect(screen.queryByRole('button', { name: copy.backbone.presentQuestion })).toBeNull();
  });

  it('offers another question while the target is still unmet', () => {
    render(backbone(cull(showConfig.cull.targetPlayers + 1)));

    expect(screen.queryByText(copy.backbone.cullComplete)).toBeNull();
    expect(screen.getByRole('button', { name: copy.backbone.presentQuestion })).toBeTruthy();
  });

  it('warns the Presenter when the bank is nearly gone and the target is unmet', () => {
    // One question left in the bank, eleven still in the room.
    const nearlySpent = cull(11, { asked: cullQuestions.slice(0, cullQuestions.length - 1).map((q) => q.id) });
    render(backbone(nearlySpent));

    expect(screen.getByText(copy.backbone.queueLow(questionsLeft(nearlySpent)))).toBeTruthy();
  });

  it('says nothing about the queue once the target is met', () => {
    render(backbone(cull(showConfig.cull.targetPlayers)));

    expect(screen.queryByText(copy.backbone.queueLow(1))).toBeNull();
    expect(screen.queryByText(copy.backbone.queueSpent)).toBeNull();
  });

  it('does not offer an empty bracket when the cull emptied the room', () => {
    // A round nobody answered correctly really does empty the roster, and the
    // machine really does call that cull finished. Saying "these are the ones
    // for the bracket" with nothing in the list would be the Presenter being
    // told to carry on into a bracket with no entrants.
    render(backbone(cull(0)));

    expect(screen.getByText(copy.backbone.cullEmpty)).toBeTruthy();
    expect(screen.queryByText(copy.backbone.cullComplete)).toBeNull();
    expect(screen.getByText(copy.backbone.survivors(0))).toBeTruthy();
  });

  it('marks who is simulated, so a rehearsal is never mistaken for a room', () => {
    const roster = [
      { ...ana, simulated: true },
      { ...ben, id: 'sim-1', name: 'Cara', simulated: true },
    ];
    render(backbone(aShow(roster)));

    expect(screen.getAllByText(copy.backbone.simulatedBadge)).toHaveLength(2);
  });

  it('will seed a room on demand, and say how many are there', () => {
    const onSimulate = vi.fn();
    render(backbone(aShow(), { onSimulate }));

    fireEvent.click(screen.getByRole('button', { name: copy.backbone.simulate(11) }));

    expect(onSimulate).toHaveBeenCalledWith(11);
  });

  it('will tear the seeded room down', () => {
    const onClearSimulated = vi.fn();
    render(backbone(aShow(), { onClearSimulated }));

    fireEvent.click(screen.getByRole('button', { name: copy.backbone.clearSimulated }));

    expect(onClearSimulated).toHaveBeenCalledTimes(1);
  });

  it('will not offer to change a roster once the show has begun', () => {
    render(backbone(aShow([ana], 'started')));

    expect((screen.getByRole('button', { name: copy.backbone.simulate(11) }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: copy.backbone.clearSimulated }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(copy.backbone.simLocked)).toBeTruthy();
  });

  it('arms the seeded room to answer every question, and disarms it again', () => {
    const onSetSimulation = vi.fn();
    const armed = cull(11, { simulation: { armed: true, mode: 'mixed' } });
    render(backbone(armed, { onSetSimulation }));

    fireEvent.click(screen.getByRole('button', { name: copy.backbone.simStop }));

    expect(onSetSimulation).toHaveBeenCalledWith(false, 'mixed');
  });

  it('lets the Presenter choose how the seeded room answers', () => {
    const onSetSimulation = vi.fn();
    render(backbone(cull(11), { onSetSimulation }));

    fireEvent.click(screen.getByRole('button', { name: copy.backbone.simMode.wrong }));

    expect(onSetSimulation).toHaveBeenCalledWith(false, 'wrong');
  });

  it('offers to answer now only while a question is open', () => {
    const onSimulateAnswers = vi.fn();
    render(backbone(cull(11), { onSimulateAnswers }));
    expect((screen.getByRole('button', { name: copy.backbone.simNow }) as HTMLButtonElement).disabled).toBe(true);

    render(backbone(asking(), { onSimulateAnswers }));
    expect((screen.getAllByRole('button', { name: copy.backbone.simNow })[1] as HTMLButtonElement).disabled).toBe(
      false,
    );
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

  it('tells a phone that joined late that it is out, and keeps showing the show', () => {
    render(
      phone({
        state: asking(),
        me: null,
        refusal: copy.player.refused.showStarted,
      }),
    );

    // Told plainly...
    expect(screen.getByText(copy.player.refused.showStarted)).toBeTruthy();
    // ...and still a working screen: the question is on it, to watch.
    expect(screen.getByText(theQuestion.prompt)).toBeTruthy();
    expect(screen.queryByRole('button', { name: theQuestion.options[0]!.label })).toBeNull();
  });

  it('tells an eliminated Player they are out, once, and keeps the phone usable', () => {
    const out: RosterPlayer = { ...ana, standing: 'out' };
    render(phone({ state: asking(), me: out }));

    expect(screen.getByText(copy.player.eliminated)).toBeTruthy();
    // Usable: the question is still there to read, and nothing is pressable.
    expect(screen.getByText(theQuestion.prompt)).toBeTruthy();
    expect(screen.queryByRole('button', { name: theQuestion.options[0]!.label })).toBeNull();
    expect(screen.getByText(copy.player.joined('Ana'))).toBeTruthy();
  });
});

describe('the bracket on the surfaces', () => {
  const p1: RosterPlayer = { id: 'p1', name: 'Ana', connected: true, standing: 'in', simulated: false };
  const p2: RosterPlayer = { id: 'p2', name: 'Ben', connected: true, standing: 'in', simulated: false };
  const p3: RosterPlayer = { id: 'p3', name: 'Cara', connected: true, standing: 'in', simulated: false };
  const p4: RosterPlayer = { id: 'p4', name: 'Dan', connected: true, standing: 'in', simulated: false };
  const p5: RosterPlayer = { id: 'p5', name: 'Eva', connected: true, standing: 'in', simulated: false };
  const p6: RosterPlayer = { id: 'p6', name: 'Fay', connected: true, standing: 'in', simulated: false };
  const p7: RosterPlayer = { id: 'p7', name: 'Gia', connected: true, standing: 'in', simulated: false };
  const p8: RosterPlayer = { id: 'p8', name: 'Hal', connected: true, standing: 'in', simulated: false };
  const p9: RosterPlayer = { id: 'p9', name: 'Ian', connected: true, standing: 'in', simulated: false };
  const p10: RosterPlayer = { id: 'p10', name: 'Joy', connected: true, standing: 'in', simulated: false };

  const roster10 = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10];
  const roster8 = [p1, p2, p3, p4, p5, p6, p7, p8];

  const aBracket = (): BracketState => ({
    bouts: [
      { id: 'bout-1', round: 'quarter', index: 0, player1Id: 'p1', player2Id: 'p2', winnerId: null },
      { id: 'bout-2', round: 'quarter', index: 1, player1Id: 'p3', player2Id: 'p4', winnerId: null },
      { id: 'bout-3', round: 'quarter', index: 2, player1Id: 'p5', player2Id: 'p6', winnerId: null },
      { id: 'bout-4', round: 'quarter', index: 3, player1Id: 'p7', player2Id: 'p8', winnerId: null },
      { id: 'bout-5', round: 'semi', index: 4, player1Id: null, player2Id: null, winnerId: null },
      { id: 'bout-6', round: 'semi', index: 5, player1Id: null, player2Id: null, winnerId: null },
      { id: 'bout-7', round: 'final', index: 6, player1Id: null, player2Id: null, winnerId: null },
    ],
    currentBoutId: 'bout-1',
    finalistId: null,
    seed: 42,
  });

  const backbone = (state: ShownState, over: Partial<Parameters<typeof Backbone>[0]> = {}) => (
    <Backbone
      state={state}
      joinUrl={JOIN_URL}
      connection="online"
      onStartShow={() => {}}
      onPresentQuestion={() => {}}
      onReveal={() => {}}
      onSimulate={() => {}}
      onClearSimulated={() => {}}
      onSimulateAnswers={() => {}}
      onSetSimulation={() => {}}
      {...over}
    />
  );

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

  describe('Backbone bracket controls', () => {
    it('offers trim control when cull ends with > 8 survivors, and trims to 8', () => {
      const onTrimCull = vi.fn();
      // 10 survivors after 1 question
      const state: ShownState = {
        ...aShow(roster10, 'revealed'),
        asked: [theQuestion.id],
        question: null,
        answer: null,
      };

      render(backbone(state, { onTrimCull }));

      expect(screen.getByText(copy.backbone.trimHeading)).toBeTruthy();
      expect(screen.getByText(copy.backbone.trimInstruction)).toBeTruthy();

      // Check 8 checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(10);
      for (let i = 0; i < 8; i++) {
        fireEvent.click(checkboxes[i]!);
      }

      const confirmButton = screen.getByRole('button', { name: copy.backbone.trimConfirm });
      expect((confirmButton as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(confirmButton);

      expect(onTrimCull).toHaveBeenCalledWith(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
    });

    it('offers "Simulan ang Bracket" when survivors <= 8', () => {
      const onSeedBracket = vi.fn();
      const state: ShownState = {
        ...aShow(roster8, 'revealed'),
        asked: [theQuestion.id],
        question: null,
        answer: null,
      };

      render(backbone(state, { onSeedBracket }));

      const seedButton = screen.getByRole('button', { name: copy.backbone.startBracket });
      expect(seedButton).toBeTruthy();
      fireEvent.click(seedButton);

      expect(onSeedBracket).toHaveBeenCalledTimes(1);
    });

    it('displays ambiguous rules and bout information when bracket is active', () => {
      const state: ShownState = {
        ...aShow(roster8, 'started'),
        bracket: aBracket(),
      };

      render(backbone(state));

      expect(screen.getByText(copy.backbone.bracketHeading)).toBeTruthy();
      expect(screen.getByText(copy.backbone.ambiguousRules)).toBeTruthy();
      expect(screen.getByText(/Quarterfinals/)).toBeTruthy();
    });

    it('provides deliberate confirmed action to reverse a mistaken elimination', () => {
      const onReverseElimination = vi.fn();
      const rosterWithOut: RosterPlayer[] = [
        ...roster8.slice(0, 7),
        { ...p8, standing: 'out' as const },
      ];
      const state: ShownState = {
        ...aShow(rosterWithOut, 'started'),
        bracket: aBracket(),
      };

      render(backbone(state, { onReverseElimination }));

      // Find reverse elimination button for p8
      const reverseButton = screen.getByRole('button', { name: copy.backbone.reverseElimination });
      expect(reverseButton).toBeTruthy();

      // Click: should show confirmation
      fireEvent.click(reverseButton);
      const confirmButton = screen.getByRole('button', { name: copy.backbone.confirmReverse });
      expect(confirmButton).toBeTruthy();

      // Click confirm: triggers action
      fireEvent.click(confirmButton);

      expect(onReverseElimination).toHaveBeenCalledWith('p8');
    });
  });

  describe('Stage bracket rendering', () => {
    it('shows the surviving bracket tree throughout when bracket is active', () => {
      const state: ShownState = {
        ...aShow(roster8, 'started'),
        bracket: aBracket(),
      };

      render(<Stage state={state} joinUrl={JOIN_URL} />);

      expect(screen.getByText(copy.stage.bracketHeading)).toBeTruthy();
      expect(screen.getByText('Quarterfinals')).toBeTruthy();
      expect(screen.getByText('Semifinals')).toBeTruthy();
      expect(screen.getByText('Final')).toBeTruthy();
    });

    it('never highlights the correct answer on Stage during a bout', () => {
      const state: ShownState = {
        ...asking({
          roster: roster8,
          phase: 'revealed',
          bracket: aBracket(),
          answer: {
            questionId: theQuestion.id,
            optionId: theQuestion.correctOptionId,
            optionLabel: theQuestion.options.find((o) => o.id === theQuestion.correctOptionId)!.label,
            submissions: [],
          },
        }),
      };

      const { container } = render(<Stage state={state} joinUrl={JOIN_URL} />);

      // Acceptance Criteria 9: The correct answer is visible on the Backbone only, and never on the Stage
      const correctOptionElements = container.querySelectorAll('.is-correct');
      expect(correctOptionElements).toHaveLength(0);
    });

    it('shows winner callout on reveal during a bout', () => {
      const bracket = aBracket();
      bracket.bouts[0]!.winnerId = 'p1';
      const state: ShownState = {
        ...asking({
          roster: roster8,
          phase: 'revealed',
          bracket,
          answer: {
            questionId: theQuestion.id,
            optionId: theQuestion.correctOptionId,
            optionLabel: theQuestion.options.find((o) => o.id === theQuestion.correctOptionId)!.label,
            submissions: [],
          },
        }),
      };

      render(<Stage state={state} joinUrl={JOIN_URL} />);

      expect(screen.getByText(copy.stage.winner('Ana'))).toBeTruthy();
    });
  });

  describe('Player phone in bracket', () => {
    it('tells waiting players they are waiting for their turn without showing question options', () => {
      // p3 is waiting for bout 2; bout 1 is currently active between p1 and p2
      const state: ShownState = {
        ...asking({
          roster: roster8,
          bracket: aBracket(),
        }),
      };

      render(phone({ state, me: p3 }));

      expect(screen.getByText(copy.player.waitingForTurn)).toBeTruthy();
      // Acceptance Criteria 8: waiting players told they are waiting for their turn (no question options)
      expect(screen.queryByRole('button', { name: theQuestion.options[0]!.label })).toBeNull();
      expect(screen.queryByText(theQuestion.prompt)).toBeNull();
    });

    it('tells a player who lost a bout immediately and plainly', () => {
      const eliminatedP2: RosterPlayer = { ...p2, standing: 'out' };
      const bracket = aBracket();
      bracket.bouts[0]!.winnerId = 'p1';
      const state: ShownState = {
        ...asking({
          roster: [p1, eliminatedP2, ...roster8.slice(2)],
          phase: 'revealed',
          bracket,
          answer: {
            questionId: theQuestion.id,
            optionId: theQuestion.correctOptionId,
            optionLabel: theQuestion.options.find((o) => o.id === theQuestion.correctOptionId)!.label,
            submissions: [],
          },
        }),
      };

      render(phone({ state, me: eliminatedP2 }));

      // Acceptance Criteria 8: losers told immediately and plainly
      expect(screen.getByText(copy.player.boutLost)).toBeTruthy();
      expect(screen.queryByRole('button', { name: theQuestion.options[0]!.label })).toBeNull();
    });

    it('shows question and active options to fighters in the current bout', () => {
      const state: ShownState = {
        ...asking({
          roster: roster8,
          bracket: aBracket(),
        }),
      };

      render(phone({ state, me: p1 }));

      expect(screen.getByText(theQuestion.prompt)).toBeTruthy();
      for (const opt of theQuestion.options) {
        expect(screen.getByRole('button', { name: opt.label })).toBeTruthy();
      }
    });
  });
});