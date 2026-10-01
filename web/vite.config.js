/*
 * TradingAgents web dashboard: Vite config.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
// The bridge (web/bridge/server.py) listens here; keys stay on that side.
const BRIDGE = process.env.TRADINGAGENTS_BRIDGE_URL || 'http://127.0.0.1:8765';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // tokens.css is imported from the design export at docs/design/refero/wealthsimple.
    fs: { allow: [here, path.resolve(here, '../docs/design/refero/wealthsimple')] },
    proxy: { '/api': { target: BRIDGE, changeOrigin: false } },
  },
  preview: {
    proxy: { '/api': { target: BRIDGE, changeOrigin: false } },
  },
});
