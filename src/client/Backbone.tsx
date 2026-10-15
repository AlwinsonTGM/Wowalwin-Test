import { copy, forPresenter, showConfig } from '../content/show.ts';
import type { ShownState } from '../game/machine.ts';
import { useSecondsLeft } from './clock.ts';
import { useShowSound } from './useShowSound.ts';
import type { Connection } from './useShow.ts';

/** The Presenter's laptop: the whole roster, the controls, and what the room sees. */
export function Backbone({
  state,
  joinUrl,
  connection,
  onStartShow,
  onPresentQuestion,
  onReveal,
}: {
  state: ShownState;
  joinUrl: string | null | undefined;
  connection: Connection;
  onStartShow: () => void;
  onPresentQuestion: () => void;
  onReveal: () => void;
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

  return (
    <main className="surface surface--backbone">
      <header>
        <h1>{copy.backbone.title}</h1>
        <p className={`status status--${connection}`}>{copy.backbone.status[connection]}</p>
      </header>

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
        {(state.phase === 'started' || state.phase === 'revealed') && (
          <button
            type="button"
            className="start"
            onClick={onPresentQuestion}
            disabled={connection !== 'online'}
          >
            {copy.backbone.presentQuestion}
          </button>
        )}

        {question === null && state.phase !== 'joining' && <p className="note">{copy.backbone.nothingPresented}</p>}

        {state.phase === 'answering' && (
          <p className="countdown" role="timer">
            {copy.backbone.countdown(seconds)}
          </p>
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
              <li key={player.id} className={player.connected ? 'is-online' : 'is-offline'}>
                <span className="roster__name">{player.name}</span>
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