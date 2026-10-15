import { resolve } from 'node:path';

// Paths are resolved against the repository, not the working directory, so a
// server started from anywhere finds the same build and the same event log.
const ROOT = resolve(import.meta.dirname, '../..');

// Ports and paths the server needs. SERVER_PORT is exported because the Vite
// dev server proxies /ws to it (see vite.config.ts).
export const SERVER_PORT = Number(process.env.PORT ?? 8787);

/** The port Vite serves the client on, pinned so the console cannot print a
 *  link to a port nothing is listening on (see vite.config.ts). */
export const DEV_CLIENT_PORT = 5173;

/** Where `npm run build` puts the client. The server serves it when it is
 *  there, and serves nothing at all when it is not — which is why `npm run dev`
 *  has to say so (see index.ts). */
export const CLIENT_DIR = resolve(ROOT, 'dist');

export const DEFAULT_LOG_PATH = resolve(ROOT, 'data/event-log.json');

/**
 * A rehearsal writes here instead, never there (ticket 03). Separate files are
 * the whole point: `npm run resume` on the day cannot read a seeded roster,
 * because it is not in the file it opens. Nothing has to be remembered for that
 * to hold — the filesystem prevents it.
 */
export const REHEARSAL_LOG_PATH = resolve(ROOT, 'data/rehearsal-log.json');

/**
 * Which log a run is about, decided before anything touches the disk. The wipe
 * and the run have to be asking this question once: if they could answer it
 * differently, `npm run rehearse --fresh` would wipe the real show's roster.
 */
export const logPathFor = (argv: readonly string[]): string =>
  argv.includes('--rehearse') ? REHEARSAL_LOG_PATH : DEFAULT_LOG_PATH;