import { useState, type FormEvent } from 'react';
import { copy, showConfig } from '../content/show.ts';
import type { GameState, Player as RosterPlayer } from '../game/machine.ts';
import type { Connection } from './useShow.ts';

/** A Player's phone: a name, and confirmation that they are in. Nothing more. */
export function Player({
  state,
  me,
  refusal,
  complaint,
  connection,
  onJoin,
}: {
  state: GameState;
  me: RosterPlayer | null;
  refusal: string | null;
  complaint: string | null;
  connection: Connection;
  onJoin: (name: string) => void;
}) {
  const [name, setName] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onJoin(name);
  };

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

      {me && <p className="waiting">{copy.player.waitingForShow}</p>}
    </main>
  );
}