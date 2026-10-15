# 04: The bracket

**What to build:** The Cull's survivors are trimmed to eight, seeded into a single-elimination bracket, and run down to a single Finalist: eight to four, four to two, two to one. Each bout is twenty seconds — ten to answer, five of suspense, five to show the winner.

This is the highest-risk ticket in the project. The ambiguous outcomes are what will break on the day, and the rules only make sense across a whole tournament, so the whole path is tested end to end rather than bout by bout.

**Blocked by:** 03 — The cull.

**Status:** ready-for-agent

- [ ] When the Cull ends with more than eight survivors, the Backbone offers a trim control and the presenters choose who advances
- [ ] Bracket pairings are seeded from the injected generator, so a pinned seed reproduces the same bracket on every run
- [ ] A bout presents one question to two Players and runs ten seconds of answering, five of suspense, and five to show the winner
- [ ] The earliest correct submission wins the bout, regardless of when the other Player submitted and regardless of whether the first submission was correct
- [ ] When every submission is wrong and at least one Player submitted, the earliest submitter is eliminated and the other Player advances
- [ ] When neither Player submitted, nobody is eliminated and the operator re-runs the bout — the rule that guarantees the bracket always converges
- [ ] The Bracket advances itself once a bout resolves, without the operator wiring winners onward by hand
- [ ] The Stage shows the surviving Bracket throughout so the room can track who is left
- [ ] The correct answer is visible on the Backbone only, and never on the Stage
- [ ] A mistaken elimination can be reversed, but only through a deliberate confirmed action
- [ ] A Player who is waiting for their turn is told so on their phone rather than left staring at an unanswered question
- [ ] A Player who lost a bout is told immediately and plainly on their own phone