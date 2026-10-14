Status: ready-for-agent

# Wowolwin — Module 8 Game Show

## Problem Statement

A group of seven presenters need to deliver a short class presentation on Module 8 of GEE008 (Planning and Failures of Entrepreneurs). The module covers three blocks — the importance of planning, the five planning instruments in the TRIM Framework, and why failure is part of entrepreneurship — and the assessment that follows is a reflection paper graded on insight, examples, and the strength of the link between planning and entrepreneurial outcomes.

Slides alone do not make that memorable. Planning and risk are abstractions, and an audience that has only been told about them has not felt them. The presenters want the class to *experience* the module's central claim instead: that planning is what reduces the risk of a decision made under uncertainty.

They want that experience delivered as a real game show, modelled on a segment Willie Revillame actually hosts, and played live in front of the room rather than described on a slide.

The practical constraints are tight. The whole thing must run in roughly ten minutes. Up to forty classmates are playing from their own phones. Seven presenters are on stage holding prop boxes. One laptop drives everything and also feeds a projector. There is no cloud, no internet hosting, and no time to debug in the room.

## Solution

Build **Wowolwin**, a live three-surface game show, followed by a short HTML deck.

The show is **Pera o Kahon**, Willie Revillame's segment, rebuilt to carry Module 8 content. A Player chooses between **Pera** — a small guaranteed voucher redeemable as food — and a **Kahon** — a mystery box that draws at random from a larger table of prizes, or returns **Bokya**. It was chosen because it is not trivia in costume: choosing under incomplete information is the literal subject of the module, planning is what reduces the risk of that choice, and Bokya is the failure section dramatised.

The show runs in five phases:

1. **Join** — up to 40 Players open a link on their phone and enter a name.
2. **The cull** — whole-room questions run one at a time until 10 or fewer Players remain. After each, every name flips to survived or eliminated at once.
3. **The bracket** — a single-elimination path from the survivors down to one Finalist: 8, then 4, then 2, then 1. Each bout is twenty seconds — ten to answer, five of suspense, five to show the winner.
4. **Pera o Kahon** — the Finalist chooses Pera or opens the Kahon.
5. **The deck** — TRIM in depth and the eight Filipino entrepreneurs who failed first.

It runs on three client surfaces sharing one authoritative state:

- **Backbone** — the operator's laptop. Controls everything, including what the projector shows. Holds the correct answers, the next bout, and a presenter cue line.
- **Stage** — the projector. Everything the room sees, and nothing else.
- **Player phone** — a separate mobile page that submits an answer and nothing more. It never grades, never shows who was first, and never reveals.

The deck follows the game because the game cannot carry everything. The quiz dramatised failure; the deck carries the density the game has no room for.

## User Stories

### Joining

1. As a Player, I want to open a link on my phone and join with nothing but my name, so that I can play without installing anything or creating an account.
2. As a Player, I want immediate confirmation that I have joined, so that I know I am in the game.
3. As a Player, I want to see the join link and a scannable code, so that I can get in without typing a long address.
4. As a Player, I want to see how many others have joined, so that I know the room is filling up.
5. As a Player, I want to know that my name is visible to the room, so that I do not join anonymously by surprise.
6. As a Presenter, I want a live roster on the Backbone, so that I can see exactly who is in and who has not arrived.
7. As a Presenter, I want to see connection health per Player, so that I can spot a phone that dropped before it becomes a problem.
8. As a Presenter, I want to start the show only when I choose to, so that a late arrival cannot force a scramble.
9. As a Presenter, I want a hard cap on the number of Players, so that the cull grid stays legible when projected.
10. As a Player, I want to rejoin seamlessly if my phone sleeps or my connection drops, so that I am not knocked out by a locked screen.
11. As a Player who joins after the show has started, I want to be told plainly whether I can still play, so that I am not left waiting for a turn that will not come.
12. As a Player, I want my phone to warn me before it goes to sleep during a question, so that I do not miss my chance.

### The cull

13. As a Player, I want the question and its options on my phone, so that I can answer without looking up at the projector.
14. As a Player, I want a visible countdown, so that I know how long I have.
15. As a Player, I want to submit only once per question, so that I cannot accidentally answer twice.
16. As a Player, I want my submission acknowledged, so that I know it registered.
17. As a Player, I want to see nothing about who else has answered, so that the suspense is real rather than theatre.
18. As the Room, I want every Player's name visible at once after the reveal, so that the elimination is dramatic and visibly fair.
19. As the Room, I want survivors and eliminated shown in visually distinct ways, so that I can follow who is still in.
20. As a Presenter, I want to control exactly when the reveal happens, so that I can hold the room before it lands.
21. As a Presenter, I want a visible countdown toward the reveal, so that I know when to press it.
22. As a Presenter, I want the correct answer and the survivors' names on the Backbone, so that I can direct the room.
23. As a Presenter, I want the cull to stop by itself once the target player count is reached, so that I am not counting down a grid by hand.
24. As a Presenter, I want to know if the question bank is nearly exhausted, so that I am not surprised when the cull cannot reach its target.
25. As a Presenter, I want the survivor count visible throughout, so that I can pace the show.
26. As an eliminated Player, I want to be told clearly that I am out and that I can still watch, so that I am not left staring at a frozen phone.

