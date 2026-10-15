import { copy } from '../content/show.ts';
import { activeBout, type ShownState } from '../game/machine.ts';
import { useSecondsLeft } from './clock.ts';

/** The projector: everything the room sees, and nothing else. */
export function Stage({ state, joinUrl }: { state: ShownState; joinUrl: string | null | undefined }) {
  // `?? null` rather than `=== null` below: the join screen is the Stage's
  // floor, and nothing about "no question" should be able to fall through to
  // rendering one.
  const question = state.question ?? null;
  const seconds = useSecondsLeft(question && state.phase === 'answering' ? question.askedAt : null);
  // Before the reveal every name is still in, so nothing on the grid is marked.
  // After it, the one event that reveals the answer moved them all at once.
  const flipped = state.phase === 'revealed';

  const isBout = state.bracket !== null;
  const currentBout = activeBout(state);
  const isBoutTied = isBout && state.phase === 'revealed' && currentBout?.winnerId === null && state.answer !== null;
  const boutWinner = isBout && currentBout?.winnerId
    ? state.roster.find((p) => p.id === currentBout.winnerId)
    : null;

  return (
    <main className="surface surface--stage">
      <h1>{copy.stage.title}</h1>

      {question !== null && (
        <section className="question">
          {isBout && currentBout ? (
            <div className="bout-meta">
              <p className="bout-round">{copy.stage.boutHeading(copy.stage.rounds[currentBout.round])}</p>
              <p className="bout-fighters">
                <span className="fighter">
                  {state.roster.find((p) => p.id === currentBout.player1Id)?.name ?? '—'}
                </span>{' '}
                <span className="vs">{copy.stage.vs}</span>{' '}
                <span className="fighter">
                  {state.roster.find((p) => p.id === currentBout.player2Id)?.name ?? '—'}
                </span>
              </p>
            </div>
          ) : (
            <p className="question-number">{copy.stage.questionNumber(state.asked.length)}</p>
          )}

          <h2 className="prompt">{question.prompt}</h2>

          <ul className="options">
            {question.options.map((option) => {
              // Ticket 04: The correct answer is visible on the Backbone only, and never on the Stage
              const correct = !isBout && state.answer?.optionId === option.id;
              return (
                <li key={option.id} className={correct ? 'is-correct' : undefined}>
                  {option.label}
                </li>
              );
            })}
          </ul>

          {state.answer === null && state.phase === 'answering' && (
            <p className="question-timer" role="timer">
              {copy.stage.secondsLeft(seconds)}
            </p>
          )}
          {state.answer === null && state.phase === 'revealPending' && (
            <p className="question-timer">{copy.stage.waiting}</p>
          )}

          {state.answer !== null && (
            isBout ? (
              boutWinner ? (
                <p className="winner-callout">{copy.stage.winner(boutWinner.name)}</p>
              ) : isBoutTied ? (
                <p className="winner-callout warning">{copy.stage.tieNoSubmissions}</p>
              ) : null
            ) : (
              <p className="answer">{copy.stage.answerHeading}</p>
            )
          )}
        </section>
      )}

      {question === null && joinUrl !== undefined && !isBout && (
        <section className="join">
          <h2>{copy.stage.joinHeading}</h2>
          {joinUrl ? (
            <>
              <p className="join-url">{joinUrl}</p>
              <p className="instruction">{copy.stage.joinInstruction}</p>
              <p className="instruction">{copy.common.firewallNote}</p>
            </>
          ) : (
            <p className="warning">{copy.common.noAddress}</p>
          )}
        </section>
      )}

      {/* When bracket is active, show the surviving bracket throughout */}
      {isBout && state.bracket ? (
        <section className="bracket-view">
          <h2>{copy.stage.bracketHeading}</h2>
          {state.bracket.finalistId && (
            <p className="finalist-callout">
              {copy.stage.finalist(state.roster.find((p) => p.id === state.bracket!.finalistId)?.name ?? '')}
            </p>
          )}
          <div className="bracket-tree">
            {(['quarter', 'semi', 'final'] as const).map((round) => {
              const boutsInRound = state.bracket!.bouts.filter((b) => b.round === round);
              return (
                <div key={round} className={`bracket-col bracket-col--${round}`}>
                  <h3>{copy.stage.rounds[round]}</h3>
                  <ul className="bout-cards">
                    {boutsInRound.map((bout) => {
                      const p1 = state.roster.find((p) => p.id === bout.player1Id);
                      const p2 = state.roster.find((p) => p.id === bout.player2Id);
                      const active = bout.id === state.bracket!.currentBoutId;
                      return (
                        <li key={bout.id} className={`bout-card${active ? ' is-active' : ''}`}>
                          <span
                            className={[
                              'bout-name',
                              bout.winnerId === p1?.id ? 'is-winner' : '',
                              p1?.standing === 'out' ? 'is-out' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {p1?.name ?? '—'}
                          </span>
                          <span className="bout-vs">{copy.stage.vs}</span>
                          <span
                            className={[
                              'bout-name',
                              bout.winnerId === p2?.id ? 'is-winner' : '',
                              p2?.standing === 'out' ? 'is-out' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {p2?.name ?? '—'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="grid">
          <h2>
            {copy.stage.rosterHeading} <span className="count">{copy.stage.rosterCount(state.roster.length)}</span>
          </h2>
          {state.roster.length === 0 ? (
            <p className="empty">{copy.stage.rosterEmpty}</p>
          ) : (
            <ul className="names">
              {state.roster.map((player) => (
                <li
                  key={player.id}
                  className={flipped ? (player.standing === 'in' ? 'is-in' : 'is-out') : undefined}
                >
                  <span className="name">{player.name}</span>
                  {flipped && (
                    <span className="standing">
                      {player.standing === 'in' ? copy.stage.survived : copy.stage.eliminated}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}