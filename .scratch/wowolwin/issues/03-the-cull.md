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