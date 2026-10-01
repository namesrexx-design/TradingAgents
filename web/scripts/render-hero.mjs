/*
 * TradingAgents web dashboard: render the hero sculpture to a still.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * Serves the repository root on a free local port, opens scripts/hero-scene.html
 * in Chromium (GPU through ANGLE/D3D11 where available), and writes:
 *   art/hero-ribbon[-detail].png          lossless masters (transparent)
 *   src/assets/hero-ribbon[-detail].webp  web derivatives (lossy, q=0.92, alpha kept)
 *
 *   npm run render:hero
 *
 * Needs Playwright. It is not a dependency of this app: install it, or point
 * PLAYWRIGHT_PACKAGE_JSON at a package.json whose node_modules has it.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..');
const repo = path.resolve(web, '..');

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const from = process.env.PLAYWRIGHT_PACKAGE_JSON;
    if (!from) throw new Error('Playwright not found. npm i -D playwright, or set PLAYWRIGHT_PACKAGE_JSON.');
    return createRequire(from)('playwright');
  }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.resolve(repo, '.' + rel);
  if (!file.startsWith(repo) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
try {
  for (const [view, suffix] of [['hero', ''], ['detail', '-detail']]) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
    page.on('pageerror', (e) => console.error('scene error:', e.message));
    await page.goto(`http://127.0.0.1:${port}/web/scripts/hero-scene.html?w=1400&h=1200&view=${view}`);
    await page.waitForFunction(() => window.__done === true, null, { timeout: 120000 });
    const { png, webp } = await page.evaluate(() => ({ png: window.__png, webp: window.__webp }));
    const write = (rel, dataUrl) => {
      const out = path.join(web, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log(`wrote ${rel} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
    };
    write(`art/hero-ribbon${suffix}.png`, png);
    write(`src/assets/hero-ribbon${suffix}.webp`, webp);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
