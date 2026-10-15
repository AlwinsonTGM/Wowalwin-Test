import { showConfig } from '../content/show.ts';

export type Surface = 'stage' | 'player' | 'backbone';

/**
 * Which surface this browser is. A trailing slash is forgiven on purpose: a
 * phone that opens `/play/` — typed by hand, or added by whatever sent the
 * link — has to get the Player page. Falling through to the Backbone would
 * hand a Player a "Simulan ang show" button and the Presenter a mysteriously
 * ended show.
 */
export function surfaceFor(pathname: string): Surface {
  const path = pathname.replace(/\/+$/, '');

  if (path === showConfig.stagePath) return 'stage';
  if (path === showConfig.playerPath) return 'player';
  return 'backbone';
}