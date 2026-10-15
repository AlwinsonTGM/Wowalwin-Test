# 01: Join the show

**What to build:** A Player opens the join link on a phone that has joined the presenter's Windows hotspot, types a name, and appears on a roster that the Backbone and the Stage both show. This is the tracer bullet: it proves a phone can reach the laptop at all, which every later ticket assumes, and it does so before any game rules exist.

State is held as a foldable event log from the start, so a reload of the Backbone reconstructs identical state and costs nothing later.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The WebSocket server accepts connections on all interfaces, not loopback only, and the reachable address is displayed on the Stage so the presenters never have to guess it
- [ ] A Player who opens the join URL from a phone on the hotspot reaches the Player page
- [ ] A Player who submits a name appears in the roster on both the Backbone and the Stage
- [ ] A Player token is persisted in the Player's browser storage, so refreshing or locking the phone re-attaches to the existing roster entry rather than duplicating it or dropping it out
- [ ] A single Player disconnecting and reconnecting does not lose their roster place
- [ ] Game state is held as a foldable event log, so reloading the Backbone reconstructs exactly the same state
- [ ] The roster is visible on the Backbone with a per-Player connection state, so a dropped phone is visible before it becomes a problem
- [ ] A hard cap on the number of Players is enforced and surfaced on the Backbone
- [ ] Starting the show is an explicit Backbone action rather than an automatic transition
- [ ] Every piece of on-screen wording lives in the content files, with none hardcoded into components