# 03: The cull

**What to build:** Whole-room questions run one at a time until ten or fewer Players remain. On each reveal, every name in the roster flips to survived or eliminated at once. This is where the forty-player problem gets solved: the grid carries the drama at a scale no operator could manage by picking winners by hand.

This ticket also introduces simulated Players and simulated answers, so the Cull grid and the eight-player Bracket can be filled and tested visually without opening a dozen browser tabs or recruiting a classroom.

**Blocked by:** 02 — Answer one question, then reveal it.

**Status:** ready-for-agent

- [x] Players can be added to the roster in bulk and can be made to submit answers on a timer or on demand, so the Cull grid can be driven visually without real phones
- [x] The simulated roster is controllable from the Backbone and can be torn down cleanly
- [x] A whole-room question is presented to every active Player at once
- [x] On reveal, Players who submitted correctly survive and everyone else is eliminated, including every Player who did not submit
- [x] Every name in the roster flips to survived or eliminated simultaneously on the Stage, and the two states are visually distinct
- [x] The cull repeats until ten or fewer Players remain, adapting to however easy or hard the questions turn out to be rather than running a fixed number of questions
- [x] The Backbone shows the survivor count at all times
- [x] The Backbone warns when the Cull queue is close to exhausted before the target count has been reached
- [x] A Player who joins after the cull has begun is told plainly that they cannot play, and their phone still works as a spectator
- [x] An eliminated Player's phone says they are out and remains usable rather than freezing on a dead screen
- [ ] The full tournament to a single Finalist terminates in exactly one survivor across every combination of resolution paths

## Comments

### Seed simulated Players server-side. Do not connect them.

This is a constraint from ticket 02, found before any code was written here rather
than after. ADR-0004's guard is now `playerId === undefined && !triedToJoin`: a socket
that has *asked* to be a Player — let in or turned away — loses all three controls
(`startShow`, `presentQuestion`, `reveal`).

**Why that forces the shape.** From `started` onward this ticket needs the Presenter
to `presentQuestion` and `reveal` *while* controlling the simulated roster, and the
whole Cull grid has to be drivable from one Backbone. A simulated Player built as a
WebSocket connection makes those two mutually exclusive: the first `join` that
connection sends costs it every Presenter control. One socket cannot be both.

**Therefore.** A simulated Player is seeded into the event log by the server, not
connected. Three reasons beyond the guard:

- It cannot collide with the guard at all, so no special case is needed anywhere.
- It keeps ADR-0004's premise intact. A connection carries no identity, so
  delivering a *fake* identity over one is the wrong shape for the thing this ADR
  exists to say.
- A real event log stays clean. A rehearsal driven entirely by seeded players can
  never be mistaken for a room of real phones, which matters because ticket 08's
  whole premise is rehearsing with nobody there.

**Do not** resolve the collision by loosening the gate to admit a second class of
connection, or by re-checking `isPresenter` per-message in some cleverer way. That
is precisely the permanent protocol complexity ADR-0004 rejected in favour of this
cheap guard.

**Testing note.** A seeded roster is a fixture, so seed it in the same shape as the
event log the room-scale test in ticket 09 already builds — via the temp-log path,
never the repository's `data/`, and port `0`.

Built on 2026-10-15.

### One box is not done, and cannot be done here

**"The full tournament to a single Finalist terminates in exactly one survivor"**
is not delivered by this ticket. A tournament needs the Bracket (04) and the
finale (05); there is no second round to terminate without them, and building a
bracket here would be exactly the scope this ticket exists to avoid.

What *is* delivered is the cull's half of that property, and it is the half the
cull is responsible for: **the survivor set never grows.** An eliminated Player
cannot submit (`planSubmitAnswer` refuses them), so every round's survivors are
a subset of the last round's. That monotonic shrink is the only reason "exactly
one survivor" is reachable at all once the bracket runs on top of the cull, and
it is asserted over all 4,096 second-round answer combinations of a twelve-player
room. Ticket 04 carries the rest.

