/*
 * TradingAgents web dashboard: past runs.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * One row per state log: <results_dir>/<TICKER>/TradingAgentsStrategy_logs/
 * full_states_log_<date>.json, listed by the bridge or by public/sample/index.json.
 */
import { Eyebrow, RatingBadge, SampleBanner, analystLabel } from '../components/ui.jsx';

export default function Runs({ ctx }) {
  const { index, indexError, bridge } = ctx;
  const runs = index?.runs || [];

  return (
    <section className="section section-tight">
      <div className="container">
        <div className="page-head">
          <div>
            <Eyebrow>{index?.sample ? 'Bundled sample runs' : 'Your results directory'}</Eyebrow>
            <h1 className="heading">Past runs</h1>
          </div>
        </div>
        {index?.sample && <SampleBanner />}
        {indexError && <p className="run-error" role="alert">{indexError}</p>}
        {!index && !indexError && <p className="muted">Loading runs…</p>}
        {index && runs.length === 0 && <p className="lede">No runs yet. Finished runs appear here once the bridge has written their state logs.</p>}

        {runs.length > 0 && (
          <ul className="runs">
            {runs.map((r) => (
              <li key={`${r.ticker}/${r.trade_date}`}>
                <a className="run-row" href={`#/report/${encodeURIComponent(r.ticker)}/${r.trade_date}`}>
                  <span className="run-ticker">{r.ticker}{index.sample && <span className="sample-tag sample-tag-small">SAMPLE</span>}</span>
                  <span className="run-date">{r.trade_date}</span>
                  <span className="run-analysts">{(r.analysts || []).map(analystLabel).join(' · ')}</span>
                  <span className="run-rating"><RatingBadge rating={r.rating || 'REVIEW'} /></span>
                  <span className="run-open" aria-hidden="true">Open →</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="columns columns-3 runs-notes">
          <div className="column">
            <h3 className="column-title">Where runs live</h3>
            <p>Each run writes <code className="wrap">~/.tradingagents/logs/&lt;TICKER&gt;/TradingAgentsStrategy_logs/full_states_log_&lt;date&gt;.json</code>, or under <code>TRADINGAGENTS_RESULTS_DIR</code> when set.</p>
          </div>
          <div className="column">
            <h3 className="column-title">Report trees</h3>
            <p>Saved reports go to <code className="wrap">results/reports/&lt;TICKER&gt;_&lt;stamp&gt;/</code> with one markdown file per agent and a <code>complete_report.md</code>. This app reads both.</p>
          </div>
          <div className="column">
            <h3 className="column-title">{bridge ? 'Connected' : 'Preview mode'}</h3>
            <p>{bridge ? 'This list comes from the bridge reading your results directory.' : 'No bridge is running, so this list shows the bundled SAMPLE runs only.'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
