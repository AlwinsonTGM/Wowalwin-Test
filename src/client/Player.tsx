import { useState, type FormEvent } from 'react';
import { copy, showConfig } from '../content/show.ts';
import { activeBout, isPlayerInCurrentBout, type Player as RosterPlayer, type ShownState } from '../game/machine.ts';
import type { Connection } from './useShow.ts';
import { useSecondsLeft } from './clock.ts';

/** A Player's phone: a name, and an answer. It never grades, never shows who
 *  was first, and never reveals — so nothing here reads `state.answer`. */
export function Player({
  state,
  me,
  refusal,
  complaint,
  connection,
  answerNote,
  onJoin,
  onSubmitAnswer,
}: {
  state: ShownState;
  me: RosterPlayer | null;
  refusal: string | null;
  complaint: string | null;
  connection: Connection;
  answerNote: string | null;
  onJoin: (name: string) => void;
  onSubmitAnswer: (optionId: string) => void;
}) {
  const [name, setName] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onJoin(name);
  };

  const isBout = Boolean(state.bracket);
  const currentBout = isBout ? activeBout(state) : null;
  const inBout = me !== null && isBout && isPlayerInCurrentBout(state, me.id);
  const isWaitingInBracket = me !== null && isBout && me.standing === 'in' && !inBout;
  const isEntrant = isBout && me !== null && (state.bracket?.bouts.some((b) => b.player1Id === me.id || b.player2Id === me.id) ?? false);
  const lostBout = isBout && me !== null && me.standing === 'out' && isEntrant;
  const isFinalist = isBout && me !== null && state.bracket?.finalistId === me.id;
  const wonBout = inBout && state.phase === 'revealed' && currentBout?.winnerId === me?.id;
  const tiedBout = inBout && state.phase === 'revealed' && currentBout?.winnerId === null && state.answer !== null;

  const question = state.question ?? null;
  const open = state.phase === 'answering';
  const seconds = useSecondsLeft(open && question ? question.askedAt : null);
  const playing = me !== null && me.standing === 'in' && (!isBout || inBout);
  const showQuestion = question !== null && (isBout ? inBout : (me !== null || refusal !== null));

  return (
    <main className="surface surface--player">
      <h1>{copy.player.title}</h1>
      <p className="count">{copy.player.joinedCount(state.roster.length)}</p>

      {connection !== 'online' && <p className="reconnecting">{copy.player.reconnecting}</p>}

      {refusal ? (
        <p className="refused">{refusal}</p>
      ) : me ? (
        <p className="joined">{copy.player.joined(me.name)}</p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="name">{copy.player.prompt}</label>
          <input
            id="name"
            value={name}
            maxLength={showConfig.maxNameLength}
            placeholder={copy.player.namePlaceholder}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
          <button type="submit">{copy.player.joinButton}</button>
          {complaint && <p className="warning">{complaint}</p>}
        </form>
      )}

      {isWaitingInBracket && <p className="waiting">{copy.player.waitingForTurn}</p>}

      {lostBout && <p className="refused">{copy.player.boutLost}</p>}

      {me?.standing === 'out' && !lostBout && <p className="refused">{copy.player.eliminated}</p>}

      {isFinalist && <p className="won">{copy.stage.finalist(me.name)}</p>}

      {wonBout && !isFinalist && <p className="won">{copy.player.boutWon}</p>}

      {tiedBout && <p className="warning">{copy.stage.tieNoSubmissions}</p>}

      {showQuestion && (
        <section className="question">
          <h2 className="prompt">{question.prompt}</h2>
          {playing && (
            <p className="question-timer" role="timer">
              {copy.player.secondsLeft(seconds)}
            </p>
          )}
          <ul className="options">
            {question.options.map((option) => (
              <li key={option.id}>
                {playing ? (
                  <button type="button" disabled={!open} onClick={() => onSubmitAnswer(option.id)}>
                    {option.label}
                  </button>
                ) : (
                  option.label
                )}
              </li>
            ))}
          </ul>
          <p className="answer-note">
            {playing ? (answerNote ?? (open ? copy.player.chooseAnswer : copy.player.windowClosed)) : null}
          </p>
        </section>
      )}

      {me && question === null && !isBout && state.phase === 'joining' && (
        <p className="waiting">{copy.player.waitingForShow}</p>
      )}
    </main>
  );
}