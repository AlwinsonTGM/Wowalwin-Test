import { copy } from '../content/show.ts';
import type { GameState } from '../game/machine.ts';

/** The projector: everything the room sees, and nothing else. */
export function Stage({ state, joinUrl }: { state: GameState; joinUrl: string | null | undefined }) {
  return (
    <main className="surface surface--stage">
      <h1>{copy.stage.title}</h1>

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
          {copy.stage.rosterHeading} <span className="count">{copy.stage.rosterCount(state.roster.length)}</span>
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
    </main>
  );
}