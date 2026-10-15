/** Everything that can happen to the show, as data. */
export type GameEvent =
  | { type: 'playerJoined'; playerId: string; name: string }
  | { type: 'playerDisconnected'; playerId: string }
  | { type: 'playerReconnected'; playerId: string }
  | { type: 'showStarted' };