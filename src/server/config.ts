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