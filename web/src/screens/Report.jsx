/*
 * TradingAgents web dashboard: final report.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * Sections follow write_report_tree() in tradingagents/reporting.py, read top
 * down from the decision: Portfolio Manager, Trader, Research Manager, the
 * bull/bear debate, the risk debate, then every analyst report.
 */
import { useEffect, useState } from 'react';
import Markdown, { Inline } from '../components/Markdown.jsx';
import { BronzeHero, Eyebrow, KeyValue, RatingScale, SampleBanner, analystLabel, heroText } from '../components/ui.jsx';
import { button, card, container, focusRing, heading } from '../components/recipes.js';
import { go } from '../router.js';

function Turns({ turns }) {
  if (!turns.length) return <p className="text-pebble">No turns were recorded.</p>;
  return (
    <ol className="mt-24 max-w-[48em]">
      {turns.map((t, i) => (
        <li key={i} className="grid gap-8 border-t border-stone py-20 md:grid-cols-[140px_minmax(0,1fr)] md:gap-24">
          <p className="font-medium">{t.speaker.replace(' Analyst', '')}</p>
          <div className="min-w-0"><Markdown text={t.text} /></div>
        </li>
      ))}
    </ol>
  );
}

/* A report section is a Soft Card Surface: Linen Cream, 100px radius, 32px padding. */
function Section({ id, eyebrowText, title, children }) {
  return (
    <article id={id} className={`${card} scroll-mt-24`}>
      <Eyebrow>{eyebrowText}</Eyebrow>
      <h2 className={`${heading} mb-16 max-md:text-heading-sm max-md:leading-heading-sm`}>{title}</h2>
      {children}
    </article>
  );
}

const subTitle = 'mt-32 mb-12 font-the-future font-medium text-subheading leading-subheading';
const prose = 'max-w-[44em]';