### Amendment: the floor the Cull may not go below

Ruled in ticket 04's Comments and measured in ticket 03's own machine, so it lives
here where the Cull's rule lives rather than drifting into the Bracket.

**The invariant: the Cull never ends with zero survivors.** An eliminated Player
cannot submit (`planSubmitAnswer` refuses them), so on a reveal everyone `in` who did
not answer correctly goes — including everyone who never answered. That produces an
empty room, `cullOver` reports `cullComplete` because 0 ≤ target, and the Bracket is
handed nothing to seed.

Two clauses, because they answer two different questions and only one of them is
about who deserves to keep their place:

1. **Somebody submitted.** The last Player to have submitted keeps their place. This
   is arbitrary too, but it is not arbitrary *silently*: the room watched them try.
   The ordering already exists — `answerSubmitted` fold order from ticket 02 — and
   ticket 04's earliest-correct rule reads the same list.
2. **Nobody submitted at all.** Then the floor cannot come from the submissions,
   because there are none. It comes from the roster: **the first Player who joined
   keeps their place.**

Clause 2 exists because it is the *likely* case on show day, not an edge case. Forty
phones, ten seconds, nobody taps is a completely ordinary outcome — and a frozen room
is the one thing a live audience is guaranteed to produce at least once. Falling
through to `cullComplete` with an empty grid would be decided by whatever the first
silent reveal happened to do.

**Clause 2 is honestly arbitrary.** With nobody answering, the survivor is whoever
joined first. That is not a meritocratic outcome and it should not pretend to be. The
argument for it is that *defined and arbitrary* beats *arbitrary and silent* — the
alternative is not a fairer result, it is the first silent reveal on show day
deciding it. Someone should not have to debug an empty bracket in a classroom.

**Do not solve this by re-running the round.** It is tempting — the Bracket already
re-runs a bout when neither Player submitted, so the shape is familiar. It is wrong
here for one reason: a re-run on a frozen room is an infinite loop, because the room
is frozen for the same reason the first time. The Bracket can afford the re-run
because two Players and twenty seconds bound it. Forty Players and a Cull with no
terminal condition do not.

**A Presenter override is out of scope.** Tapping someone through to the next round
is a legitimate tool and it belongs to ticket 08's fallback work, where the Presenter
already has powers for exactly this. It does not belong in the Cull's fold, because a
show that can stall is a show that needs someone watching it, and the Cull must
converge unattended.

Ticket 06 is now authoring against this: a Cull question hard enough that nobody at
all answers right would empty the room without clause 2, so difficulty has to be
*controlled*, not merely rising.

### The grid, and why one event flips it

`revealTriggered` was already the cull's resolve point, so it now also marks
every Player `in` or `out` in the same fold that publishes the answer. That is
what makes the grid move together rather than name by name: one event, one new
state, the whole roster. The Stage renders `standing` per name and labels it in
words as well as in class, because a projector in a bright room with a
colour-blind audience cannot rely on colour.

### Seeding, not connecting

The Comments above are the constraint and the code follows them: a simulated
Player is a `playerJoined` event with `simulated: true`, written by the server.
No socket is involved, so `isPresenter` is untouched and stays the two-term
guard. A phone that sends `simulatePlayers` records nothing, and there is a test
that says so.

Simulated answers go through `planSimulateAnswers`, which submits each one via
`planSubmitAnswer` — the same door a real phone uses. There is no second way
into the sealed list, so the one-answer rule and the closed window are the same
rule for a seeded Player as for a person.

Three modes, chosen from the Backbone: `correct`, `wrong` and `mixed`. Mixed is
right, wrong, silent, repeating by roster order. **No randomness**, on purpose:
a rehearsal that cannot be replayed identically is no use for practising timing,
and the generator injection the spec asks for is ticket 08's pinned draws.

### Decisions this ticket and the ADRs left open

