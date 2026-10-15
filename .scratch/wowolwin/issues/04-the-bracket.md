# 04: The bracket

**What to build:** The Cull's survivors are trimmed to eight, seeded into a single-elimination bracket, and run down to a single Finalist: eight to four, four to two, two to one. Each bout is twenty seconds — ten to answer, five of suspense, five to show the winner.

This is the highest-risk ticket in the project. The ambiguous outcomes are what will break on the day, and the rules only make sense across a whole tournament, so the whole path is tested end to end rather than bout by bout.

**Blocked by:** 03 — The cull.

**Status:** done

- [x] When the Cull ends with more than eight survivors, the Backbone offers a trim control and the presenters choose who advances
- [x] Bracket pairings are seeded from the injected generator, so a pinned seed reproduces the same bracket on every run
- [x] A bout presents one question to two Players and runs ten seconds of answering, five of suspense, and five to show the winner
- [x] The earliest correct submission wins the bout, regardless of when the other Player submitted and regardless of whether the first submission was correct
- [x] When every submission is wrong and at least one Player submitted, the earliest submitter is eliminated and the other Player advances
- [x] When neither Player submitted, nobody is eliminated and the operator re-runs the bout — the rule that guarantees the bracket always converges
- [x] The Bracket advances itself once a bout resolves, without the operator wiring winners onward by hand
- [x] The Stage shows the surviving Bracket throughout so the room can track who is left
- [x] The correct answer is visible on the Backbone only, and never on the Stage
- [x] A mistaken elimination can be reversed, but only through a deliberate confirmed action
- [x] A Player who is waiting for their turn is told so on their phone rather than left staring at an unanswered question
- [x] A Player who lost a bout is told immediately and plainly on their own phone

## Comments

### Ruling: the Cull must never empty the room. It belongs to the Cull, not the Bracket.

@Bug Fixer traced it and @Checker measured it. In `wrong` mode every Player is
eliminated, `cullOver` reports `cullComplete` because 0 ≤ target, and the Bracket is
handed nothing to seed. The arithmetic is not lying — the cull genuinely finished, it
finished with nobody left.

**Decision: "at least one survivor" is an invariant the Cull holds, not a fact the
show can fail.** The last Player standing cannot be eliminated.

@Bug Fixer is right that it belongs in the Cull's rule rather than in the Bracket, and
right that it must be decided explicitly rather than letting the first empty bracket
define it. A Bracket that defends against an empty field is a Bracket that has
accepted the Cull as broken.

**The full rule, both clauses, lives in ticket 03's Comments.** Summarised: on a
reveal everyone `in` who did not answer correctly is eliminated, except that the Cull
never ends with zero survivors — the last submitter keeps their place, and **when
nobody submitted at all, the first Player who joined does**. That second clause was
missing when this ruling was first written and @Checker measured the hole: 40 players,
zero submissions, reveal, `cullComplete` with an empty grid. A frozen room is the
*likely* outcome on show day, not an edge case, so the floor has to hold there too.

Read 03's amendment before seeding a bracket, because it changes what a valid Cull
outcome is.

It is not arbitrary: a Player who submitted is a Player the room watched try. The one
standing at the end is someone who played rather than someone who was spared by a
loop guard, which matters because the room is watching this happen.

**The corrected cost, per @Checker — do not price this at zero.** @Implementer said the
empty cull is unreachable from a seeded room, which is true for `correct` and `mixed`
but not for `wrong`: that generator returns the wrong option unconditionally, so it is
a seeded mode that empties the room exactly as real phones would. Measured: 40 seeded
Players, `wrong`, one round, zero survivors, `cullComplete`. The guarantee therefore
costs **one rehearsal mode out of three**, plus show day — not nothing. That is still
the right trade: a silent bug in one rehearsal mode is better than a show that can end
with no winner in front of a classroom.

Note this makes `wrong` mode a deliberate test of the guarantee rather than a way to
produce an empty cull. It is the mode that exercises the last-Player rule, so keep it.

### Ticket 06 moves ahead of this one

@Implementer folded 40-player rooms through the real machine: the bank has 2
questions, so getting 40 down to 10 needs a 75% cut on the first question alone. Any
softer round hits `queueEmpty` at 20 or 40 survivors, never 10. The adaptive loop is
correct and the bank is too small — this is a content gap, not a code defect, and both
03 and 04 are correct code against it.

So **ticket 06 (Module 8 content) is now ahead of 04**, and 06 is otherwise unblocked.
Roughly 13 questions: about 4 for the Cull at a realistic two-thirds answer rate, plus
04's eight bouts. Without it, "seeds eight from the survivors" — this ticket's own
first box — cannot be tested at all.

Build order from here: **06, then 04**, then 05, then 08.

### Implemented and Verified on 2026-10-15

- **Cull floor guarantee**: Invariant preserved in `revealAnswer` — Cull never ends with zero survivors (last submitter survives; if 0 submissions, first joined player still in survives).
- **Trimming and Seeding**: Operators can trim >8 Cull survivors down to 8 via `planTrimCull`. `planSeedBracket` uses deterministic Mulberry32 PRNG to pair entrants reproducibly. Supports 1..8 players with balanced bye placement and auto-advancement.
- **Bout cycle and resolution**: 20s cycle (10s answer, 5s suspense, 5s winner timer) with automatic advance. Earliest correct answer wins; all wrong eliminates earliest submitter; tie/no-submissions eliminates nobody and permits operator re-run via `planRerunBout`.
- **Surfaces**: Stage displays the live bracket tree throughout with zero answer leakage during bouts (ADR-0003). Backbone provides full tournament controls and confirmed elimination reversals. Player phones plainly tell waiting players and eliminated players their status without leaking bout questions.
- **QA Audit**: Passed full audit by `@Checker` (`STATUS: PASS`). 238 tests passing, clean typecheck and production build.