### Bouts

27. As a Presenter, I want the two Players in a bout shown on the Stage, so that the room knows who is fighting.
28. As a Player, I want my phone to show the question and options for a bout I am in, so that I can answer.
29. As a Player, I want my phone to say I am waiting if I am not in this bout, so that I know to hold.
30. As a Player, I want to see my own result after the reveal, so that I know whether I advanced.
31. As the Room, I want the winner announced, so that the bracket visibly advances.
32. As the Room, I want the surviving bracket displayed, so that I can track who is left.
33. As a Presenter, I want each bout to run ten seconds of answering, five of suspense, and five to show the winner, so that the pacing is tight and predictable.
34. As a Presenter, I want the bracket to advance itself once a bout resolves, so that I am not wiring winners onward by hand.
35. As a Player who lost a bout, I want to know immediately, so that I understand the result without asking.
36. As a Presenter, I want the rules for ambiguous outcomes restated on the Backbone, so that I adjudicate consistently when it matters.
37. As a Presenter, I want an explicit re-run control for a bout where nobody submitted, so that the final can never stall with no Finalist.
38. As a Presenter, I want the correct answer visible only on the Backbone, so that the room is not given it for free.
39. As a Presenter, I want to reverse a mistaken elimination only through a deliberate, confirmed action, so that a misfire is recoverable but not casual.

### The finale

40. As a Finalist, I want a clear, unhurried choice between Pera and Kahon, so that the decision is genuinely mine.
41. As the Room, I want the choice moment held open, so that it lands with weight.
42. As the Room, I want the Kahon's contents revealed dramatically, so that there is a real payoff.
43. As a Presenter, I want the winning prize named on screen exactly as it is written on the item I hand over, so that the screen never contradicts reality.
44. As a Presenter, I want to know the drawn prize before the reveal animation runs, so that I am already holding the right thing.
45. As the Room, I want Bokya to be a genuine dramatic outcome rather than a joke, so that the module's point about failure lands.

### Sound

46. As a Presenter, I want a tick during the answer window, so that urgency is audible rather than only visual.
47. As a Presenter, I want a sting at the suspense pause, so that the room holds its breath at the right moment.
48. As a Presenter, I want a win sting on a reveal, so that a payoff is punctuated.
49. As a Presenter, I want a distinct sound for Bokya, so that failure has its own character.
50. As a Presenter, I want every sound triggered by the game's own state changes rather than by me, so that nothing fires at the wrong moment.
51. As a Presenter, I want one mute control that silences everything, so that a missing or broken audio file cannot stop the show.

### The deck

52. As a Presenter, I want to start and advance the deck from the Backbone, so that one person drives the entire presentation without switching windows.
53. As the Room, I want TRIM explained properly in depth, so that I understand all five instruments and not just their names.
54. As the Room, I want to hear what each of the eight entrepreneurs failed at before they succeeded, so that I have real examples rather than abstractions.
55. As the Room, I want the deck to share the game's visual language, so that the whole presentation feels like one piece rather than two.
56. As a Presenter, I want the deck's content held in the same editable content files as the game, so that I can revise either without touching code.

### Resilience and rehearsal

57. As a Presenter, I want to be able to play every phase from the Backbone alone if no phones join, so that the show still happens.
58. As a Presenter, I want a single glance at connection count and error state, so that I can decide whether to continue or fall back.
59. As a Presenter, I want the game's state to survive a reload of the Backbone, so that an accidental refresh does not end the show in front of the room.
60. As a Presenter, I want a rehearsal mode with a simulated roster and pinned draws, so that I can practise timing without a class.
61. As a Presenter, I want the whole show to run from one command, so that setup on the day is a single step rather than a checklist.
62. As a Presenter, I want all questions, prizes, and wording in one editable place, so that I can revise content without touching component code.

## Implementation Decisions

### Shape of the system

The entire show is one state machine. The highest available seam is used: **an event in, the authoritative game state out**. Every join, every submitted answer, every closing window, every operator command is an event; the machine folds them into the state that all three surfaces render. Everything else in the system is a thin adapter around that single function.

This is the single most consequential architectural decision in the spec, and it exists so that the rules — which are what will actually break on the day — are testable with no browser, no network, no projector, and no clock. The WebSocket server receives an event, folds it, and broadcasts the new state. The Backbone, Stage, and Player are renderers of state that emit events.

