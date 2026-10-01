/*
 * TradingAgents web dashboard: past runs.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * One row per state log: <results_dir>/<TICKER>/TradingAgentsStrategy_logs/
 * full_states_log_<date>.json, listed by the bridge or by public/sample/index.json.
 */
import { Eyebrow, RatingBadge, SampleBanner, analystLabel } from '../components/ui.jsx';
import { card, container, feature, featureBody, featureTitle, focusRing, headingLg } from '../components/recipes.js';

const code = 'rounded-sm bg-fog-veil px-4 font-mono text-caption break-all';

export default function Runs({ ctx }) {
  const { index, indexError, bridge } = ctx;
  const runs = index?.runs || [];

  return (
    <section className="bg-paper-white pt-48 pb-80">
      <div className={container}>
        <Eyebrow>{index?.sample ? 'Bundled sample runs' : 'Your results directory'}</Eyebrow>
        <h1 className={`${headingLg} mb-32 max-md:text-heading max-md:leading-heading`}>Past runs</h1>
        {index?.sample && <SampleBanner className="mb-32" />}
        {indexError && <p className="mb-16 border-l border-graphite-ink pl-12 text-caption" role="alert">{indexError}</p>}
        {!index && !indexError && <p className="text-pebble">Loading runs…</p>}
        {index && runs.length === 0 && <p className="text-subheading">No runs yet. Finished runs appear here once the bridge has written their state logs.</p>}

        {/* The run list is a Soft Card Surface; rows are split by Stone hairlines. */}
        {runs.length > 0 && (
          <div className={`${card} mb-80`}>
            <ul>
              {runs.map((r) => (
                <li key={`${r.ticker}/${r.trade_date}`} className="border-stone not-first:border-t">
                  <a href={`#/report/${encodeURIComponent(r.ticker)}/${r.trade_date}`}
                    className={`group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-16 gap-y-8 px-16 py-24 no-underline md:grid-cols-[180px_140px_minmax(0,1fr)_auto_auto] md:gap-24 ${focusRing}`}>
                    <span className="flex flex-wrap items-center gap-8 font-medium text-heading-sm leading-heading-sm">
                      {r.ticker}
                      {index.sample && <span className="inline-flex rounded-full-2 border border-dashed border-pebble bg-fog-veil px-8 font-wealthsimple-sans text-caption font-normal leading-control tracking-control">SAMPLE</span>}
                    </span>
                    <span className="tabular-nums md:order-none">{r.trade_date}</span>
                    <span className="col-span-2 text-caption text-pebble md:col-span-1">{(r.analysts || []).map(analystLabel).join(' · ')}</span>
                    <span><RatingBadge rating={r.rating || 'REVIEW'} /></span>
                    <span aria-hidden="true" className="hidden font-wealthsimple-sans tracking-control group-hover:underline md:inline">Open →</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Feature Columns with Top Divider. */}
        <div className="grid gap-48 md:grid-cols-3">
          <div className={feature}>
            <h3 className={featureTitle}>Where runs live</h3>
            <p className={featureBody}>Each run writes <code className={code}>~/.tradingagents/logs/&lt;TICKER&gt;/TradingAgentsStrategy_logs/full_states_log_&lt;date&gt;.json</code>, or under <code className={code}>TRADINGAGENTS_RESULTS_DIR</code> when set.</p>
          </div>
          <div className={feature}>
            <h3 className={featureTitle}>Report trees</h3>
            <p className={featureBody}>Saved reports go to <code className={code}>results/reports/&lt;TICKER&gt;_&lt;stamp&gt;/</code> with one markdown file per agent and a <code className={code}>complete_report.md</code>. This app reads both.</p>
          </div>
          <div className={feature}>
            <h3 className={featureTitle}>{bridge ? 'Connected' : 'Preview mode'}</h3>
            <p className={featureBody}>{bridge ? 'This list comes from the bridge reading your results directory.' : 'No bridge is running, so this list shows the bundled SAMPLE runs only.'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
