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