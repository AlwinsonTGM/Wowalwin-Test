# 03: The cull

**What to build:** Whole-room questions run one at a time until ten or fewer Players remain. On each reveal, every name in the roster flips to survived or eliminated at once. This is where the forty-player problem gets solved: the grid carries the drama at a scale no operator could manage by picking winners by hand.

This ticket also introduces simulated Players and simulated answers, so the Cull grid and the eight-player Bracket can be filled and tested visually without opening a dozen browser tabs or recruiting a classroom.

**Blocked by:** 02 — Answer one question, then reveal it.

**Status:** ready-for-agent

- [ ] Players can be added to the roster in bulk and can be made to submit answers on a timer or on demand, so the Cull grid can be driven visually without real phones
- [ ] The simulated roster is controllable from the Backbone and can be torn down cleanly
- [ ] A whole-room question is presented to every active Player at once
- [ ] On reveal, Players who submitted correctly survive and everyone else is eliminated, including every Player who did not submit
- [ ] Every name in the roster flips to survived or eliminated simultaneously on the Stage, and the two states are visually distinct
- [ ] The cull repeats until ten or fewer Players remain, adapting to however easy or hard the questions turn out to be rather than running a fixed number of questions
- [ ] The Backbone shows the survivor count at all times
- [ ] The Backbone warns when the Cull queue is close to exhausted before the target count has been reached
- [ ] A Player who joins after the cull has begun is told plainly that they cannot play, and their phone still works as a spectator
- [ ] An eliminated Player's phone says they are out and remains usable rather than freezing on a dead screen
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

`GameEvent` gains **no** `simulated` flag. If the two logs never mix, a seeded
`playerJoined` and a real one never coexist in one fold, so an unlabelled event costs
nothing. Labelling would buy exactly one thing — a badge so the Presenter knows they
are rehearsing — and that is a copy string on the Backbone, not an event-schema
change. Do not put the flag in the event; put the word on the screen.

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

**The grey dots are not a bug. Leave the count alone.** Seeded players show as
disconnected because no socket holds them, and they will always — that is inherent to
seeding, not a defect. Counting dropped players against the cap is deliberate
(ticket 01: a disconnected phone keeps its place), so the "40 / 40" figure is correct
and changing it would break a rule another ticket established. The badge is what
distinguishes a rehearsal from a real room; the number is not what is wrong.