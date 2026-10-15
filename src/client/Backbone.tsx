import { useState } from 'react';
import { copy, showConfig } from '../content/show.ts';
import { forPresenter } from '../content/questions.ts';
import { Pera, Bokya, findPrize, peso, hasPlaceholderPrizes } from '../content/prizes.ts';
import { activeBout, cullLowOnQuestions, cullOver, questionsLeft, survivors, type ShownState } from '../game/machine.ts';
import { deckSlides } from '../content/deck.ts';
import { useSecondsLeft } from './clock.ts';
import { useShowSound } from './useShowSound.ts';
import type { Connection } from './useShow.ts';
import type { SimulationMode } from '../game/events.ts';

/** The Presenter's laptop: the whole roster, the controls, and what the room sees. */
export function Backbone({
  state,
  joinUrl,
  connection,
  onStartShow,
  onPresentQuestion,
  onReveal,
  onSimulate,
  onClearSimulated,
  onSimulateAnswers,
  onSetSimulation,
  onTrimCull,
  onSeedBracket,
  onRerunBout,
  onReverseElimination,
  onStartFinale,
  onChoosePera,
  onChooseKahon,
  onRevealKahon,
  onOpenDeck,
  onCloseDeck,
  onSetDeckSlide,
  onNextDeckSlide,
  onPrevDeckSlide,
  isRehearsal = false,
  onSubmitAnswerOnBehalf,
  onResolveBoutDirectly,
}: {
  state: ShownState;
  joinUrl: string | null | undefined;
  connection: Connection;
  onStartShow: () => void;
  onPresentQuestion: () => void;
  onReveal: () => void;
  onSimulate: (count: number) => void;
  onClearSimulated: () => void;
  onSimulateAnswers: () => void;
  onSetSimulation: (armed: boolean, mode: SimulationMode) => void;
  onTrimCull?: (survivorIds: string[]) => void;
  onSeedBracket?: (seed?: number) => void;
  onRerunBout?: () => void;
  onReverseElimination?: (playerId: string) => void;
  onStartFinale?: (seed?: number) => void;
  onChoosePera?: () => void;
  onChooseKahon?: (seed?: number) => void;
  onRevealKahon?: () => void;
  onOpenDeck?: (slideIndex?: number) => void;
  onCloseDeck?: () => void;
  onSetDeckSlide?: (slideIndex: number) => void;
  onNextDeckSlide?: () => void;
  onPrevDeckSlide?: () => void;
  isRehearsal?: boolean;
  onSubmitAnswerOnBehalf?: (playerId: string, optionId: string) => void;
  onResolveBoutDirectly?: (boutId: string, winnerId: string) => void;
}) {
  const full = state.roster.length >= showConfig.playerCap;
  // `?? null` for the same reason as the Stage: "no question yet" has to be the
  // floor the control panel rests on, not something that falls through.
  const question = state.question ?? null;
  // The Backbone is the only surface with sound, and the only one that knows the
  // answer before the reveal: both are read from content, never from a socket.
  const presenter = question ? forPresenter(question.id) : null;
  const sound = useShowSound(state);
  const seconds = useSecondsLeft(question && state.phase === 'answering' ? question.askedAt : null);

  const alive = survivors(state).length;
  const seeded = state.roster.filter((player) => player.simulated).length;
  const over = cullOver(state);
  const modes: SimulationMode[] = ['correct', 'wrong', 'mixed'];

  const [selectedTrimIds, setSelectedTrimIds] = useState<string[]>([]);
  const [reversingPlayerId, setReversingPlayerId] = useState<string | null>(null);
  const [behalfPlayerId, setBehalfPlayerId] = useState<string>('');
  const [behalfOptionId, setBehalfOptionId] = useState<string>('');

  const currentBout = activeBout(state);
  const resolvableBout =
    currentBout?.winnerId === null
      ? currentBout
      : (state.bracket?.bouts.find((b) => b.winnerId === null && b.player1Id !== null && b.player2Id !== null) ?? null);
  const isBoutTied = state.bracket !== null && state.phase === 'revealed' && currentBout?.winnerId === null && state.answer !== null;

  const eligiblePlayers =
    state.bracket !== null && currentBout
      ? state.roster.filter(
          (p) =>
            (p.id === currentBout.player1Id || p.id === currentBout.player2Id) &&
            p.standing === 'in',
        )
      : state.roster.filter((p) => p.standing === 'in');

  const selectedBehalfPlayerId = eligiblePlayers.some((p) => p.id === behalfPlayerId)
    ? behalfPlayerId
    : (eligiblePlayers[0]?.id ?? '');
  const selectedBehalfOptionId = question?.options.some((o) => o.id === behalfOptionId)
    ? behalfOptionId
    : (question?.options[0]?.id ?? '');

  return (
    <main className="surface surface--backbone">
      <header>
        <div className="header-title">
          <h1>{copy.backbone.title}</h1>
          <span className={`badge badge--mode ${isRehearsal ? 'badge--rehearsal' : 'badge--show'}`}>
            {isRehearsal ? copy.common.rehearsalLog : copy.common.showLog}
          </span>
        </div>
        <div className="header-status">
          <p className={`status status--${connection}`}>{copy.backbone.status[connection]}</p>
          <p className="connection-health">
            {copy.backbone.connectionHealth(
              state.roster.filter((p) => p.connected).length,
              state.roster.length,
            )}
          </p>
        </div>
      </header>

      {(() => {
        const disconnectedCount = state.roster.filter((p) => !p.connected && p.standing === 'in').length;
        if (disconnectedCount > 0 && state.phase !== 'joining') {
          return <p className="warning connection-alert">{copy.backbone.disconnectedAlert(disconnectedCount)}</p>;
        }
        return null;
      })()}

      <section className="panel">
        <h2>{copy.backbone.joinLinkHeading}</h2>
        {joinUrl !== undefined &&
          (joinUrl ? <p className="join-url">{joinUrl}</p> : <p className="warning">{copy.common.noAddress}</p>)}
        <p className="note">{copy.common.firewallNote}</p>
      </section>

      <section className="panel">
        <h2>{copy.backbone.controlHeading}</h2>

        {state.phase === 'joining' && (
          <button
            type="button"
            className="start"
            onClick={onStartShow}
            disabled={connection !== 'online'}
          >
            {copy.backbone.startShow}
          </button>
        )}

        {/* Between questions, not on top of one: the machine would refuse it, and a
            control that cannot be delivered does not belong on the screen. */}
        {/* Between questions in cull, or in bracket before finalist */}
        {(state.phase === 'started' ||
          (state.phase === 'revealed' && state.bracket === null && over === null) ||
          (state.phase === 'revealed' && state.bracket !== null && state.bracket.finalistId === null && !isBoutTied)) && (
          <button
            type="button"
            className="start"
            onClick={onPresentQuestion}
            disabled={connection !== 'online'}
          >
            {copy.backbone.presentQuestion}
          </button>
        )}

        {/* Re-run button when neither Player submitted in a bout */}
        {isBoutTied && onRerunBout && (
          <button
            type="button"
            className="start"
            onClick={onRerunBout}
            disabled={connection !== 'online'}
          >
            {copy.backbone.rerunBout}
          </button>
        )}

        {/* Trim control when Cull ends with more than 8 survivors */}
        {state.bracket === null && over !== null && alive > 8 && onTrimCull && (
          <div className="trim-panel">
            <h3>{copy.backbone.trimHeading}</h3>
            <p className="note">{copy.backbone.trimInstruction}</p>
            <p className="label">{copy.backbone.trimCount(selectedTrimIds.length)}</p>
            <ul className="trim-list">
              {survivors(state).map((p) => {
                const checked = selectedTrimIds.includes(p.id);
                return (
                  <li key={p.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) {
                            setSelectedTrimIds(selectedTrimIds.filter((id) => id !== p.id));
                          } else if (selectedTrimIds.length < 8) {
                            setSelectedTrimIds([...selectedTrimIds, p.id]);
                          }
                        }}
                      />
                      {p.name}
                    </label>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="start"
              disabled={connection !== 'online' || selectedTrimIds.length !== 8}
              onClick={() => onTrimCull(selectedTrimIds)}
            >
              {copy.backbone.trimConfirm}
            </button>
          </div>
        )}

        {/* Seed Bracket button when survivors <= 8 */}
        {state.bracket === null && over !== null && alive <= 8 && alive > 0 && onSeedBracket && (
          <button
            type="button"
            className="start"
            onClick={() => onSeedBracket()}
            disabled={connection !== 'online'}
          >
            {copy.backbone.startBracket}
          </button>
        )}

        {/* Bracket details and ambiguous outcomes rules when bracket is active */}
        {state.bracket !== null && (
          <div className="bracket-panel">
            <h3>{copy.backbone.bracketHeading}</h3>
            {state.bracket.finalistId ? (
              <p className="finalist-callout">
                {copy.backbone.finalistHeading}:{' '}
                <strong>{state.roster.find((p) => p.id === state.bracket!.finalistId)?.name}</strong>
              </p>
            ) : currentBout ? (
              <p className="current-bout">
                <span className="label">{copy.backbone.currentBoutHeading}: </span>
                <span>
                  {copy.backbone.rounds[currentBout.round]} —{' '}
                  {state.roster.find((p) => p.id === currentBout.player1Id)?.name ?? 'TBD'} vs{' '}
                  {state.roster.find((p) => p.id === currentBout.player2Id)?.name ?? 'TBD'}
                </span>
              </p>
            ) : null}

            {isBoutTied && <p className="warning">{copy.stage.tieNoSubmissions}</p>}

            {resolvableBout && resolvableBout.winnerId === null && resolvableBout.player1Id && resolvableBout.player2Id && onResolveBoutDirectly && (
              <div className="direct-resolution">
                <span className="label">{copy.backbone.directResolutionHeading}: </span>
                <div className="direct-resolution-buttons">
                  <button
                    type="button"
                    className="ghost ghost--small"
                    onClick={() => onResolveBoutDirectly(resolvableBout.id, resolvableBout.player1Id!)}
                    disabled={connection !== 'online'}
                  >
                    {copy.backbone.declareWinner(
                      state.roster.find((p) => p.id === resolvableBout.player1Id)?.name ?? 'Player 1',
                    )}
                  </button>
                  <button
                    type="button"
                    className="ghost ghost--small"
                    onClick={() => onResolveBoutDirectly(resolvableBout.id, resolvableBout.player2Id!)}
                    disabled={connection !== 'online'}
                  >
                    {copy.backbone.declareWinner(
                      state.roster.find((p) => p.id === resolvableBout.player2Id)?.name ?? 'Player 2',
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="ambiguous-rules">
              <span className="label">{copy.backbone.ambiguousRulesHeading}: </span>
              <p className="note">{copy.backbone.ambiguousRules}</p>
            </div>
          </div>
        )}

        {/* Start Finale button when Finalist is crowned (Ticket 05) */}
        {Boolean(state.bracket?.finalistId) && state.finale === null && onStartFinale && (
          <button
            type="button"
            className="start"
            onClick={() => onStartFinale()}
            disabled={connection !== 'online'}
          >
            {copy.backbone.startFinale}
          </button>
        )}

        {/* Pera o Kahon finale controls (Ticket 05) */}
        {state.finale !== null && (
          <div className="finale-panel">
            <h3>{copy.backbone.finaleHeading}</h3>
            {hasPlaceholderPrizes() && <p className="warning">{copy.backbone.placeholderWarning}</p>}
            <p className="finalist-callout">
              {copy.backbone.finalistHeading}:{' '}
              <strong>{state.roster.find((p) => p.id === state.bracket?.finalistId)?.name}</strong>
            </p>

            {state.finale.choice === null && (
              <div className="finale-choices">
                {onChoosePera && (
                  <button
                    type="button"
                    className="start"
                    onClick={onChoosePera}
                    disabled={connection !== 'online'}
                  >
                    {copy.backbone.choosePeraOnBehalf}
                  </button>
                )}
                {onChooseKahon && (
                  <button
                    type="button"
                    className="start"
                    onClick={() => onChooseKahon()}
                    disabled={connection !== 'online'}
                  >
                    {copy.backbone.chooseKahonOnBehalf}
                  </button>
                )}
              </div>
            )}

            {state.finale.choice === 'pera' && (
              <p className="outcome">
                {copy.backbone.peraWon(Pera.label, peso(Pera.value))}
              </p>
            )}

            {state.finale.choice === 'kahon' && state.finale.drawnPrizeId && (() => {
              const prize = findPrize(state.finale.drawnPrizeId);
              if (!prize) return null;
              return (
                <div className="kahon-drawn-details">
                  <p className="drawn-prize">
                    {copy.backbone.drawnPrizeReady(prize.label, peso(prize.value))}
                  </p>
                  {!state.finale.revealed && onRevealKahon && (
                    <button
                      type="button"
                      className="start reveal"
                      onClick={onRevealKahon}
                      disabled={connection !== 'online'}
                    >
                      {copy.backbone.revealKahon}
                    </button>
                  )}
                  {state.finale.revealed && (
                    <p className="outcome">
                      {prize.id === Bokya.id
                        ? copy.backbone.bokyaResult
                        : copy.backbone.wonResult(prize.label, peso(prize.value))}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {question === null && state.phase !== 'joining' && state.finale === null && <p className="note">{copy.backbone.nothingPresented}</p>}

        {state.phase === 'answering' && (
          <p className="countdown" role="timer">
            {copy.backbone.countdown(seconds)}
          </p>
        )}

        {state.phase === 'answering' && question !== null && eligiblePlayers.length > 0 && onSubmitAnswerOnBehalf && (
          <div className="submit-on-behalf">
            <h3>{copy.backbone.submitOnBehalfHeading}</h3>
            <div className="submit-on-behalf-controls">
              <label>
                <span className="label">{copy.backbone.submitOnBehalfPlayerLabel}: </span>
                <select
                  aria-label={copy.backbone.submitOnBehalfPlayerLabel}
                  value={selectedBehalfPlayerId}
                  onChange={(e) => setBehalfPlayerId(e.target.value)}
                  disabled={connection !== 'online'}
                >
                  {eligiblePlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {!p.connected ? `(${copy.backbone.connection.offline})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="label">{copy.backbone.submitOnBehalfOptionLabel}: </span>
                <select
                  aria-label={copy.backbone.submitOnBehalfOptionLabel}
                  value={selectedBehalfOptionId}
                  onChange={(e) => setBehalfOptionId(e.target.value)}
                  disabled={connection !== 'online'}
                >
                  {question.options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="ghost ghost--small"
                disabled={connection !== 'online'}
                onClick={() => {
                  if (selectedBehalfPlayerId && selectedBehalfOptionId) {
                    onSubmitAnswerOnBehalf(selectedBehalfPlayerId, selectedBehalfOptionId);
                  }
                }}
              >
                {copy.backbone.submitOnBehalfButton}
              </button>
            </div>
          </div>
        )}

        {state.phase === 'revealPending' && <p className="countdown is-closed">{copy.backbone.windowClosed}</p>}

        {state.phase === 'revealPending' && (
          <button
            type="button"
            className="start reveal"
            onClick={onReveal}
            disabled={connection !== 'online'}
          >
            {copy.backbone.reveal}
          </button>
        )}

        {/* The cull's own numbers, on the Presenter's screen, at all times. */}
        <p className="survivors">
          <span className="label">{copy.backbone.survivorsHeading}</span>
          {copy.backbone.survivors(alive)}
        </p>

        {/* A cull that finished with nobody in it is not a cull that produced a
            bracket. Whether that state should be reachable is ticket 04's call;
            saying "these are the ones for the bracket" when the list is empty is
            simply untrue, and the Presenter is the one who has to act on it. */}
        {state.bracket === null && (
          <>
            {over !== null && alive === 0 ? (
              <p className="warning">{copy.backbone.cullEmpty}</p>
            ) : (
              <>
                {over === 'cullComplete' && <p className="note">{copy.backbone.cullComplete}</p>}
                {over === 'queueEmpty' && <p className="warning">{copy.backbone.queueSpent}</p>}
              </>
            )}
            {cullLowOnQuestions(state) && (
              <p className="warning">{copy.backbone.queueLow(questionsLeft(state))}</p>
            )}
          </>
        )}

        {presenter && (
          <div className="answer-key">
            <p className="answer">
              <span className="label">{copy.backbone.answerHeading}</span>
              {presenter.answer}
            </p>
            <p className="cue">
              <span className="label">{copy.backbone.cueHeading}</span>
              {presenter.cue}
            </p>
          </div>
        )}

        {state.answer && (
          <p className="submitted">
            {state.answer.submissions.length === 0
              ? copy.backbone.submittedNone
              : copy.backbone.submitted(state.answer.submissions.length)}
          </p>
        )}
      </section>

      {/* The Deck safety net & presentation (ticket 07) */}
      <section className="panel deck-panel">
        <h2>{copy.backbone.deckHeading}</h2>

        {!state.deck?.active ? (
          <div className="deck-closed-controls">
            <button
              type="button"
              className="ghost ghost--deck-open"
              onClick={() => onOpenDeck?.()}
              disabled={connection !== 'online'}
            >
              {copy.backbone.openDeck}
            </button>
            <p className="note">{copy.backbone.deckSafetyNetNote}</p>
          </div>
        ) : (() => {
          const slideIndex = state.deck?.slideIndex ?? 0;
          return (
            <div className="deck-active-controls">
              <p className="badge is-active-deck">{copy.backbone.deckActiveBadge}</p>
              <div className="deck-slide-info">
                <span className="deck-slide-number">
                  {copy.backbone.slideNumber(slideIndex + 1, deckSlides.length)}
                </span>
                <strong className="deck-slide-title">
                  {deckSlides[slideIndex]?.title}
                </strong>
              </div>

              <div className="deck-nav-buttons">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onPrevDeckSlide?.()}
                  disabled={connection !== 'online' || slideIndex <= 0}
                >
                  {copy.backbone.prevSlide}
                </button>

                <button
                  type="button"
                  className="ghost"
                  onClick={() => onNextDeckSlide?.()}
                  disabled={connection !== 'online' || slideIndex >= deckSlides.length - 1}
                >
                  {copy.backbone.nextSlide}
                </button>

                <label className="deck-jump-label">
                  <span className="label">{copy.backbone.jumpSlide}:</span>
                  <select
                    aria-label={copy.backbone.jumpSlide}
                    className="deck-jump-select"
                    value={slideIndex}
                    onChange={(e) => onSetDeckSlide?.(Number(e.target.value))}
                    disabled={connection !== 'online'}
                  >
                    {deckSlides.map((slide, idx) => (
                      <option key={slide.id} value={idx}>
                        {idx + 1}. {slide.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="deck-exit-row">
                <button
                  type="button"
                  className="start"
                  onClick={() => onCloseDeck?.()}
                  disabled={connection !== 'online'}
                >
                  {copy.backbone.closeDeck}
                </button>
              </div>
            </div>
          );
        })()}
      </section>

      {/* The rehearsal room. Seeded, never connected — see ticket 03's Comments. */}
      <section className="panel">
        <h2>
          {copy.backbone.simHeading} <span className="count">{seeded}</span>
        </h2>

        {state.phase !== 'joining' && <p className="note">{copy.backbone.simLocked}</p>}

        <div className="sim-controls">
          {[5, 11, 20].map((count) => (
            <button
              key={count}
              type="button"
              className="ghost"
              disabled={connection !== 'online' || state.phase !== 'joining'}
              onClick={() => onSimulate(count)}
            >
              {copy.backbone.simulate(count)}
            </button>
          ))}
          <button
            type="button"
            className="ghost"
            disabled={connection !== 'online' || state.phase !== 'joining'}
            onClick={onClearSimulated}
          >
            {copy.backbone.clearSimulated}
          </button>
        </div>

        <p className="label">{copy.backbone.simModeHeading}</p>
        <div className="sim-controls">
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`ghost${state.simulation.mode === mode ? ' is-on' : ''}`}
              disabled={connection !== 'online'}
              onClick={() => onSetSimulation(state.simulation.armed, mode)}
            >
              {copy.backbone.simMode[mode]}
            </button>
          ))}
        </div>

        <div className="sim-controls">
          <button
            type="button"
            className={`ghost${state.simulation.armed ? ' is-on' : ''}`}
            disabled={connection !== 'online'}
            onClick={() => onSetSimulation(!state.simulation.armed, state.simulation.mode)}
          >
            {state.simulation.armed ? copy.backbone.simStop : copy.backbone.simArm}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={connection !== 'online' || state.phase !== 'answering'}
            onClick={onSimulateAnswers}
          >
            {copy.backbone.simNow}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>
          {copy.backbone.rosterHeading} <span className="count">{copy.backbone.rosterCount(state.roster.length)}</span>
        </h2>
        {full && <p className="warning">{copy.backbone.rosterFull}</p>}
        {state.roster.length === 0 ? (
          <p className="empty">{copy.backbone.rosterEmpty}</p>
        ) : (
          <ul className="roster">
            {state.roster.map((player) => (
              <li
                key={player.id}
                className={[
                  player.connected ? 'is-online' : 'is-offline',
                  player.standing === 'out' ? 'is-out' : '',
                  player.simulated ? 'is-simulated' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="roster__name">
                  {player.name}
                  {player.simulated && <span className="badge">{copy.backbone.simulatedBadge}</span>}
                </span>
                {player.standing === 'out' && onReverseElimination && (
                  reversingPlayerId === player.id ? (
                    <span className="reversal-confirm">
                      <button
                        type="button"
                        className="ghost ghost--confirm"
                        onClick={() => {
                          onReverseElimination(player.id);
                          setReversingPlayerId(null);
                        }}
                      >
                        {copy.backbone.confirmReverse}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setReversingPlayerId(null)}
                      >
                        {copy.backbone.cancelReverse}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="ghost ghost--small"
                      onClick={() => setReversingPlayerId(player.id)}
                    >
                      {copy.backbone.reverseElimination}
                    </button>
                  )
                )}
                <span
                  role="img"
                  className="roster__dot"
                  aria-label={player.connected ? copy.backbone.connection.online : copy.backbone.connection.offline}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer>
        <button type="button" className="mute" onClick={sound.toggleMute}>
          {sound.muted ? copy.backbone.unmute : copy.backbone.mute}
        </button>
        {sound.muted && <span className="note">{copy.backbone.muted}</span>}
        {sound.file !== null && <p className="warning">{copy.backbone.audioMissing(sound.file)}</p>}
        {state.phase === 'started' && <p className="started">{copy.backbone.showStarted}</p>}
      </footer>
    </main>
  );
}