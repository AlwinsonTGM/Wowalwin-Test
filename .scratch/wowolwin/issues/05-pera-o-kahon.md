# 05: Pera o Kahon

**What to build:** The single surviving Finalist is offered a real choice between Pera and the Kahon. Pera is the small guaranteed voucher; the Kahon draws at random from a table of larger prizes, and may return Bokya. The Stage names the winning prize exactly as it is written on the item physically handed over.

This is the payoff the whole show has been building toward, so it lands last: a Finalist has to exist before the choice means anything.

**Blocked by:** 04 — The bracket.

**Status:** done

- [x] The Finalist is offered an unhurried, clear choice between Pera and the Kahon, and the choice is genuinely theirs
- [x] Taking Pera resolves to the fixed small guaranteed voucher
- [x] Opening the Kahon draws from the prize table through the injected generator rather than from a random source the machine owns
- [x] A pinned generator reproduces the same draw on every run, so a rehearsal is repeatable
- [x] Bokya is reachable as a genuine outcome from the table and carries its own sound, distinct from a win
- [x] The Stage names the winning prize exactly as it appears in the content, so the screen can never contradict the item being handed over
- [x] The Backbone knows the drawn prize before the reveal animation runs, so the correct item is already in hand
- [x] The prop box moment is operator-triggered rather than automatic, so the presenter holding it controls when it opens
- [x] The Finalist's own phone reflects the choice and the outcome

## Comments

### Implemented and Verified on 2026-10-15

- **Choice & Authority**: Finalist is offered unhurried choice without countdown timer on their own phone; Presenter has fallback choice authority on the Backbone if the phone drops (ADR-0004).
- **Guaranteed Pera vs. Mystery Kahon**: Taking Pera resolves to ₱50 voucher; opening Kahon draws from `kahonTable` via injected generator or deterministic Mulberry32 PRNG seed.
- **Bokya & Audio Routing**: Bokya (₱0) is reachable and triggers distinct `'bokya'` audio cue (`audio/bokya.mp3`) instead of `'reveal'`. Graceful silent degradation if audio file is missing.
- **Prop Box Timing & Secrecy**: Backbone receives drawn prize information before Stage reveal so presenter has the physical item ready; Stage stays in suspense until operator explicitly triggers "Buksan ang Kahon" (ADR-0003).
- **QA Audit**: Passed full audit by `@Checker` (`STATUS: PASS`). 270 tests passing, clean typecheck and production build.