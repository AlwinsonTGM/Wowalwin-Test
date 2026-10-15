import { rmSync } from 'node:fs';
import { startShowServer } from './show-server.ts';
import { DEFAULT_LOG_PATH, DEV_CLIENT_PORT, REHEARSAL_LOG_PATH, SERVER_PORT, logPathFor } from './config.ts';
import { copy, showConfig } from '../content/show.ts';

const fresh = process.argv.includes('--fresh');
const dev = process.argv.includes('--dev');
const rehearsal = process.argv.includes('--rehearse');

// Which log first, then wipe what that log is. Reversing these would let
// `npm run rehearse --fresh` delete the real show's roster on its way past —
// the exact accident the separate file exists to make impossible.
const logPath = logPathFor(process.argv);
if (fresh) rmSync(logPath, { force: true });

const show = await startShowServer({ port: SERVER_PORT, logPath });

// In dev the client is served by Vite, not by us, and until someone has built
// there is nothing on our port to answer. Printing the port the client is
// actually served on is the difference between a link that works and a 404 the
// presenter debugs as a broken app (ADR-0002).
const clientPort = dev ? DEV_CLIENT_PORT : show.port;

console.log(`${copy.showTitle} — ${copy.segment}`);
if (rehearsal) console.warn(copy.common.rehearsalWarning);
console.log(`Backbone: http://localhost:${clientPort}${showConfig.backbonePath}`);
console.log(`Stage:    http://localhost:${clientPort}${showConfig.stagePath}`);
console.log(`Players:  http://${show.joinHost ?? '??'}:${clientPort}${showConfig.playerPath}`);
console.log(`Log:      ${logPath === REHEARSAL_LOG_PATH ? copy.common.rehearsalLog : copy.common.showLog}`);
if (!show.joinHost) console.warn(copy.common.noAddress);
console.log(copy.common.firewallNote);