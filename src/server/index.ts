import { rmSync } from 'node:fs';
import { startShowServer } from './show-server.ts';
import { DEFAULT_LOG_PATH, SERVER_PORT } from './config.ts';
import { copy, showConfig } from '../content/show.ts';

const fresh = process.argv.includes('--fresh');

if (fresh) rmSync(DEFAULT_LOG_PATH, { force: true });

const show = await startShowServer({ port: SERVER_PORT });

console.log(`${copy.showTitle} — ${copy.segment}`);
console.log(`Backbone: http://localhost:${show.port}${showConfig.backbonePath}`);
console.log(`Stage:    http://localhost:${show.port}${showConfig.stagePath}`);
console.log(`Players:  http://${show.joinHost ?? '??'}:${show.port}${showConfig.playerPath}`);
if (!show.joinHost) console.warn(copy.common.noAddress);
console.log(copy.common.firewallNote);