### Modules

- **Game state machine** — pure. No clock, no I/O, no randomness of its own. Owns every rule in this spec.
- **Server** — a small Node process hosting the WebSocket endpoint and serving the built client. Thin adapter: receive event, fold, broadcast. Also the authority on roster and connection health.
- **Backbone, Stage, Player** — three renderers of the same state, differing only in what they show and what they let a person do.
- **Content** — the question bank, prize table, on-screen copy, and deck content, held as typed data.

### Platform and stack

- Vite with React and TypeScript for the client.
- A small Node WebSocket server alongside it, as a separate process.
- The deck is built inside the same client, presented from the Backbone, sharing the game's visual language.
- Audio files supplied by the presenters; the application wires them to state transitions.

### Running it

The server binds to all interfaces, not to loopback. Players reach it over a Windows mobile hotspot the presenter's laptop runs, at the laptop's hotspot address. This is a known trap and the single most likely reason a rehearsal fails: loopback means *this machine only*, so a phone on the hotspot can never reach it, and the symptom looks like a broken application rather than a misconfigured one. The dev server must also be started in host mode, and Windows Firewall can silently drop inbound connections on the hotspot interface. The reachable address and any firewall requirement are surfaced on the Stage at startup so the presenters never have to guess.

### The state machine

The show is in exactly one phase at a time. The phases are: idle, joining, a cull question running, the cull reveal pending, the bracket being introduced, a bout running, a bout reveal pending, the final choice, the final reveal, the deck, and finished.

Events that drive it:

- A Player joins, reconnects, or leaves.
- The show starts.
- A question is presented, from the cull queue or the bracket's supply.
- An answer is submitted, carrying the Player, the question, the chosen option, and the server's receipt order.
- The answer window closes.
- The operator triggers the reveal.
- The cull evaluates and the grid is resolved.
- The bracket is seeded and bouts begin.
- A bout resolves.
- A bout is re-run after nobody submitted.
- An elimination is reversed.
- The finalist chooses Pera, or opens the Kahon.
- The deck advances.

The machine never reads a clock. The ten-second answer window, the five-second suspense pause, and the five-second winner beat live in an adapter that emits the corresponding events. This is what makes a full twenty-second bout testable in microseconds, and it is why an entire tournament can be driven in a test without waiting for anything real.

The machine draws nothing from a random source it owns. The generator is injected, so a test can pin the Kahon to any prize in the table — including Bokya — without touching real randomness.

### The cull

Questions are presented one at a time to the whole room. Players answer on their phones within a ten-second window. Submissions are received and held invisibly; nothing about them reaches the Stage or the Backbone.

When the operator triggers the reveal, the machine evaluates every Player at once: a correct submission survives, and everyone else is eliminated — including every Player who did not submit. The Stage then shows every name in the roster flipping together to survived or eliminated.

The cull repeats until ten or fewer Players remain, or the cull queue is exhausted. It is adaptive rather than fixed-length precisely so that it does not matter whether the questions happen to be easy or hard.

If the cull ends with nine or ten survivors, the Backbone offers a trim control to select the eight who enter the bracket. The presenters decide, not the machine.

### The bracket

Survivors are seeded into a single-elimination bracket from eight down to one: eight to four, four to two, two to one. Pairings are drawn from the injected generator at seeding time, so a rehearsal can be pinned to the same draw every run.

Each bout is one question between two Players, resolved on submission receipt order:

- If one or both submitted correctly, the earliest correct submission wins the bout and the other Player is eliminated — regardless of when the other submitted, and regardless of whether the first submission was correct.
- If every submission was wrong and at least one Player submitted, the earliest submitter is eliminated and the other Player advances.
- If neither Player submitted, nobody is eliminated and the operator re-runs the bout. This rule exists so the bracket always converges and the final can never end with no Finalist.

Elimination is immediate and final, with no lives. A single wrong answer ends a Player's run.

A mistaken elimination can be reversed, but only through a deliberate, confirmed action on the Backbone.

### The finale

The single remaining Player chooses between Pera and the Kahon. Pera is a fixed, small redeemable voucher. The Kahon draws at random from a prize table of larger vouchers, which may also include Bokya as a losing entry.

Every item in the prize table must be physically present and genuinely redeemable, because a Player can win any of them. The Stage names the winning prize exactly as the physical item is written. The drawn prize is known to the Backbone before the reveal animation plays, so the correct item is already in hand.

### Sound

Audio is triggered by state transitions rather than by operator action, so nothing can fire at the wrong moment: a tick during the answer window, a sting at the suspense pause, a win sting on a favourable reveal, a distinct sound for Bokya. A single mute control disables all of it. A missing or unreadable audio file degrades to silence and never blocks a transition.