export default function Report({ ctx, ticker, date, source }) {
  const { index, indexError, getRun } = ctx;
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);
  const prefer = source === 'report_tree' ? 'report_tree' : 'state_log';

  const entry = index?.runs?.find((r) => r.ticker === ticker && r.trade_date === date) || (!ticker ? index?.runs?.[0] : null);

  useEffect(() => {
    if (!index) return;
    if (!entry) { setError(ticker ? `No saved run for ${ticker} on ${date}.` : 'No runs yet.'); return; }
    let live = true;
    setError(null);
    getRun(entry, prefer).then((r) => live && setRun(r)).catch((e) => live && setError(String(e.message || e)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, entry?.ticker, entry?.trade_date, prefer]);

  if (indexError || error) {
    return (
      <section className="bg-paper-white py-80">
        <div className={container}>
          <h1 className={`${heading} mb-16`}>Report unavailable</h1>
          <p className="mb-24 text-subheading">{indexError || error}</p>
          <a className={`${button.outline} ${focusRing}`} href="#/runs">See past runs</a>
        </div>
      </section>
    );
  }
  if (!run) return <section className="bg-paper-white py-80"><div className={container}><p className="text-pebble">Loading report…</p></div></section>;

  const { decision: d, traderPlan: t, researchPlan: rp, settings } = run;
  const base = `#/report/${encodeURIComponent(run.ticker)}/${run.tradeDate}`;
  const setSource = (s) => go(`/report/${encodeURIComponent(run.ticker)}/${run.tradeDate}${s === 'report_tree' ? '?source=report_tree' : ''}`);
  const toc = [
    ['decision', 'Decision'], ['trader', 'Trader plan'], ['research', 'Research manager'],
    ['debate', 'Bull vs. bear'], ['risk', 'Risk view'],
    ...run.analysts.map((a) => [`analyst-${a.key}`, a.title]),
    ['settings', 'Run details'],
  ];
  const seg = (on) => `flex-1 cursor-pointer rounded-full-2 px-12 py-6 font-wealthsimple-sans text-caption leading-control tracking-control ${on ? 'bg-charcoal text-paper-white' : 'text-graphite-ink'} ${focusRing}`;

  return (
    <>
      <BronzeHero>
        <Eyebrow onDark>Portfolio manager · research rating{run.isSample ? ' · SAMPLE' : ''}</Eyebrow>
        <h1 className={`${heroText.display} mb-8`}>{run.isReview ? 'Review' : run.rating}</h1>
        <p className="mb-24 text-subheading leading-subheading text-paper-white/80">
          {run.ticker} · analysis date {run.tradeDate}{settings?.version ? ` · TradingAgents ${settings.version}` : ''}
        </p>
        <div className="mb-32"><RatingScale rating={run.rating} onDark /></div>
        {run.isReview && <p className={heroText.lede}>No rating could be read from the decision, so this run is recorded for review, not as a position.</p>}
        {d.executiveSummary && <p className={heroText.lede}><Inline text={d.executiveSummary} /></p>}
        <p className={heroText.fine}>A research opinion written by language models. Research tool, not financial advice. No orders are placed.</p>
      </BronzeHero>

      <section className="bg-paper-white pt-48 pb-80">
        <div className={`${container} grid items-start gap-32 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-48`}>
          <nav aria-label="Report sections" className="text-caption lg:sticky lg:top-24 lg:pt-32">
            <p className="mb-8 hidden text-pebble lg:block">On this page</p>
            <ul className="mb-32 hidden lg:block">
              {toc.map(([id, label]) => (
                <li key={id}>
                  <a href={base} className={`block border-b border-stone py-6 no-underline hover:underline ${focusRing}`}
                    onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}>{label}</a>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-x-12 gap-y-8 lg:block">
              <p className="text-pebble lg:mb-8">Read from</p>
              <div className="flex gap-4 rounded-full-2 border border-stone bg-paper-white p-4" role="group" aria-label="Source">
                <button type="button" className={seg(prefer === 'state_log')} onClick={() => setSource('state_log')} aria-pressed={prefer === 'state_log'}>JSON log</button>
                <button type="button" className={seg(prefer === 'report_tree')} onClick={() => setSource('report_tree')} aria-pressed={prefer === 'report_tree'}>Markdown</button>
              </div>
            </div>
          </nav>

          <div className="grid min-w-0 gap-24">
            {run.isSample && <SampleBanner />}

            <Section id="decision" eyebrowText="Portfolio manager" title="Decision">
              <div className="mt-24 mb-8 grid gap-24 sm:grid-cols-3">
                <KeyValue label="Research rating" value={run.rating} />
                <KeyValue label="Price target" value={d.priceTarget} note="Research estimate, not an order" />
                <KeyValue label="Time horizon" value={d.timeHorizon} />
              </div>
              {d.investmentThesis
                ? <><h3 className={subTitle}>Investment thesis</h3><Markdown className={prose} text={d.investmentThesis} /></>
                : <Markdown className={prose} text={d.raw} />}
            </Section>

            <Section id="trader" eyebrowText="Trading team · paper proposal" title="Trader plan">
              <div className="mt-24 mb-32 grid gap-24 sm:grid-cols-2 xl:grid-cols-4">
                <KeyValue label="Proposed action" value={t.action} note="Paper only" />
                <KeyValue label="Entry level" value={t.entryPrice} />
                <KeyValue label="Stop level" value={t.stopLoss} />
                <KeyValue label="Sizing" value={t.positionSizing} />
              </div>
              <Markdown className={prose} text={t.reasoning || t.raw} />
            </Section>

            <Section id="research" eyebrowText="Research team" title="Research manager">
              <div className="mt-24 grid gap-24 sm:grid-cols-3"><KeyValue label="Recommendation" value={rp.recommendation} /></div>
              {rp.rationale && <><h3 className={subTitle}>Rationale</h3><Markdown className={prose} text={rp.rationale} /></>}
              {rp.strategicActions && <><h3 className={subTitle}>Strategic actions</h3><Markdown className={prose} text={rp.strategicActions} /></>}
              {!rp.rationale && !rp.strategicActions && <Markdown className={prose} text={rp.raw} />}
            </Section>

            <Section id="debate" eyebrowText={`Research debate · ${run.debate.turns.length} turns`} title="Bull vs. bear">
              <Turns turns={run.debate.turns} />
            </Section>

            <Section id="risk" eyebrowText={`Risk management · ${run.risk.turns.length} turns`} title="Risk view">
              <Turns turns={run.risk.turns} />
            </Section>

            {run.analysts.map((a) => (
              <Section key={a.key} id={`analyst-${a.key}`} eyebrowText={`Analyst team · ${a.agent}`} title={a.title}>
                {a.sentiment && (
                  <div className="mt-24 mb-32 grid gap-24 sm:grid-cols-3">
                    <KeyValue label="Overall sentiment" value={a.sentiment.band} />
                    <KeyValue label="Score" value={`${a.sentiment.score.toFixed(1)} / 10`} />
                    <KeyValue label="Confidence" value={a.sentiment.confidence} />
                  </div>
                )}
                <Markdown className={prose} text={a.sentiment ? a.body.replace(/^\*\*Overall Sentiment:\*\*.*\n\*\*Confidence:\*\*.*\n?/, '') : a.body} />
              </Section>
            ))}

            <Section id="settings" eyebrowText="Provenance" title="Run details">
              <dl className="mt-16 max-w-[48em]">
                {[
                  ['Source', <code key="s" className="rounded-sm bg-fog-veil px-4 font-mono text-caption">{run.source.kind === 'state_log' ? 'full_states_log JSON' : 'report tree (markdown)'}</code>],
                  run.source.path && ['Path', <code key="p" className="break-all rounded-sm bg-fog-veil px-4 font-mono text-caption">{run.source.path}</code>],
                  settings?.llm_provider && ['Provider', settings.llm_provider],
                  settings?.deep_think_llm && ['Models', `deep ${settings.deep_think_llm}, quick ${settings.quick_think_llm}`],
                  settings?.analysts && ['Analysts', settings.analysts.map(analystLabel).join(', ')],
                  settings && ['Debate rounds', `research ${settings.max_debate_rounds ?? '?'}, risk ${settings.max_risk_discuss_rounds ?? '?'}`],
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k} className="grid gap-4 border-t border-stone py-12 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-16">
                    <dt className="text-caption text-pebble">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </div>
        </div>
      </section>
    </>
  );
}
