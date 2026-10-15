# 02: Answer one question, then reveal it

**What to build:** A question from the content file appears on the Player phone and on the Stage at the same moment. The Player submits one answer and sees it acknowledged. Nothing about who submitted — not the count, not the names, not the correctness — reaches any surface until the Presenter presses reveal. Then the Stage shows the answer. This is the core loop of the show, end to end through all three surfaces.

**Blocked by:** 01 — Join the show.

**Status:** ready-for-agent

- [ ] A question and its options appear on the Player phone and on the Stage at the same time
- [ ] A Player can submit exactly one answer per question and receives a visible acknowledgement that it registered
- [ ] Nothing about submissions — count, names, or correctness — reaches the Stage or the Backbone until the reveal is triggered
- [ ] The Backbone shows a countdown toward the reveal, so the Presenter knows when to press it
- [ ] On reveal, the Stage shows the correct answer
- [ ] The answer window closes automatically and the question accepts no submissions afterwards
- [ ] A tick plays during the answer window, a sting at the suspense pause, and a distinct sound on the reveal
- [ ] Every sound is triggered by a state change rather than by an operator pressing something, so nothing can fire at the wrong moment
- [ ] A single mute control silences everything, and a missing or unreadable audio file degrades to silence without blocking the reveal
- [ ] The Backbone shows the correct answer and the cue line for the Presenter, and neither appears on the Stage