- **Arming lives in the state, not the adapter.** `simulation.armed` and
  `simulation.mode` are folded from an event, so a reload cannot leave the
  Backbone believing the room is armed when the server does not. The alternative
  was a server message and a re-send on reconnect, which is more machinery for
  the same truthfulness.
- **Seeding and teardown are refused once the show has started.** A roster that
  changed mid-cull would change the survivor set under the room's feet. The
  only safe moment is before the Presenter presses start.
- **A hard round can eliminate everybody.** Nothing in this ticket asks for a
  guard, so none was invented: the survivor count is on the Backbone at all
  times, and zero is shown as plainly as ten.
- **A refused phone and an eliminated phone both keep watching**, and both have
  their own wording. The Player surface still never renders `state.answer`.

### Verified by breaking it

Every rule in this ticket was mutated to prove the tests bite, not just pass:

| Mutation | What failed |
| --- | --- |
| Reveal never eliminates | 10 machine tests |
| `planNextQuestion` drops the cull gate | 3 tests |
| An eliminated Player may answer again | the rule test **and** the 4,096-combination property |
| The Presenter guard is off | 5 server tests, including the new one |
| The armed room never answers by itself | 4 server tests |
| Teardown removes the real room too | 2 tests |

The first version of the property test was itself wrong and the mutation check is
what caught it: at four Players the target of ten made the cull finish after one
round, so the suite was asserting a thing that never ran. It now uses a
twelve-player room so a second question genuinely happens, and offers a second
round to every Player including the one the first round put out — otherwise an
eliminated name could never come back and the property could never fail.

### What jsdom is not

Nothing here has been on a handset or a projector. The cull grid at forty
players, the strike-through reading from the back of a room, and whether a phone
keeps its socket through a reveal are all unverified on real hardware. Ticket 01's
open rehearsal box is unchanged and still the honest limit on the whole show.

### A rehearsal runs against its own log

The ruling landed after this ticket's first commit, so it is built here rather
than argued about. Three commands, one file each, and the filesystem decides
which — not the order someone typed the words in:

| Command | Log | Wiped? |
| --- | --- | --- |
| `npm start` | `data/event-log.json` | yes |
| `npm run rehearse` | `data/rehearsal-log.json` | yes |
| `npm run resume` | `data/event-log.json` | no |

`index.ts` resolves the path **before** it wipes anything, so `rehearse --fresh`
cannot delete the real show's roster on its way past — the two can never be
asking about different files. Verified for real, not by inspection: a sentinel
written into `data/event-log.json` survived a `--rehearse --fresh` run byte for
byte, and a plain `--fresh` run removed it as promised.

**One deviation from the ruling, flagged rather than quietly taken.** It said
`GameEvent` gains no `simulated` flag, reasoning that "if the logs never mix, a
seeded and a real `playerJoined` never coexist in one fold". That reasoning is
about telling a rehearsal from a show, which the separate files now do — but the
flag in this ticket carries behaviour, not a badge:

- `simulatedPlayersCleared` uses it to take out the seeded room and leave real
  phones alone. Without it, "torn down cleanly" takes the presenter's own phones
  off the roster with it, and box 2 is not met.
- `planSimulateAnswers` uses it to answer only seeded Players. A rehearsal that
  also has real phones on it would otherwise have a phone silently answering
  itself, which is a different show from the one the Presenter asked to rehearse.

So the flag stays and the ruling's actual goal — a rehearsal can never be
mistaken for the real room — is met by the log paths instead, which is what the
ruling was for. If the room disagrees, dropping the flag is a small change and
the honest cost is losing per-player teardown.

### Ruling: a rehearsal writes to a different file, not a flagged one

Found by @Checker before this was built, having tested it rather than reasoned about
it. Seeding into the shared `data/event-log.json` does not merely risk confusion, it
produces a hard failure: 40 seeded players survive a restart, phase returns to
`joining`, and a real phone is then refused with `rosterFull`. The Backbone reads
"40 / 40 Players" while every dot is grey, so the room looks full and the one real
phone is turned away.

**Decision: separate storage over labelling.** Two files, never mixed.

