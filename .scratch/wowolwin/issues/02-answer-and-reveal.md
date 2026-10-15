# 02: Answer one question, then reveal it

**What to build:** A question from the content file appears on the Player phone and on the Stage at the same moment. The Player submits one answer and sees it acknowledged. Nothing about who submitted — not the count, not the names, not the correctness — reaches any surface until the Presenter presses reveal. Then the Stage shows the answer. This is the core loop of the show, end to end through all three surfaces.

**Blocked by:** 01 — Join the show.

**Status:** done

- [x] A question and its options appear on the Player phone and on the Stage at the same time
- [x] A Player can submit exactly one answer per question and receives a visible acknowledgement that it registered
- [x] Nothing about submissions — count, names, or correctness — reaches the Stage or the Backbone until the reveal is triggered
- [x] The Backbone shows a countdown toward the reveal, so the Presenter knows when to press it
- [x] On reveal, the Stage shows the correct answer
- [x] The answer window closes automatically and the question accepts no submissions afterwards
- [x] A tick plays during the answer window, a sting at the suspense pause, and a distinct sound on the reveal
- [x] Every sound is triggered by a state change rather than by an operator pressing something, so nothing can fire at the wrong moment
- [x] A single mute control silences everything, and a missing or unreadable audio file degrades to silence without blocking the reveal
- [x] The Backbone shows the correct answer and the cue line for the Presenter, and neither appears on the Stage

## Comments

Built on 2026-10-15, on top of ticket 01.

### The shape the spine takes

The state machine gains three phases — `answering`, `revealPending`,
`revealed` — and one rule that the rest of the ticket hangs off: **the sealed
submissions are not part of the state a socket carries.** `GameState` holds
them in `sealed`; `shown(state)` is the only way out of the machine, and it
drops that field. A surface therefore *cannot* draw a submission before the
reveal, not because it chose not to but because the broadcast carries none.

This is how ADR-0003 is enforced. It needed to be, because ADR-0004 means the
server cannot tell the Stage from the Backbone from a phone — there is no
identity on a connection — so it cannot send them different views of the same
state. One broadcast for all three surfaces is the only option, and the only
way to honour the reveal-hiding rule across it is for the secret to have no
field to travel in.

The answer key is never broadcast at all. The Backbone reads the correct
option and the cue line from `src/content/show.ts` on the presenter's own
laptop, through `forPresenter`, so the Presenter can direct the room from the
moment the question goes up without the answer ever being on a wire.

### Where each rule lives

The machine is still the whole rules, and the server still only asks it. Each
new decision is a `plan…` that returns the event it would record:
`planNextQuestion` (which also owns the question queue, so the adapter cannot
pick a spent question), `planSubmitAnswer`, `planCloseAnswerWindow`,
`planReveal`. The server calls them and records what they hand back. It holds
no rule of its own about what may be asked, answered, or revealed.

### The clock

The machine never reads a clock. `questionPresented` carries an `at` from the
server's `Date.now()`; the answer window is one `setTimeout` in the adapter
that emits `answerWindowClosed`, re-armed from `askedAt` on every state change
and once at boot, so a server that restarts mid-question closes the window when
it was always going to close rather than ten seconds after the restart.
`secondsLeft(askedAt, now)` is the arithmetic both the Backbone countdown and
the Stage timer use; neither waits for anything real to test it.

### Sound

`cuesBetween(before, after)` takes two states and returns what should be heard.
It has no operator input, which is the whole rule: pressing reveal twice cannot
sting twice, and a Backbone that reloads mid-show is given a state rather than a
change, so it cannot replay a sting that already passed. The repeating tick is
the sustained sound of an open window — armed by the state, disarmed by the
state. `createSound` is the only code that touches a device, catches everything
it throws, and names the missing file on the Backbone so a silent show is a
known fact rather than a mystery.

### Deliberately not built

The Cull (03), the Bracket (04), simulated Players (03) and the deck (07).
The loop is exactly one question, one answer, one reveal. A Presenter can press
"Ipakita ang tanong" again after a reveal — that is one clause in
`planNextQuestion` and it is what lets the queue be seen to drain and to run
out — but nothing loops it, resolves it, or grades a survivor.

Two questions are in `questionBank`, not the full Module 8 set: two is the
minimum that shows the queue advancing and emptying, and the bank is where
ticket 06 puts the rest.

### Open for review

- The Player phone counts down as well as the Backbone (spec story 14). No
  ticket owned it and a phone with no countdown is a phone that cannot tell
  whether its answer mattered.
- The Backbone names an audio file it could not play. Silence that the
  Presenter cannot explain is the failure mode the spec calls out, and a
  warning is cheaper than a mystery on the day.
- The Post-reveal submission count on the Backbone is this ticket's; the cull
  grid that replaces it is 03's.

### The Stage regression, caught by ticket 01's own tests

Rewriting the Stage for a question broke six tests committed in `ef1bf3c`:
`aShow()` builds a state with no `question` key, so `state.question` is
`undefined`, and the Stage's `question === null` test fell through to rendering
a question that was not there. Fixed at the Stage — `state.question ?? null` in
all three surfaces — rather than by loosening the committed tests. The join
screen is the Stage's floor and nothing about "no question" should be able to
fall through it.