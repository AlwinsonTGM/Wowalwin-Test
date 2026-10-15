/** Everything that can happen to the show, as data. */
export type GameEvent =
  | { type: 'playerJoined'; playerId: string; name: string }
  | { type: 'playerDisconnected'; playerId: string }
  | { type: 'playerReconnected'; playerId: string }
  | { type: 'showStarted' }
  /**
   * `at` is the adapter's clock, handed in rather than read: the machine never
   * reads one. A Backbone that reloads mid-question counts down from the same
   * number the server counted with, instead of starting the window over.
   */
  | { type: 'questionPresented'; questionId: string; at: number }
  | { type: 'answerSubmitted'; playerId: string; optionId: string }
  | { type: 'answerWindowClosed' }
  | { type: 'revealTriggered' };