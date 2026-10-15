import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { DEV_CLIENT_PORT, SERVER_PORT } from './src/server/config.ts';

export default defineConfig({
  plugins: [react()],
  server: {
    // ADR-0002: a phone on the hotspot cannot reach loopback, so the dev server
    // has to be in host mode. Set here rather than on the command line so it
    // cannot be forgotten.
    host: true,
    // Pinned, and strict, because the console prints this port as the join
    // link: a dev server that quietly moved to 5174 would leave the presenter
    // typing an address nothing answers. Failing loudly is the better failure.
    port: DEV_CLIENT_PORT,
    strictPort: true,
    proxy: {
      '/ws': { target: `ws://127.0.0.1:${SERVER_PORT}`, ws: true },
    },
  },
  test: {
    environment: 'node',
  },
});