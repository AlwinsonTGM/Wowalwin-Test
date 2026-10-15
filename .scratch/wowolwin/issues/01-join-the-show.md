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

### Reviewed after the commit

The ticket was reviewed and the following were fixed, all inside it:

- **The console printed a join link that answered 404 in `npm run dev`.** It
  printed the server's port, but in dev Vite serves the client on `5173` and the
  server serves nothing until someone builds. This is exactly the failure
  ADR-0002 warns about — it looks like a broken app, not a misconfigured one.
  `npm run dev` now passes `--dev`, and the console prints the port the client
  is actually served on. Vite's port is pinned and strict, so it cannot quietly
  move and leave the presenter typing an address nothing answers.
- **A crash mid-write threw the roster away silently.** The log was rewritten in
  place, so a kill between the truncate and the write left a half-written file,
  and an unreadable log was read back as "no show yet". It is now written
  beside itself and renamed, which is atomic, and an unreadable log is no longer
  silent — it warns. Both paths now have tests.
- **A `/play/` with a trailing slash served the Player phone the Backbone.** The
  Player would have seen a "Simulan ang show" button and could have ended the
  show with a finger, with a healthy-looking roster the whole time. One
  `surfaceFor` now decides the surface, in `src/client/surface.ts`, and forgives
  the slash.
- **The server rebuilt the reconnect event the game machine had already given
  it.** `planResume`'s return type now carries its own event, so the rule lives
  in one place and the adapter cannot restate it.
- **A Player phone could start the show.** It can no longer do so from a socket
  that has claimed a roster place. There is still no Presenter identity on a
  connection; that is accepted and recorded in ADR-0004 rather than half-fixed.
- Smaller: the hotspot address is read once at startup instead of once per
  socket, a tap during the reconnect gap is no longer sent into a closed socket
  (the Backbone's button is disabled while it is offline), and the log and
  `dist/` resolve against the repository rather than the working directory.

Spec item 3 under Joining — a scannable code alongside the join link — was still
unowned. It moved to ticket 08, where it can be built with the rest of what the
room needs to get in reliably.