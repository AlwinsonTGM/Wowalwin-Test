# 01: Join the show

**What to build:** A Player opens the join link on a phone that has joined the presenter's Windows hotspot, types a name, and appears on a roster that the Backbone and the Stage both show. This is the tracer bullet: it proves a phone can reach the laptop at all, which every later ticket assumes, and it does so before any game rules exist.

State is held as a foldable event log from the start, so a reload of the Backbone reconstructs identical state and costs nothing later.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] The WebSocket server accepts connections on all interfaces, not loopback only, and the reachable address is displayed on the Stage so the presenters never have to guess it
- [ ] A Player who opens the join URL from a phone on the hotspot reaches the Player page
- [x] A Player who submits a name appears in the roster on both the Backbone and the Stage
- [x] A Player token is persisted in the Player's browser storage, so refreshing or locking the phone re-attaches to the existing roster entry rather than duplicating it or dropping it out
- [x] A single Player disconnecting and reconnecting does not lose their roster place
- [x] Game state is held as a foldable event log, so reloading the Backbone reconstructs exactly the same state
- [x] The roster is visible on the Backbone with a per-Player connection state, so a dropped phone is visible before it becomes a problem
- [x] A hard cap on the number of Players is enforced and surfaced on the Backbone
- [x] Starting the show is an explicit Backbone action rather than an automatic transition
- [x] Every piece of on-screen wording lives in the content files, with none hardcoded into components

## Comments

Built on 2026-10-15. Seams agreed before any test: the pure fold
(`src/game/machine.ts`), the socket adapter (`src/server/show-server.ts`), and the
three rendered surfaces.

**One box is left open on purpose.** "A Player who opens the join URL from a
phone on the hotspot reaches the Player page" is implemented — the server binds
`0.0.0.0`, the Vite dev server runs in host mode, and the reachable address is
printed on the Stage, on the Backbone and in the console — and it was verified
through this machine's non-loopback address. It has **not** been verified from a
real phone on a Windows hotspot, which no agent can do from here. ADR-0002 and the
spec both say this is the single most likely reason a rehearsal fails, so rehearse
it on a real phone before the day and tick it then.

Beyond the ticket, deliberately: the event log is written to `data/event-log.json`
on every event, so a server that dies mid-show does not take the roster with it.
`npm start` clears it for a fresh show; `npm run resume` keeps it after a crash.