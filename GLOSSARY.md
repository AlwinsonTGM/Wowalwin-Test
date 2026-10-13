# Wowolwin

A short game show segment that teaches Module 8 of GEE008 (Planning and Failures of Entrepreneurs), played live by a class of up to 40 players on their phones, presented by a team of seven, and followed by a short presentation on the module.

## The Show

**Wowolwin**:
The game show being built. Named after the real Willie Revillame show `Wowowin`, which the presenter's name rhymes with.
_Avoid_: Wowowin (the real Philippine show), Wilyonaryo, Wil to Win

**Segment**:
One named game from a Revillame show, rebuilt to carry module content. Exactly one segment is in scope.
_Avoid_: Game, round, level, mode

**Pera o Kahon**:
The one segment in scope. A player chooses between guaranteed cash and a mystery box, with escalating offers and a losing outcome. It maps onto Module 8 because choosing under uncertainty is exactly what planning exists to reduce risk around.
_Avoid_: Cash or Box, money or box, the Kahon game

**Bokya**:
The losing outcome of the Kahon — nothing won. Real, redeemable food vouchers are the only prizes; there is no cash.
_Avoid_: Loss, fail, empty box, nothing

**Redeemable value**:
A peso figure that stands for real food the presenters physically bring. Pera is a small guaranteed voucher; the Kahon draws from a larger table of prizes.
_Avoid_: Prize, money, cash, reward

## Players and Tournament

**Player**:
A classmate who joins from their phone by opening a link and typing a name. Up to 40 join.
_Avoid_: Contestant, user, attendee, gamer

**Join**:
The moment a player enters their name and appears in the roster. Happens before the tournament starts.
_Avoid_: Registration, signup, lobby

**The cull**:
The opening phase. Whole-room questions run one at a time; after each, every player's name flips to survived or eliminated at once. It repeats until 10 or fewer players remain.
_Avoid_: Qualifier, warm-up, trivia round, screening

**Bout**:
A one-on-one elimination between two players on a single question, lasting twenty seconds: ten seconds to answer, five of suspense, five to show the winner.
_Avoid_: Round, match, fight, head-to-head

**Bracket**:
The single-elimination path from the cull's survivors down to one finalist — 8, then 4, then 2, then 1.
_Avoid_: Tournament, ladder, gauntlet, playoffs

**Finalist**:
The last player standing. The only one who plays Pera o Kahon.
_Avoid_: Winner, champion, last player standing

**First correct submission wins**:
The rule settling a bout. The earliest correct answer takes it, regardless of when the other player submitted. Both wrong eliminates the first submitter. Nobody submitting eliminates nobody.
_Avoid_: Buzz-in, first to answer, race condition

**Manual reveal**:
Submissions stay hidden from the operator until they choose to show them, so the suspense belongs to the presenters rather than to the network.
_Avoid_: Showdown, unmasking, reveal screen

## The Three Surfaces

**Backbone**:
The operator's laptop. Controls everything, including what the projector shows. Holds the answers, the next bout, and a presenter cue line.
_Avoid_: Operator view, control panel, console, admin view, host view

**Stage**:
The projector. Everything the room sees, and nothing else.
_Avoid_: Audience view, projector view, presentation view, public screen

**Player phone**:
A separate mobile page a player loads to submit an answer. It submits and nothing more — it never grades, never shows who was first, and never reveals.
_Avoid_: Player view, mobile view, client, app

**Local hotspot**:
The Windows hotspot the presenter's laptop runs. Players join it, then reach the laptop by its hotspot address. The whole show runs inside that one network.
_Avoid_: Wi-Fi, network, LAN, localhost (see ADR-0001)

## Content

**Module 8**:
Planning and Failures of Entrepreneurs. Three blocks: Importance of Planning, the TRIM Framework, and Failure and Entrepreneurship. Source of all game and deck content.
_Avoid_: Module 8 content (redundant), the unit, the chapter

**TRIM tool**:
One of the five planning instruments in the module — Business Model Canvas, Business Brief, Feasibility Study, Pitch Deck, Business Plan.
_Avoid_: Framework item, planning tool, document type

**Question bank**:
All quiz and bout questions, held in a typed content file and editable without touching component code. Spreads across all three module blocks.
_Avoid_: Questions, content file, trivia

**The deck**:
HTML slides in the same repo, presented after the game. Carries TRIM in depth and the eight Filipino entrepreneurs who failed first — the teaching a game show cannot dramatise.
_Avoid_: Slides, presentation, PowerPoint

## Props

**Prop box**:
One of the seven physical boxes the presenters hold. Pure set dressing — the game tracks no box state, and the presenter holding one reacts to the projector rather than to it.
_Avoid_: Kahon (that is the on-screen game), box, prize box