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
import { button, container, focusRing } from './components/recipes.js';

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'setup', parts: parts.slice(1), query: new URLSearchParams(query) };
}

const NAV = [
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
  // Top-row switcher: the bundled SAMPLE runs, or your results via the bridge.
  const [useSample, setUseSample] = useState(true);

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
      setUseSample(!b);
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
  const refreshIndex = useCallback(async (sample = useSample) => {
    try { setIndex(await listRuns(sample ? null : bridge)); setIndexError(null); } catch (e) { setIndexError(String(e.message || e)); }
  }, [bridge, useSample]);

  const chooseSource = (sample) => {
    if (sample === useSample || (!sample && !bridge)) return;
    setUseSample(sample);
    setCache({});
    setIndex(null);
    refreshIndex(sample);
  };

  const ctx = useMemo(() => ({ bridge, index, indexError, getRun, refreshIndex }),
    [bridge, index, indexError, getRun, refreshIndex]);

  let screen;
  if (route.name === 'live') screen = <Live ctx={ctx} liveId={route.parts[0]} />;
  else if (route.name === 'report') screen = <Report ctx={ctx} ticker={route.parts[0]} date={route.parts[1]} source={route.query.get('source')} />;
  else if (route.name === 'runs') screen = <Runs ctx={ctx} />;
  else screen = <Setup ctx={ctx} />;

  return (
    <div className="min-h-screen bg-paper-white font-the-future text-body leading-body tracking-body text-graphite-ink">
      {/* Top Navigation Bar: "Sits on Paper White. A thin row at the very top carries
          small 12–14px The Future text (segmented, left-aligned). Below it the main bar
          holds the wordmark (Graphite Ink, The Future 500), a horizontal nav of links
          (The Future 400, 16px), and on the right two pill buttons: an outlined pill and
          a filled pill. No drop shadow; a hairline Stone rule at the bottom of the bar." */}
      <header className="border-b border-stone bg-paper-white">
        <div className="border-b border-stone">
          <div className={`${container} flex flex-wrap items-center justify-between gap-x-24 gap-y-4 py-6 text-caption leading-caption`}>
            <div className="flex items-center gap-8" role="group" aria-label="Which runs to show">
              <button type="button" aria-pressed={useSample} onClick={() => chooseSource(true)}
                className={`cursor-pointer ${useSample ? 'font-medium text-graphite-ink' : 'text-pebble'} ${focusRing}`}>Sample runs</button>
              <span aria-hidden="true" className="text-stone">|</span>
              <button type="button" aria-pressed={!useSample} onClick={() => chooseSource(false)} disabled={!bridge}
                title={bridge ? 'Runs in your results directory' : 'Needs the local bridge server'}
                className={`cursor-pointer disabled:cursor-not-allowed ${!useSample ? 'font-medium text-graphite-ink' : 'text-pebble'} ${focusRing}`}>Your results</button>
            </div>
            <p role="note" className="text-graphite-ink">Research tool. Not financial advice. No orders are placed.</p>
          </div>
        </div>
        <div className={`${container} flex flex-wrap items-center gap-x-40 gap-y-12 py-16`}>
          <a href="#/setup" className={`font-the-future font-medium text-heading-sm leading-heading-sm text-graphite-ink no-underline ${focusRing}`}>TradingAgents</a>
          <nav aria-label="Screens" className="order-3 flex w-full gap-24 md:order-none md:w-auto md:gap-32">
            {NAV.map((n) => (
              <a key={n.name} href={n.href} aria-current={route.name === n.name ? 'page' : undefined}
                className={`border-b py-4 font-the-future font-normal text-body text-graphite-ink no-underline whitespace-nowrap ${route.name === n.name ? 'border-graphite-ink' : 'border-transparent hover:border-stone'} ${focusRing}`}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex gap-12">
            <span className="hidden sm:contents"><a className={`${button.outline} ${focusRing}`} href="#/live">Replay sample</a></span>
            <a className={`${button.primary} ${focusRing}`} href="#/setup">New run</a>
          </div>
        </div>
      </header>

      <main>{screen}</main>

      <footer className="border-t border-stone bg-paper-white">
        <div className={`${container} py-48 text-caption leading-caption`}>
          <p className="mb-8 max-w-[60em]">
            Built on <a className="underline" href="https://github.com/TauricResearch/TradingAgents">TradingAgents</a> by Tauric Research,
            licensed under Apache-2.0. Modified by BizBox: added web dashboard.
          </p>
          <p className="mb-8">Research tool. Not financial advice. Paper and backtest use only: there is no broker connection, and nothing here places, routes or simulates an order.</p>
          <p className="text-pebble">Ratings are research opinions written by language models. They are not recommendations to buy or sell anything.</p>
        </div>
      </footer>
    </div>
  );
}
