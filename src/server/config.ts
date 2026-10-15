// Ports and paths the server needs. SERVER_PORT is exported because the Vite
// dev server proxies /ws to it (see vite.config.ts).
export const SERVER_PORT = Number(process.env.PORT ?? 8787);

export const DEFAULT_LOG_PATH = 'data/event-log.json';