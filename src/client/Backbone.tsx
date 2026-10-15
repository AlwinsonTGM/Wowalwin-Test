import { copy, showConfig } from '../content/show.ts';
import type { GameState } from '../game/machine.ts';
import type { Connection } from './useShow.ts';

/** The Presenter's laptop: the whole roster, the controls, and what the room sees. */
export function Backbone({
  state,
  joinUrl,
  connection,
  onStartShow,
}: {
  state: GameState;
  joinUrl: string | null | undefined;
  connection: Connection;
  onStartShow: () => void;
}) {
  const full = state.roster.length >= showConfig.playerCap;

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
        {state.phase === 'started' ? (
          <p className="started">{copy.backbone.showStarted}</p>
        ) : (
          <button type="button" className="start" onClick={onStartShow} disabled={connection !== 'online'}>
            {copy.backbone.startShow}
          </button>
        )}
      </footer>
    </main>
  );
}