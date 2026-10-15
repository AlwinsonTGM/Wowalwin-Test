import { rmSync } from 'node:fs';
import { startShowServer } from './show-server.ts';
import { DEFAULT_LOG_PATH, DEV_CLIENT_PORT, SERVER_PORT } from './config.ts';
import { copy, showConfig } from '../content/show.ts';

const fresh = process.argv.includes('--fresh');
const dev = process.argv.includes('--dev');

if (fresh) rmSync(DEFAULT_LOG_PATH, { force: true });

const show = await startShowServer({ port: SERVER_PORT });

// In dev the client is served by Vite, not by us, and until someone has built
// there is nothing on our port to answer. Printing the port the client is
// actually served on is the difference between a link that works and a 404 the
// presenter debugs as a broken app (ADR-0002).
const clientPort = dev ? DEV_CLIENT_PORT : show.port;

console.log(`${copy.showTitle} — ${copy.segment}`);
console.log(`Backbone: http://localhost:${clientPort}${showConfig.backbonePath}`);
console.log(`Stage:    http://localhost:${clientPort}${showConfig.stagePath}`);
console.log(`Players:  http://${show.joinHost ?? '??'}:${clientPort}${showConfig.playerPath}`);
if (!show.joinHost) console.warn(copy.common.noAddress);
console.log(copy.common.firewallNote);