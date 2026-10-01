/*
 * TradingAgents web dashboard: run setup.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * Mirrors the CLI's questions (cli/selections.py): ticker, analysis date,
 * analysts, research depth. Running needs the bridge and a provider key in the
 * server's .env; without them the Run button stays disabled and says why.
 */
import { useState } from 'react';
import { ANALYSTS } from '../data/adapter.js';
import { startRun } from '../data/source.js';
import { go } from '../router.js';
import { Eyebrow } from '../components/ui.jsx';

const DEPTHS = [
  { value: 1, label: 'Shallow', note: '1 debate round' },
  { value: 3, label: 'Medium', note: '3 debate rounds' },
  { value: 5, label: 'Deep', note: '5 debate rounds' },
];

const ANALYST_NOTES = {
  market: 'Price action and technical indicators',
  social: 'Headlines, StockTwits and Reddit mood',
  news: 'Company and macro news',
  fundamentals: 'Statements as filed, ratios',
};

const today = () => new Date().toISOString().slice(0, 10);
const TICKER_RE = /^[A-Za-z0-9.\-^=]{1,32}$/;

export default function Setup({ ctx }) {
  const { bridge } = ctx;
  const [ticker, setTicker] = useState('DEMO');
  const [date, setDate] = useState('2026-09-01');
  const [analysts, setAnalysts] = useState(ANALYSTS.map((a) => a.key));
  const [depth, setDepth] = useState(1);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggle = (key) => setAnalysts((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  const problems = [];
  if (!TICKER_RE.test(ticker.trim())) problems.push('Enter a ticker (letters, digits, . - ^ =).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push('Pick an analysis date.');
  else if (date > today()) problems.push('The analysis date cannot be in the future.');
  if (!analysts.length) problems.push('Pick at least one analyst.');

  const canRun = Boolean(bridge?.ok && bridge.keyConfigured) && !problems.length && !busy;
  let runNote;
  if (!bridge) runNote = 'Running needs the bridge server and an LLM API key. Start web/bridge/server.py with the key in the repository .env file (server-side only). Until then you can replay the sample.';
  else if (!bridge.keyConfigured) runNote = `The bridge is up, but no API key is configured for ${bridge.provider || 'the provider'} in the server's .env.`;
  else if (problems.length) runNote = problems[0];
  else runNote = 'Starts a research run on the local bridge. Results are written to your results directory. No orders are placed.';

  async function onRun(e) {
    e.preventDefault();
    if (!canRun) return;
    setBusy(true);
    setError(null);
    try {
      const ordered = ANALYSTS.map((a) => a.key).filter((k) => analysts.includes(k));
      const id = await startRun({ ticker: ticker.trim().toUpperCase(), tradeDate: date, analysts: ordered, depth });
      go(`/live/${id}`);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="hero">
        <div className="sculpture" aria-hidden="true">
          <span className="slab" /><span className="slab" /><span className="slab" /><span className="slab" /><span className="slab" />
        </div>
        <div className="hero-inner">
          <Eyebrow className="on-dark">Multi-agent research · paper only</Eyebrow>
          <h1 className="display">One ticker, one day, a whole research desk.</h1>
          <p className="hero-lede">
            Analysts write reports, a bull and a bear argue them out, a trader drafts a paper plan,
            three risk voices push back, and a portfolio manager writes the final research rating.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-on-dark" href="#/live">Replay the sample run</a>
            <a className="btn btn-outline-dark" href="#/report">Read the sample report</a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container setup-grid">
          <div>
            <Eyebrow>Run setup</Eyebrow>
            <h2 className="heading">What should the desk look at?</h2>
            <p className="lede">
              The same choices the TradingAgents CLI asks for. A run reads data as of the analysis date and
              writes a state log and a report tree to your results directory.
            </p>
          </div>

          <form className="form" onSubmit={onRun} noValidate>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Ticker</span>
                <input className="input" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  autoComplete="off" spellCheck="false" inputMode="text" aria-describedby="ticker-help" />
                <span className="field-help" id="ticker-help">Exchange suffixes work too, e.g. 7203.T</span>
              </label>
              <label className="field">
                <span className="field-label">Analysis date</span>
                <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
                <span className="field-help">Data is served as of this date.</span>
              </label>
            </div>

            <fieldset className="field">
              <legend className="field-label">Analysts</legend>
              <div className="choice-grid">
                {ANALYSTS.map((a) => (
                  <label key={a.key} className={`choice ${analysts.includes(a.key) ? 'is-on' : ''}`}>
                    <input type="checkbox" checked={analysts.includes(a.key)} onChange={() => toggle(a.key)} />
                    <span className="choice-title">{a.agent}</span>
                    <span className="choice-note">{ANALYST_NOTES[a.key]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="field">
              <legend className="field-label">Research depth</legend>
              <div className="segmented" role="radiogroup">
                {DEPTHS.map((d) => (
                  <label key={d.value} className={`segment ${depth === d.value ? 'is-on' : ''}`}>
                    <input type="radio" name="depth" checked={depth === d.value} onChange={() => setDepth(d.value)} />
                    <span>{d.label}</span>
                    <span className="segment-note">{d.note}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="run-actions">
              <button type="submit" className="btn btn-primary" disabled={!canRun} aria-describedby="run-note">
                {busy ? 'Starting…' : 'Run research'}
              </button>
              <a className="btn btn-ghost" href="#/live">Replay sample instead</a>
            </div>
            <p className="run-note" id="run-note">{runNote}</p>
            {error && <p className="run-error" role="alert">{error}</p>}
          </form>
        </div>
      </section>

      <section className="section section-warm">
        <div className="container">
          <Eyebrow>How a run works</Eyebrow>
          <h2 className="heading">Five steps, all on paper.</h2>
          <div className="columns">
            {[
              ['Analyst team', 'The selected analysts work at the same time, each with its own tools, and each files one report.'],
              ['Bull and bear', 'Two researchers debate the reports for the rounds you chose. The research manager weighs them and writes a plan.'],
              ['Trader', 'Turns the plan into a paper proposal: an action, the reasoning, and optional entry, stop and size.'],
              ['Risk debate', 'Aggressive, conservative and neutral voices argue the proposal for the same number of rounds.'],
              ['Portfolio manager', 'Writes the final research rating on a five-step scale, from Buy to Sell, or REVIEW when none can be read.'],
            ].map(([t, d], i) => (
              <div className="column" key={t}>
                <p className="column-step">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="column-title">{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
