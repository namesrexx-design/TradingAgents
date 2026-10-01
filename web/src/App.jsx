/*
 * TradingAgents web dashboard: shell, routing and data loading.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * Research tool. Not financial advice. No orders are placed: there is no broker
 * integration anywhere in this app, and nothing in it can send an order.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listRuns, loadRun, probeBridge } from './data/source.js';
import Setup from './screens/Setup.jsx';
import Live from './screens/Live.jsx';
import Report from './screens/Report.jsx';
import Runs from './screens/Runs.jsx';

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'setup', parts: parts.slice(1), query: new URLSearchParams(query) };
}

const NAV = [
  { name: 'setup', label: 'Setup', href: '#/setup' },
  { name: 'live', label: 'Live run', href: '#/live' },
  { name: 'report', label: 'Report', href: '#/report' },
  { name: 'runs', label: 'Past runs', href: '#/runs' },
];

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [bridge, setBridge] = useState(undefined); // undefined = probing, null = none
  const [index, setIndex] = useState(null);
  const [indexError, setIndexError] = useState(null);
  const [cache, setCache] = useState({});

  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const b = await probeBridge();
      if (!live) return;
      setBridge(b);
      try {
        const idx = await listRuns(b);
        if (live) setIndex(idx);
      } catch (e) {
        if (live) setIndexError(String(e.message || e));
      }
    })();
    return () => { live = false; };
  }, []);

  const getRun = useCallback(async (entry, prefer = 'state_log') => {
    const key = `${entry.ticker}/${entry.trade_date}/${prefer}`;
    if (cache[key]) return cache[key];
    const run = await loadRun(entry, { sample: index?.sample, prefer });
    setCache((c) => ({ ...c, [key]: run }));
    return run;
  }, [cache, index]);

  // After a live run finishes, its state log is new on disk: list again.
  const refreshIndex = useCallback(async () => {
    try { setIndex(await listRuns(bridge)); } catch (e) { setIndexError(String(e.message || e)); }
  }, [bridge]);

  const ctx = useMemo(() => ({ bridge, index, indexError, getRun, refreshIndex }),
    [bridge, index, indexError, getRun, refreshIndex]);

  let screen;
  if (route.name === 'live') screen = <Live ctx={ctx} liveId={route.parts[0]} />;
  else if (route.name === 'report') screen = <Report ctx={ctx} ticker={route.parts[0]} date={route.parts[1]} source={route.query.get('source')} />;
  else if (route.name === 'runs') screen = <Runs ctx={ctx} />;
  else screen = <Setup ctx={ctx} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="wordmark" href="#/setup">
            TradingAgents <span className="wordmark-sub">research desk</span>
          </a>
          <nav className="nav" aria-label="Screens">
            {NAV.map((n) => (
              <a key={n.name} href={n.href} className={`nav-link ${route.name === n.name ? 'is-active' : ''}`}
                aria-current={route.name === n.name ? 'page' : undefined}>{n.label}</a>
            ))}
          </nav>
          <span className="mode-pill" title={bridge ? 'Connected to the local bridge' : 'No bridge: showing bundled SAMPLE data'}>
            {bridge === undefined ? 'Checking…' : bridge ? 'Bridge connected' : 'Preview · sample data'}
          </span>
        </div>
      </header>
      <div className="guardrail" role="note">
        <div className="guardrail-inner">
          <strong>Research tool. Not financial advice. No orders are placed.</strong>
          <span>Paper and backtest use only. There is no broker connection.</span>
        </div>
      </div>
      <main className="main">{screen}</main>
      <footer className="footer">
        <div className="footer-inner">
          <p>
            Built on <a href="https://github.com/TauricResearch/TradingAgents">TradingAgents</a> by Tauric Research,
            licensed under Apache-2.0. Modified by BizBox: added web dashboard.
          </p>
          <p className="muted">
            Ratings are research opinions written by language models. They are not recommendations to buy or sell
            anything, and this app cannot place, route or simulate orders with any broker.
          </p>
        </div>
      </footer>
    </div>
  );
}
