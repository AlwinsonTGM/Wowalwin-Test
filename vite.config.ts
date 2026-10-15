import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { SERVER_PORT } from './src/server/config.ts';

export default defineConfig({
  plugins: [react()],
  server: {
    // ADR-0002: a phone on the hotspot cannot reach loopback, so the dev server
    // has to be in host mode. Set here rather than on the command line so it
    // cannot be forgotten.
    host: true,
    proxy: {
      '/ws': { target: `ws://127.0.0.1:${SERVER_PORT}`, ws: true },
    },
  },
  test: {
    environment: 'node',
  },
});