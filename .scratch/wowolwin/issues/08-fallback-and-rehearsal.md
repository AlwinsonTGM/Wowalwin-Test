# 08: Fallback and rehearsal

**What to build:** The show survives the things that go wrong on the day. Every phase is drivable from the Backbone alone with no phones connected, connection health is visible at a glance, and a pinned-draw rehearsal reproduces the whole show identically every run so the presenters can practise timing without a classroom.

Simulated Players arrived back in ticket 03, where they were needed to test the Cull grid and the eight-player Bracket. This ticket is about what happens when the real ones never turn up, and about making rehearsal repeatable.

**Blocked by:** 05 — Pera o Kahon. The fallback has to cover a finished show, not half of one.

**Status:** ready-for-agent

- [ ] Every phase is drivable from the Backbone alone with no phones connected, including submitting an answer on a Player's behalf and resolving a bout directly
- [ ] A Presenter can run the whole show from the Backbone without a hotspot, a server reachable from outside, or a single real phone
- [ ] Connection count and error state are visible at a glance on the Backbone, so the Presenter can decide whether to continue or fall back mid-show
- [ ] Pinned draws make a full rehearsal reproduce identically on every run
- [ ] A rehearsal runs the entire show — join, Cull, Bracket, finale, deck — with no network and no phones
- [ ] A reload or an unexpected error during a show does not end it or lose the roster
- [ ] A single Player's phone failing mid-show does not block the round for everyone else
- [ ] The whole show starts from one command, so setup on the day is a single step rather than a checklist
- [ ] The join link on the Stage is also shown as a scannable code, so forty phones do not type an address off a projector

## Comments

### Choose a vehicle that tests the control, not just the refusal

Carried out of ticket 02, where this cost the team a wrong test and then a wrong
correction of that wrong test. Writing it down so 08's auth guards do not rediscover it.

**The rule.** A refusal can only regression-test a control if that control would
otherwise still be *live*. The check is on the control's preconditions, not on the
refusal's name.

Concretely: `startShow` needs `phase === 'joining'`. A `showStarted` refusal only
happens once the phase has already moved on, so the show is not in `joining`, so
`startShow` is a no-op anyway — the test passes against a completely unfixed server.
That is why ticket 02's `startShow` regression test cannot use a `showStarted`
refusal, and why its `reveal` test has to seed the reveal into `revealPending`
first rather than reaching it from `joining`.

**Why, in code terms.** The order of checks in `planJoin` is name, then length,
then phase, then cap. That order decides which refusals are *phase-blind* — they
return before `state.phase` is ever read, so the show is left wherever it was:

| Refusal | Settled before `phase` is read? | Leaves `startShow` live? |
| --- | --- | --- |
| `nameRequired` | yes | yes |
| `nameTooLong` | yes | yes |
| `rosterFull` | no | yes |
| `showStarted` | n/a — *is* the phase check | no |

So three refusals can test `startShow`, not one. Prefer `nameRequired`: a blank
name against an empty log needs no seeded 40-player roster and no `playerCap`
dependency, so the test says the same thing with less machinery. Reach for
`rosterFull` only when the cap behaviour is what is actually under test.

### Verify a green test by breaking the code, not by re-reading it

Both halves of the ticket-02 trap, because the second one hides behind the first.

**Drain before you assert.** Every client receives every state, so one broadcast
already in the inbox is indistinguishable from a leak, and the handshake leaves one
there for free. A test that asserts "nothing arrived" against an un-drained inbox
passes against broken code. `surface().drain()` exists in `show-server.test.ts` for
this; use it before every negative assertion.

**Mutate, then re-run.** A green run is not evidence the test bites. Revert the fix,
re-run, confirm the test fails and leaks the phase you were defending. Ticket 02's
three `a phone the show turned away` tests were checked this way, leaking
`answering`, `revealed`, and `started`.

### One socket cannot be both Presenter and a simulated Player

ADR-0004's guard is now `playerId === undefined && !triedToJoin`: a socket that has
asked to be a Player, let in or turned away, loses all three controls (`startShow`,
`presentQuestion`, `reveal`).

Ticket 03 settled the collision by **seeding simulated Players server-side rather
than connecting them**. That is the shape 08 must keep. It cannot collide with the
guard, it keeps ADR-0004's premise intact — a connection carries no identity, so
delivering a fake one over a connection is the wrong shape — and it keeps a real
event log clean, so a rehearsal against seeded players is never mistaken for a real
roster.

The structural reason, which is what makes the constraint hard to rediscover the
easy way: from `started` onward the Backbone needs `presentQuestion` and `reveal`
*while* controlling the simulated roster. One socket doing both is impossible under
this guard — the first `join` it sends costs it every control. Do not "solve" this
by loosening the gate to admit a second class of connection; that is exactly the
complexity ADR-0004 rejected.