### Fallback

Phones enhance the show but are never required. Every phase is drivable from the Backbone alone, including submitting an answer on behalf of a Player and resolving a bout directly. The Backbone shows connection count and error state at a glance so the presenters can decide whether to continue or fall back mid-show.

### Rehearsal

A rehearsal mode runs the whole show with a simulated roster and a pinned generator, with no phones required. Game state survives a reload of the Backbone, so an accidental refresh does not end the show.

### Content

Questions spread across all three Module 8 blocks — the importance of planning, the TRIM tools, and failure — with the later questions weighted toward failure so that the finale pays off what the quiz set up. Content is held in typed data files with all on-screen wording, so the presenters can revise any question, prize, or line without touching component code. All copy is Taglish: Filipino for the host's voice and the drama, English for the business terms.

## Testing Decisions

**The assumption to overturn if wrong:** the seam is a single one — an event in, game state out. If there is a seam worth testing separately, this section should be rewritten before tickets are cut.

A good test here asserts only on external behaviour: given a sequence of events, what the game state is afterwards. Nothing about internal helpers, intermediate steps, or which function did what. A test that breaks when an internal function is renamed has tested the implementation, not the rules, and has made the rules harder to change for no gain.

The module under test is the **game state machine**, and it is tested as a whole rather than part by part, because the rules are meaningful only as a sequence — a bracket rule is only observable across a whole tournament. Tests drive it with fabricated events and assert on the resulting state, never on timing and never on real randomness, because both are injected.

The cases that matter most, in rough priority order:

- **Bout resolution, all three outcomes.** Earliest correct wins even when the other submitted earlier and wrong; all wrong eliminates the earliest submitter; nobody submitted eliminates nobody. These three encode the whole bracket and are the rules most likely to be implemented wrongly.
- **Bracket convergence.** A full tournament from eight players to one Finalist, across every resolution path, always terminating in exactly one survivor. This is the test that would catch a mis-implemented rule before the room does.
- **The cull.** Adaptive stopping at the target count; correct-and-wrong handling; non-submitters eliminated; exhaustion of the question queue before the target is reached.
- **Reveal gating.** No submission detail reaches any surface before the operator triggers the reveal, and the reveal happens exactly once.
- **The finale.** Pera yields the fixed voucher; the Kahon yields a prize drawn from the table; a pinned generator makes each outcome reproducible.
- **Reload survival.** A folded event log reconstructs the same state.
- **Elimination reversal.**

The server adapter is covered thinly: that an event arriving over a socket produces the same state change as the same event folded directly. Its job is transport, and it should not be where the rules are verified.

There is no prior art in this repository — it is a new project — so these establish the convention.

## Out of Scope

- **The singing introduction and its soundboards.** Explicitly a separate project. Its absence is why the show opens on a title screen rather than a performance.
- **Host audio and performance.** No spoken-word or sung content of any kind.
- **Internet deployment.** The show is designed around a local hotspot and is never hosted publicly. This is a deliberate constraint, not an oversight.
- **Player accounts and authentication.** A name is the whole of a Player's identity.
- **Real money.** Every redeemable value stands for food the presenters physically bring.
- **Prop box state.** The seven boxes are set dressing. The game tracks no box state, and no presenter is instructed by the software to open anything.
- **The reflection paper.** The assessment is the presenters' own work and is not produced by this project.
- **Configurable multiple shows.** One show, one configuration, one content set.
- **Automatic elimination correction without confirmation.** Reversal exists but is always deliberate.

## Further Notes

**One input is still owed and blocks part of the build.** The prize table was left to the presenters: which food and drink items can actually be obtained, and what each is worth. The table structure and draw logic can be built without it, but the finale cannot be rehearsed until it exists. This is the only outstanding blocker on the content side.

**The cull's pacing was never specified.** The twenty-second bout beat is settled; the equivalent timing for a whole-room cull question was not. It should match the bout unless the presenters say otherwise.

**Rehearse on a real phone early.** Nothing in the show works until a phone has joined the hotspot, and the loopback trap described above will look like a broken application rather than a misconfiguration.

**The rules carry the risk, not the rendering.** The pieces most likely to fail on the day are the ambiguous bout outcomes and the bracket failing to converge. That is the reason for the single high seam, and the reason the test list leads with those cases.

**The deck follows the game on purpose.** The game dramatised failure and made planning feel real, which leaves the deck carrying the density a game show cannot: the five TRIM instruments properly, and the eight Filipino entrepreneurs — Socorro Ramos, John Gokongwei Jr., Tony Tan Caktiong, Henry Sy, Ramon del Rosario, Vince Ong, Dado Banatao, and Maria Ressa — with what each failed at first. The assessment rewards examples and insight, and this is where that material earns its place.