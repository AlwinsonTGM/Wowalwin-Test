import { copy } from '../content/show.ts';
import type { ShownState } from '../game/machine.ts';
import { useSecondsLeft } from './clock.ts';

/** The projector: everything the room sees, and nothing else. */
export function Stage({ state, joinUrl }: { state: ShownState; joinUrl: string | null | undefined }) {
  // `?? null` rather than `=== null` below: the join screen is the Stage's
  // floor, and nothing about "no question" should be able to fall through to
  // rendering one.
  const question = state.question ?? null;
  const seconds = useSecondsLeft(question && state.phase === 'answering' ? question.askedAt : null);

  return (
    <main className="surface surface--stage">
      <h1>{copy.stage.title}</h1>

      {question === null ? (
        <>
          <section className="join">
            <h2>{copy.stage.joinHeading}</h2>
            {joinUrl !== undefined &&
              (joinUrl ? (
                <>
                  <p className="join-url">{joinUrl}</p>
                  <p className="instruction">{copy.stage.joinInstruction}</p>
                  <p className="instruction">{copy.common.firewallNote}</p>
                </>
              ) : (
                <p className="warning">{copy.common.noAddress}</p>
              ))}
          </section>

          <section className="grid">
            <h2>
              {copy.stage.rosterHeading}{' '}
              <span className="count">{copy.stage.rosterCount(state.roster.length)}</span>
            </h2>
            {state.roster.length === 0 ? (
              <p className="empty">{copy.stage.rosterEmpty}</p>
            ) : (
              <ul className="names">
                {state.roster.map((player) => (
                  <li key={player.id}>{player.name}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section className="question">
          <p className="question-number">{copy.stage.questionNumber(state.asked.length)}</p>
          <h2 className="prompt">{question.prompt}</h2>

          <ul className="options">
            {question.options.map((option) => {
              const correct = state.answer?.optionId === option.id;
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
          {state.answer !== null && <p className="answer">{copy.stage.answerHeading}</p>}
        </section>
      )}
    </main>
  );
}