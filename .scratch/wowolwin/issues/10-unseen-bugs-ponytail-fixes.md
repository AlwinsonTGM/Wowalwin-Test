# 10: Unseen Bugs, Root-Cause Reasoning & Ponytail Fixes

**Mode:** `ponytail` (full) — smallest complete change at the root-cause seam, zero extra abstractions, every caller and test traced.

**What to build:** Fix 10 critical, high, and medium severity bugs identified across the game machine, server, and client surfaces that escaped existing test suites due to subtle test evaluation order issues or hand-rolled test state mocks.

**Status:** completed

## Summary Scorecard of Unseen Bugs

| # | Bug | File & Lines | Severity | Root Cause & Seam |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Disarmed simulation (`armed: false`) still auto-submits answers on every `questionPresented` | `src/server/show-server.ts:182–184` | **Critical** | Guard `questionPresented` auto-submission with `state.simulation.armed`. Fix evaluation order in `driveTheSeededCull` and timing in `show-server.test.ts`. |
| **2** | Seeding the Bracket (`bracketSeeded`) keeps stale Cull `phase: 'revealed'`, `question`, and `answer`, triggering a false 0-submission tie across all 3 surfaces | `src/game/machine.ts:510–532`, `src/client/Backbone.tsx:89, 161`, `src/client/Stage.tsx:173, 183`, `src/client/Player.tsx:50, 56` | **Critical** | In `bracketSeeded`, reset `phase: 'started'`, `question: null`, `answer: null`, `sealed: []`. |
| **3** | Bracket `eliminationReversed` leaves `formerWinner` or downstream losers as `standing: 'out'`, fails to clear Final slot if `formerWinner` lost in SF, and leaves stale `question`/`answer`/`finale` | `src/game/machine.ts:543–589` | **High** | Walk bracket tree feeder paths (`0,1->4; 2,3->5; 4,5->6`), collect restored players, reset `standing: 'in'`, clear downstream winner/parent slots, and reset question/answer/finale when a bout is reopened. |
| **4** | `'mixed'` simulation mode in the Bracket can permanently deadlock on a 0-submission tie across infinite re-runs | `src/game/machine.ts:985–1002` | **High** | In `planSimulateAnswers`, filter `room` by `(state.bracket === null || isPlayerInCurrentBout(state, player.id))`. |
| **5** | Direct Bout Resolution (`boutResolvedDirectly`) before a question is presented leaves `currentBoutId` on the resolved bout and hides manual controls for the next bout; exhausting the 10-question `bout` pool bricks the Bracket | `src/game/machine.ts:619–663, 818–830`, `src/client/Backbone.tsx:258` | **High** | Advance `currentBoutId` on direct resolution when `state.question === null`. Fall back to unresolved bout in Backbone. Recycle bout/cull questions in `planNextQuestion` if pool is exhausted during bracket re-runs. |
| **6** | Player phone `answerAck` (`answerNote`) is never cleared when a new question goes up | `src/client/useShow.ts:49, 70, 75`, `src/client/Player.tsx:177` | **High** | In `useShow.ts`, reset `answerAck` to `null` whenever `message.state.question?.id` changes. |
| **7** | `cullOver` returns `'cullComplete'` or `'queueEmpty'` mid-question (`answering` / `revealPending`) before the reveal happens | `src/game/machine.ts:781–794, 1012, 1035`, `src/client/Backbone.tsx:185, 225, 460` | **High** | Return `null` from `cullOver` and false from `cullLowOnQuestions` if `state.phase === 'answering' || state.phase === 'revealPending'`. Guard Backbone Cull status notes with `state.bracket === null`. |
| **8** | Opening the Safety Net Deck mid-question does not pause `askedAt` wall-clock or stop the 1s audio tick; closing the Deck after >10s closes the answer window in `0ms` | `src/server/show-server.ts:190–199`, `src/client/useShowSound.ts:42`, `src/game/machine.ts:601–618` | **Medium** | Mute tick audio when `state.deck?.active`. Track `openedAt` in DeckState; shift `question.askedAt` by pause duration when closing deck in `answering` phase. |
| **9** | Any phone disconnecting/reconnecting during a bout's 5s suspense or 5s winner pause resets `suspenseTimer` / `winnerTimer` back to a full 5 seconds | `src/server/show-server.ts:177, 200–217` | **Medium** | Filter `armTimers()` in `record()` so non-timer events (`playerDisconnected`, `playerReconnected`, `playerJoined`, `answerSubmitted`, `simulationSet`, `deckSlideSet`) do not restart suspense/winner timers. |
| **10** | Stale `localStorage` token on a `--fresh` show triggers a false `"Lagyan ng pangalan"` error on load; `planResume` allows a socket to claim a `simulated` player ID; `Stage.tsx` hides `.is-out` during `answering` in Round 2+ | `src/server/show-server.ts:387–408`, `src/game/machine.ts:737–754`, `src/client/Stage.tsx:169, 382` | **Medium** | Prevent resuming simulated players in `planResume`. Send `unknownPlayer` (or `showStarted`) if message has token but no name. Clear `TOKEN_KEY` in `useShow.ts` on `unknownPlayer`. Keep `.is-out` visible on Stage for previously eliminated players. |

## Acceptance Criteria
- [x] Bug 1: Disarmed simulation does not auto-answer; on-demand answer still works; test suite fixes applied.
- [x] Bug 2: Seeding bracket resets phase to `'started'`, clears question & answer; no false tie or hidden buttons on Bout 1.
- [x] Bug 3: Reversing bracket elimination walks tree, clears invalid downstream slots, restores standings to `'in'`, and clears stale finale.
- [x] Bug 4: Mixed simulation mode in bracket only considers active bout fighters, eliminating 0-submission deadlocks.
- [x] Bug 5: Direct bout resolution advances `currentBoutId` when no question is active; Backbone exposes manual resolution for next bout; exhausted question pool recycles questions safely.
- [x] Bug 6: Phone `answerAck` clears upon new question presentation.
- [x] Bug 7: `cullOver` returns `null` while question is in `answering` or `revealPending`; Backbone banners do not leak into bracket.
- [x] Bug 8: Safety Net Deck pauses question timer and shifts `askedAt`; audio tick is muted while deck is open.
- [x] Bug 9: Spectator/player disconnect/reconnect does not restart active 5s suspense/winner timers.
- [x] Bug 10: Stale join token receives `unknownPlayer` without triggering `nameRequired`; simulated players cannot be resumed; Stage grid maintains `.is-out` for eliminated players during active answering rounds.
- [x] Full test suite passes (`npm test`), `npm run typecheck` clean, `npm run build` clean.
