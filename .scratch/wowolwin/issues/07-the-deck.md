# 07: The deck

**What to build:** The short presentation follows the game, carrying the density a game show cannot: TRIM in depth and the eight entrepreneurs who failed first. Slides are HTML in the same client, sharing the game's visual language, and they run from the Backbone without anyone switching windows.

The Backbone can switch the Stage into the deck from **any** phase, not only after the finale. That makes the deck a live safety net: if the game cannot run — hotspot dead, nobody joined, a rule misbehaving — the presenters drop straight into the deck and still deliver a presentation.

**Blocked by:** 01 — Join the show. Can run in parallel with 02 through 05; it gates nothing.

**Status:** done

- [x] The deck is HTML slides in the same client as the game, sharing its fonts, colours, and visual language
- [x] The deck covers the five TRIM instruments in depth, not merely their names
- [x] The deck covers the eight entrepreneurs with what each failed at before succeeding
- [x] The Backbone can switch the Stage into the deck from any phase, including while a question is running
- [x] The Backbone can return the Stage to whatever phase the deck interrupted, and the game resumes where it left off
- [x] Slides advance from the Backbone without leaving it or alt-tabbing to another window
- [x] The deck runs on its own from the moment ticket 01 lands, with no dependency on the Cull, the Bracket, or the finale
- [x] Deck content lives in the same content files as the game content

## Comments

### Implemented and Verified on 2026-10-15

- **HTML Slides & Visual Continuity**: Authored 17 HTML slides rendered directly in Stage with shared game styling, typography, and theme accents.
- **Deep Content**: Detailed TRIM framework tools (Team, Resources, Idea, Market, Entrepreneurial Method) and 8 Filipino entrepreneur failure accounts with key lessons.
- **Safety Net Architecture**: Backbone can open/close the deck from any phase without destroying underlying game state; timers and submissions pause during deck presentation and cleanly resume upon closing.
- **Backbone Control Authority**: Slide navigation (prev, next, direct jump) is strictly guarded by `isPresenter` (ADR-0004).
- **QA Audit**: Passed full audit by `@Checker` (`STATUS: PASS`). 290 tests passing, clean typecheck and production build.