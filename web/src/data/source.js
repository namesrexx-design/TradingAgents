/*
 * TradingAgents web dashboard: where runs come from.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * With the bridge running (web/bridge/server.py, proxied at /api by Vite), runs
 * come from the real results directory. Without it, the bundled SAMPLE runs in
 * public/sample are used. API keys never reach this code: the bridge only says
 * whether one is configured on the server.
 */
import { fromReportTree, fromStateLog } from './adapter.js';

const BASE = import.meta.env.BASE_URL;
const url = (rel) => (rel.startsWith('/') ? rel : `${BASE}${rel}`);

async function getJson(path, { timeout = 2500 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url(path), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
    if (!(res.headers.get('content-type') || '').includes('json')) throw new Error(`Not JSON: ${path}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** { ok, provider, keyConfigured } from the bridge, or null when it is not running. */
export async function probeBridge() {
  try {
    const h = await getJson('/api/health', { timeout: 1500 });
    if (h && h.ok === true) return { ok: true, provider: h.provider || null, keyConfigured: Boolean(h.key_configured) };
  } catch {
    /* no bridge: preview mode */
  }
  return null;
}

/** Run index entries, from the bridge or the bundled sample. */
export async function listRuns(bridge) {
  if (bridge) {
    const data = await getJson('/api/runs');
    return { sample: false, runs: data.runs || [] };
  }
  const data = await getJson('sample/index.json');
  return { sample: true, runs: data.runs || [] };
}

/** Load one run. `prefer` picks the state log JSON or the markdown report tree. */
export async function loadRun(entry, { sample, prefer = 'state_log' } = {}) {
  const meta = { isSample: sample };
  if (prefer === 'state_log' && entry.state_log) {
    const json = await getJson(entry.state_log);
    return fromStateLog(json, { ...meta, path: entry.state_log });
  }
  if (entry.report_dir && entry.report_files?.length) {
    const files = {};
    await Promise.all(entry.report_files.map(async (f) => {
      const res = await fetch(url(`${entry.report_dir}/${f}`));
      if (res.ok) files[f] = await res.text();
    }));
    return fromReportTree(files, { ...meta, path: entry.report_dir, ticker: entry.ticker, tradeDate: entry.trade_date });
  }
  const json = await getJson(entry.state_log);
  return fromStateLog(json, { ...meta, path: entry.state_log });
}

/** Ask the bridge to start a run. Only reachable when the bridge reports a key. */
export async function startRun({ ticker, tradeDate, analysts, depth }) {
  const res = await fetch('/api/live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, trade_date: tradeDate, analysts, research_depth: depth }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Bridge refused the run (${res.status})`);
  return body.run_id;
}

/** Subscribe to a live run's events. Returns an unsubscribe function. */
export function subscribeRun(runId, onEvent) {
  const es = new EventSource(`/api/live/${encodeURIComponent(runId)}/events`);
  es.onmessage = (m) => {
    try { onEvent(JSON.parse(m.data)); } catch { /* ignore malformed line */ }
  };
  es.onerror = () => { es.close(); };
  return () => es.close();
}
