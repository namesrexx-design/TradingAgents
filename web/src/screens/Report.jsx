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
import { Eyebrow, KeyValue, RatingScale, SampleBanner, analystLabel } from '../components/ui.jsx';
import { go } from '../router.js';

function Turns({ turns, speakers }) {
  if (!turns.length) return <p className="muted">No turns were recorded.</p>;
  return (
    <ol className="turns">
      {turns.map((t, i) => (
        <li key={i} className={`turn-row turn-${speakers.indexOf(t.speaker)}`}>
          <p className="turn-speaker">{t.speaker.replace(' Analyst', '')}</p>
          <div className="turn-body"><Markdown text={t.text} /></div>
        </li>
      ))}
    </ol>
  );
}

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
    return <section className="section"><div className="container"><h1 className="heading">Report unavailable</h1><p className="lede">{indexError || error}</p><a className="btn btn-outline" href="#/runs">See past runs</a></div></section>;
  }
  if (!run) return <section className="section"><div className="container"><p className="muted">Loading report…</p></div></section>;

  const { decision: d, traderPlan: t, researchPlan: rp, settings } = run;
  const setSource = (s) => go(`/report/${encodeURIComponent(run.ticker)}/${run.tradeDate}${s === 'report_tree' ? '?source=report_tree' : ''}`);
  const toc = [
    ['decision', 'Decision'], ['trader', 'Trader plan'], ['research', 'Research manager'],
    ['debate', 'Bull vs. bear'], ['risk', 'Risk view'],
    ...run.analysts.map((a) => [`analyst-${a.key}`, a.title]),
    ['settings', 'Run details'],
  ];

  return (
    <>
      <section className="hero hero-report">
        <div className="hero-inner">
          <Eyebrow className="on-dark">Portfolio manager · research rating{run.isSample ? ' · SAMPLE' : ''}</Eyebrow>
          <h1 className="display">{run.isReview ? 'Review' : run.rating}</h1>
          <p className="hero-meta">{run.ticker} · analysis date {run.tradeDate}{settings?.version ? ` · TradingAgents ${settings.version}` : ''}</p>
          <RatingScale rating={run.rating} onDark />
          {run.isReview && <p className="hero-lede">No rating could be read from the decision, so this run is recorded for review, not as a position.</p>}
          {d.executiveSummary && <p className="hero-lede"><Inline text={d.executiveSummary} /></p>}
          <p className="hero-fine">A research opinion written by language models. Paper only; no orders are placed.</p>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container report-grid">
          <nav className="toc" aria-label="Report sections">
            <p className="toc-title">On this page</p>
            <ul>{toc.map(([id, label]) => <li key={id}><a href={`#/report/${encodeURIComponent(run.ticker)}/${run.tradeDate}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}>{label}</a></li>)}</ul>
            <div className="toc-source">
              <p className="toc-title">Read from</p>
              <div className="segmented segmented-small" role="radiogroup" aria-label="Source">
                <button type="button" className={`segment ${prefer === 'state_log' ? 'is-on' : ''}`} onClick={() => setSource('state_log')} aria-pressed={prefer === 'state_log'}>JSON log</button>
                <button type="button" className={`segment ${prefer === 'report_tree' ? 'is-on' : ''}`} onClick={() => setSource('report_tree')} aria-pressed={prefer === 'report_tree'}>Markdown</button>
              </div>
            </div>
          </nav>

          <div className="report-body">
            {run.isSample && <SampleBanner />}

            <article className="report-section" id="decision">
              <Eyebrow>Portfolio manager</Eyebrow>
              <h2 className="heading">Decision</h2>
              <div className="kv-row">
                <KeyValue label="Research rating" value={run.rating} />
                <KeyValue label="Price target" value={d.priceTarget} note="Research estimate, not an order" />
                <KeyValue label="Time horizon" value={d.timeHorizon} />
              </div>
              {d.investmentThesis
                ? <><h3 className="minor">Investment thesis</h3><Markdown text={d.investmentThesis} /></>
                : <Markdown text={d.raw} />}
            </article>

            <article className="report-section" id="trader">
              <Eyebrow>Trading team · paper proposal</Eyebrow>
              <h2 className="heading">Trader plan</h2>
              <div className="kv-row kv-row-4">
                <KeyValue label="Proposed action" value={t.action} note="Paper only" />
                <KeyValue label="Entry level" value={t.entryPrice} />
                <KeyValue label="Stop level" value={t.stopLoss} />
                <KeyValue label="Sizing" value={t.positionSizing} />
              </div>
              {t.reasoning ? <Markdown text={t.reasoning} /> : <Markdown text={t.raw} />}
            </article>

            <article className="report-section" id="research">
              <Eyebrow>Research team</Eyebrow>
              <h2 className="heading">Research manager</h2>
              <div className="kv-row"><KeyValue label="Recommendation" value={rp.recommendation} /></div>
              {rp.rationale && <><h3 className="minor">Rationale</h3><Markdown text={rp.rationale} /></>}
              {rp.strategicActions && <><h3 className="minor">Strategic actions</h3><Markdown text={rp.strategicActions} /></>}
              {!rp.rationale && !rp.strategicActions && <Markdown text={rp.raw} />}
            </article>

            <article className="report-section" id="debate">
              <Eyebrow>Research debate · {run.debate.turns.length} turns</Eyebrow>
              <h2 className="heading">Bull vs. bear</h2>
              <Turns turns={run.debate.turns} speakers={['Bull Analyst', 'Bear Analyst']} />
            </article>

            <article className="report-section" id="risk">
              <Eyebrow>Risk management · {run.risk.turns.length} turns</Eyebrow>
              <h2 className="heading">Risk view</h2>
              <Turns turns={run.risk.turns} speakers={['Aggressive Analyst', 'Conservative Analyst', 'Neutral Analyst']} />
            </article>

            {run.analysts.map((a) => (
              <article className="report-section" id={`analyst-${a.key}`} key={a.key}>
                <Eyebrow>Analyst team · {a.agent}</Eyebrow>
                <h2 className="heading">{a.title}</h2>
                {a.sentiment && (
                  <div className="kv-row">
                    <KeyValue label="Overall sentiment" value={a.sentiment.band} />
                    <KeyValue label="Score" value={`${a.sentiment.score.toFixed(1)} / 10`} />
                    <KeyValue label="Confidence" value={a.sentiment.confidence} />
                  </div>
                )}
                <Markdown text={a.sentiment ? a.body.replace(/^\*\*Overall Sentiment:\*\*.*\n\*\*Confidence:\*\*.*\n?/, '') : a.body} />
              </article>
            ))}

            <article className="report-section" id="settings">
              <Eyebrow>Provenance</Eyebrow>
              <h2 className="heading">Run details</h2>
              <dl className="details">
                <div><dt>Source</dt><dd><code>{run.source.kind === 'state_log' ? 'full_states_log JSON' : 'report tree (markdown)'}</code></dd></div>
                {run.source.path && <div><dt>Path</dt><dd><code className="wrap">{run.source.path}</code></dd></div>}
                {settings?.llm_provider && <div><dt>Provider</dt><dd>{settings.llm_provider}</dd></div>}
                {settings?.deep_think_llm && <div><dt>Models</dt><dd>deep {settings.deep_think_llm}, quick {settings.quick_think_llm}</dd></div>}
                {settings?.analysts && <div><dt>Analysts</dt><dd>{settings.analysts.map(analystLabel).join(', ')}</dd></div>}
                {settings && <div><dt>Debate rounds</dt><dd>research {settings.max_debate_rounds ?? '?'}, risk {settings.max_risk_discuss_rounds ?? '?'}</dd></div>}
              </dl>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