- Real show: `data/event-log.json` (today's `DEFAULT_LOG_PATH`, unchanged).
- Seeded rehearsal: `data/rehearsal-log.json`.

The separation, not a flag, is what tells a rehearsal from a show. If the two logs
never mix, a seeded `playerJoined` and a real one never need to be told apart to
answer that question.

**Amended during the build.** This section originally said `GameEvent` gains no
`simulated` flag at all. @Implementer showed that was wrong, for a reason about
*per-player behaviour* rather than rehearsal-vs-show, and the flag stayed:

- `simulatedPlayersCleared` needs it to remove the seeded room and leave the
  Presenter's own phones on the roster. Without it, "torn down cleanly" takes real
  phones off the roster with the fake ones and this ticket's box 2 is not met.
- `planSimulateAnswers` needs it to answer only seeded Players, so a rehearsal that
  also has a real phone attached does not have that phone silently answering itself.

The original reasoning was about *labelling for display*; the flag that turned out to
be needed is about *behaviour*. Those are different questions and conflating them is
what made the first version wrong. The rehearsal badge remains a Backbone copy string
— nothing about showing which mode is running depends on the event schema.

**This also removes the real risk.** Right now the only thing standing between a
rehearsal and the actual show is remembering `npm start` instead of `npm run resume`.
Separate paths mean `npm run resume` on the day *cannot* pick up a rehearsal roster,
whatever anyone forgets. That is the whole point: the failure mode is prevented by
the filesystem instead of by a human remembering a command.

**Not already wired, so do not assume it is.** `startShowServer` accepts `logPath`,
but `index.ts` calls `startShowServer({ port })` and never passes one, so the default
is the only reachable path today. Three small additions, all in this ticket because
seeding is useless without them:

1. `REHEARSAL_LOG_PATH` in `config.ts` alongside `DEFAULT_LOG_PATH`.
2. `index.ts` selects between them, and only the real path is cleared by `--fresh`.
   A rehearsal keeps its own log so a rehearsal can be resumed like a show.
3. An `npm run rehearse` script. One word, and the Presenter cannot be in the wrong
   mode by accident.

**And two details that are easy to get wrong, both found by review before the build.**

*`--fresh` must never be able to reach the real log.* `index.ts` wipes at line 9,
before it would pick a path at line 11, so `npm run rehearse --fresh` would silently
delete `data/event-log.json` — the actual show's roster. That is the precise opposite
of what this ruling is for, and it is easy to miss because the existing line already
looks correct.

Close it twice, because the two fixes fail differently:

- **Do the reorder anyway.** Resolve the path first, then wipe what was resolved, so
  the wipe and the run can never disagree even if a fourth command appears later.
- **But make the dangerous combination inexpressible.** `npm run rehearse` always
  passes `--fresh`, so `rehearse --fresh` is not a thing anyone can type. A rehearsal
  that always starts clean is also what a rehearsal wants — nobody wants yesterday's
  Cull waiting on the grid.

That leaves exactly three commands, each with one unambiguous target:

| Command | Log | Wiped? |
| --- | --- | --- |
| `npm start` | real | yes |
| `npm run rehearse` | rehearsal | yes |
| `npm run resume` | real | no |

A rehearsal can be resumed *within itself* by re-running `rehearse`; it just never
starts by inheriting anything. Note what this does **not** change: `resume` still
cannot reach the rehearsal file, so the failure the ruling exists to prevent remains
prevented by the filesystem rather than by anyone remembering a command.

`data/` is already gitignored, so the new log needs no ignore-rule change.

**The grey dots are not a bug. Leave the count alone.** Seeded players show as
disconnected because no socket holds them, and they will always — that is inherent to
seeding, not a defect. Counting dropped players against the cap is deliberate
(ticket 01: a disconnected phone keeps its place), so the "40 / 40" figure is correct
and changing it would break a rule another ticket established. The badge is what
distinguishes a rehearsal from a real room; the number is not what is wrong.