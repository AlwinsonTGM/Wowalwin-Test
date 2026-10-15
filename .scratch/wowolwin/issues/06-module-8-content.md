# 06: Author the Module 8 content

**What to build:** Every question, prize, and line in the show exists and is correct. A Presenter can revise any of it — a question, a prize, a phrase — without touching a single component. The show stops being a demonstration with placeholder text and becomes the thing that teaches Module 8.

This ticket is authored in full from the Module 8 source, including a placeholder prize table, so it is never waiting on anyone. The presenters swap the prize strings for what they actually obtain.

**Blocked by:** 01 — Join the show. Can run in parallel with 02 through 05; it gates nothing.

**Status:** ready-for-agent

- [x] The question bank covers all three Module 8 blocks — the importance of planning, the TRIM tools, and failure in entrepreneurship
- [x] Separate pools exist for Cull questions and for bout questions, since the two need different difficulty profiles
- [x] Later questions are weighted toward failure, so the finale pays off what the quiz set up
- [x] Every question has exactly one correct answer, and a malformed question fails validation at build time rather than during the show
- [x] The prize table is populated with realistic classroom placeholders: a small guaranteed voucher for Pera, a set of larger vouchers and snack or drink items, and Bokya
- [x] Every on-screen line is Taglish — Filipino for the host's voice and the drama, English for the business terms
- [x] Deck copy covers the five TRIM instruments in depth and the eight entrepreneurs — Socorro Ramos, John Gokongwei Jr., Tony Tan Caktiong, Henry Sy, Ramon del Rosario, Vince Ong, Dado Banatao, and Maria Ressa — with what each one failed at first
- [x] A Presenter can change a question, a prize, or a line without touching any component, and the change is type-checked
- [x] Placeholder prizes are clearly marked as placeholders, so nobody presents a voucher for something they do not have

## Comments

### Moved ahead of ticket 04 — the Cull cannot reach its target with 2 questions

@Implementer folded 40-player rooms through the real machine and @Checker measured it
independently. The bank currently holds 2 questions, so taking 40 Players down to the
target of 10 needs a 75% cut on the *first* question alone. Any softer round and the
queue empties with 20 or 40 survivors, `queueEmpty`, never 10. The adaptive loop in
ticket 03 is correct; the bank is simply too small to exercise it.

Ticket 04's first box seeds eight from the survivors, so it cannot be tested at all
until this is fixed. This ticket gates nothing *logically* — it was always parallel —
but it is now on the critical path in practice.

**Build order from here: 06, then 04, then 05, then 08.**

**Size needed: roughly 13 questions.** About 4 Cull questions at a realistic
two-thirds answer rate to take 40 down to 10, plus 8 for the Bracket's bouts. Size for
the worst realistic case, not the lucky one — a bank that only works when the room
happens to know the answers is not a bank, it is a coin toss.

Keep the Cull and bout pools separate (box 2) and weight later questions toward
failure (box 3). That second one now matters more than it read: the Cull must land
under ten survivors, so difficulty has to be *controlled*, not merely increasing.

### Implemented on 2026-10-15

- Authored `src/content/questions.ts` with 10 Cull questions (ordered easiest first, weighted to failure at the tail) and 10 Bout questions.
- Added `questionProblems` and `bankProblems` build-time validation, wired into `npm run content:check` and `npm run build`.
- Authored `src/content/prizes.ts` with Pera voucher (50 pesos), Bokya (0 pesos), and 8 Kahon prizes (40 to 400 pesos) clearly flagged with `placeholder: true`.
- Authored `src/content/deck.ts` with the 5 TRIM instruments in depth and the 8 named entrepreneurs with their initial failures.
- Rewired `machine.ts` to named question pools (`cull` / `bout`), moved `forPresenter` to `questions.ts`, and updated surfaces and tests.
- 208 vitest tests passing green, clean build and typecheck.