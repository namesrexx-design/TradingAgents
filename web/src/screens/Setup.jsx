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
import { BronzeHero, Eyebrow, heroText } from '../components/ui.jsx';
import { button, cardWhite, container, feature, featureBody, featureTitle, focusRing, heading, headingLg, input } from '../components/recipes.js';
import detailArt from '../assets/hero-ribbon-detail.webp';

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

  const label = 'pl-24 text-caption font-medium';
  const help = 'pl-24 text-caption text-pebble';
  const focusWithin = 'has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-graphite-ink';

  return (
    <>
      {/* Agent Prompt Guide #4: Bronze Field hero. */}
      <BronzeHero>
        <Eyebrow onDark>Multi-agent research, on paper</Eyebrow>
        <h1 className={heroText.display}>One ticker. One day. One desk.</h1>
        <p className={heroText.lede}>
          Analysts write reports, a bull and a bear argue them out, a trader drafts a paper plan, three risk
          voices push back, and a portfolio manager writes the research rating.
        </p>
        <div className="flex flex-wrap gap-12">
          {/* "a Charcoal filled pill primary next to an outlined pill secondary" */}
          <a className={`${button.primary} ${focusRing}`} href="#/live">Replay the sample</a>
          <a className={`${button.outlineOnDark} ${focusRing}`} href="#/report">Read the report</a>
        </div>
      </BronzeHero>

      {/* Agent Prompt Guide #3: three-column feature row with hairline dividers. */}
      <section className="bg-paper-white py-80">
        <div className={container}>
          <Eyebrow>How a run works</Eyebrow>
          <h2 className={`${heading} mb-40`}>Three teams, all on paper.</h2>
          <div className="grid gap-48 md:grid-cols-3">
            {[
              ['Analysts report', 'The analysts you pick work at the same time, each with its own data tools, and each files one report: market, sentiment, news or fundamentals.'],
              ['Bull and bear debate', 'Two researchers argue the reports for the rounds you chose. The research manager weighs them, and the trader turns the plan into a paper proposal.'],
              ['Risk and the rating', 'Aggressive, conservative and neutral voices argue the proposal. The portfolio manager writes a rating from Buy to Sell, or REVIEW when none can be read.'],
            ].map(([t, d]) => (
              <div className={feature} key={t}>
                <h3 className={featureTitle}>{t}</h3>
                <p className={featureBody}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Run setup: a Linen Cream section; the form is a Paper White Soft Card. */}
      <section id="setup" className="bg-linen-cream py-80">
        <div className={`${container} grid items-start gap-48 lg:grid-cols-[9fr_11fr] lg:gap-64`}>
          <div className="min-w-0">
            <Eyebrow>Run setup</Eyebrow>
            <h2 className={`${heading} mb-16`}>What should the desk look at?</h2>
            <p className="mb-24 text-subheading leading-subheading">
              The same choices the TradingAgents CLI asks for. A run reads data as of the analysis date and
              writes a state log and a report tree to your results directory.
            </p>
            <p className="text-caption text-pebble">Research tool. Not financial advice. No orders are placed.</p>
          </div>

          <form className={`${cardWhite} grid gap-32`} onSubmit={onRun} noValidate>
            <div className="grid gap-16 sm:grid-cols-2">
              <label className="grid min-w-0 gap-8">
                <span className={label}>Ticker</span>
                <input className={input} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="e.g. NVDA" autoComplete="off" spellCheck="false" aria-describedby="ticker-help" />
                <span className={help} id="ticker-help">Exchange suffixes work too, e.g. 7203.T</span>
              </label>
              <label className="grid min-w-0 gap-8">
                <span className={label}>Analysis date</span>
                <input className={input} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
                <span className={help}>Data is served as of this date.</span>
              </label>
            </div>

            <fieldset className="grid min-w-0 gap-8">
              <legend className={`${label} mb-8`}>Analysts</legend>
              <div className="grid gap-12 sm:grid-cols-2">
                {ANALYSTS.map((a) => {
                  const on = analysts.includes(a.key);
                  return (
                    <label key={a.key}
                      className={`relative flex cursor-pointer items-center gap-12 rounded-full-2 border bg-paper-white py-12 pr-24 pl-16 ${focusWithin} ${on ? 'border-graphite-ink' : 'border-stone'}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(a.key)} />
                      <span aria-hidden="true" className={`grid size-24 shrink-0 place-items-center rounded-full-2 border text-caption leading-none text-paper-white ${on ? 'border-charcoal bg-charcoal' : 'border-stone'}`}>{on ? '✓' : ''}</span>
                      <span className="grid min-w-0">
                        <span className="font-medium leading-caption">{a.agent}</span>
                        <span className="text-caption leading-caption text-pebble">{ANALYST_NOTES[a.key]}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="grid min-w-0 gap-8">
              <legend className={`${label} mb-8`}>Research depth</legend>
              <div className="flex gap-4 rounded-full-2 border border-stone bg-paper-white p-4" role="radiogroup" aria-label="Research depth">
                {DEPTHS.map((d) => {
                  const on = depth === d.value;
                  return (
                    <label key={d.value}
                      className={`relative flex flex-1 cursor-pointer flex-col items-center justify-center rounded-full-2 px-8 py-8 text-center font-wealthsimple-sans text-body leading-control tracking-control ${focusWithin} ${on ? 'bg-charcoal text-paper-white' : 'text-graphite-ink'}`}>
                      <input type="radio" name="depth" className="sr-only" checked={on} onChange={() => setDepth(d.value)} />
                      <span>{d.label}</span>
                      <span className={`font-the-future text-caption tracking-body ${on ? 'text-paper-white/80' : 'text-pebble'}`}>{d.note}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-12">
              <button type="submit" className={`${button.primary} ${focusRing}`} disabled={!canRun} aria-describedby="run-note">
                {busy ? 'Starting…' : 'Run research'}
              </button>
              <a className={`${button.ghost} ${focusRing}`} href="#/live">Replay sample instead</a>
            </div>
            <p className="-mt-16 text-caption text-pebble" id="run-note">{runNote}</p>
            {error && <p className="border-l border-graphite-ink pl-12 text-caption" role="alert">{error}</p>}
          </form>
        </div>
      </section>

      {/* Agent Prompt Guide #2: light editorial section. */}
      <section className="bg-paper-white py-80">
        <div className={`${container} flex flex-col items-center gap-48 lg:flex-row`}>
          {/* "Left column (~45% width): a 14px The Future eyebrow in Pebble, then a Tiempos
              500 56px heading in Graphite Ink with -0.56px letter-spacing, then a 18px The
              Future 400 paragraph in Graphite, then a single Charcoal filled pill button." */}
          <div className="w-full min-w-0 lg:w-[45%]">
            <Eyebrow>The sample run</Eyebrow>
            <h2 className={`${headingLg} mb-24 max-lg:text-heading max-lg:leading-heading`}>Read a finished run before you start one.</h2>
            <p className="mb-32 font-the-future font-normal text-subheading leading-subheading text-graphite-ink">
              DEMO is a fictional ticker. Its report shows every section a real run writes: the decision, the
              trader&apos;s paper plan, both debates and each analyst report. Every line is marked SAMPLE.
            </p>
            <a className={`${button.primary} ${focusRing}`} href="#/report">Read the sample report</a>
          </div>
          {/* "Right column: a sculptural 3D render … on a warm cream floor with soft ambient shadow." */}
          <div aria-hidden="true" className="w-full min-w-0 lg:w-[55%]">
            <img src={detailArt} alt="" width="1400" height="1200" decoding="async" className="block h-auto w-full" />
          </div>
        </div>
      </section>
    </>
  );
}
