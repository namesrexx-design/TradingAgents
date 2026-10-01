/*
 * TradingAgents web dashboard: build the SAMPLE report trees and run index.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * A line-for-line port of tradingagents/reporting.py write_report_tree(), so the
 * sample's markdown tree has exactly the layout a real run saves, without Python.
 * Reads every public/sample/results/<TICKER>/TradingAgentsStrategy_logs/*.json,
 * writes public/sample/results/reports/<TICKER>_<YYYYMMDD>_090000/..., and
 * writes public/sample/index.json in the shape the bridge's GET /api/runs returns.
 *
 *   npm run sample:reports
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.resolve(here, '../public/sample');
const RESULTS = path.join(SAMPLE, 'results');

function header(ticker, state, settings, generated) {
  const lines = [`# Trading Analysis Report: ${ticker}`, ''];
  if (state.trade_date) lines.push(`- Analysis date: ${state.trade_date}`);
  lines.push(`- Generated: ${generated}`);
  if (settings) {
    const s = (k, d = '?') => (settings[k] ?? d);
    lines.push(`- TradingAgents ${s('version')}: ${s('llm_provider')}, deep ${s('deep_think_llm')}, quick ${s('quick_think_llm')}`);
    lines.push(`- Analysts: ${(settings.analysts || []).join(', ')}; research debate rounds ${s('max_debate_rounds')}, risk debate rounds ${s('max_risk_discuss_rounds')}`);
    const vendors = { ...(settings.data_vendors || {}), ...(settings.tool_vendors || {}) };
    if (Object.keys(vendors).length) lines.push('- Data vendors: ' + Object.entries(vendors).map(([k, v]) => `${k} ${v}`).join(', '));
  }
  return lines.join('\n') + '\n\n';
}

function writeReportTree(state, ticker, savePath, settings, generated) {
  fs.mkdirSync(savePath, { recursive: true });
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(savePath, rel)), { recursive: true });
    fs.writeFileSync(path.join(savePath, rel), text, 'utf8');
  };
  const sections = [];
  const files = [];
  const put = (rel, text) => { write(rel, text); files.push(rel); };

  const analystParts = [];
  for (const [key, file, name] of [
    ['market_report', 'market.md', 'Market Analyst'],
    ['sentiment_report', 'sentiment.md', 'Sentiment Analyst'],
    ['news_report', 'news.md', 'News Analyst'],
    ['fundamentals_report', 'fundamentals.md', 'Fundamentals Analyst'],
  ]) {
    if (state[key]) { put(`1_analysts/${file}`, state[key]); analystParts.push([name, state[key]]); }
  }
  if (analystParts.length) sections.push(`## I. Analyst Team Reports\n\n${analystParts.map(([n, t]) => `### ${n}\n${t}`).join('\n\n')}`);

  if (state.investment_debate_state) {
    const d = state.investment_debate_state;
    const parts = [];
    if (d.bull_history) { put('2_research/bull.md', d.bull_history); parts.push(['Bull Researcher', d.bull_history]); }
    if (d.bear_history) { put('2_research/bear.md', d.bear_history); parts.push(['Bear Researcher', d.bear_history]); }
    if (state.investment_plan) { put('2_research/manager.md', state.investment_plan); parts.push(['Research Manager', state.investment_plan]); }
    if (parts.length) sections.push(`## II. Research Team Decision\n\n${parts.map(([n, t]) => `### ${n}\n${t}`).join('\n\n')}`);
  }

  if (state.trader_investment_plan) {
    put('3_trading/trader.md', state.trader_investment_plan);
    sections.push(`## III. Trading Team Plan\n\n### Trader\n${state.trader_investment_plan}`);
  }

  if (state.risk_debate_state) {
    const r = state.risk_debate_state;
    const parts = [];
    if (r.aggressive_history) { put('4_risk/aggressive.md', r.aggressive_history); parts.push(['Aggressive Analyst', r.aggressive_history]); }
    if (r.conservative_history) { put('4_risk/conservative.md', r.conservative_history); parts.push(['Conservative Analyst', r.conservative_history]); }
    if (r.neutral_history) { put('4_risk/neutral.md', r.neutral_history); parts.push(['Neutral Analyst', r.neutral_history]); }
    if (parts.length) sections.push(`## IV. Risk Management Team Decision\n\n${parts.map(([n, t]) => `### ${n}\n${t}`).join('\n\n')}`);
  }

  if (state.final_trade_decision) {
    put('5_portfolio/decision.md', state.final_trade_decision);
    sections.push(`## V. Portfolio Manager Decision\n\n### Portfolio Manager\n${state.final_trade_decision}`);
  }

  put('complete_report.md', header(ticker, state, settings, generated) + sections.join('\n\n'));
  return files;
}

const index = { sample: true, note: 'SAMPLE — illustrative, not real analysis. Fictional ticker DEMO; no model or market data was used.', runs: [] };

for (const ticker of fs.readdirSync(RESULTS)) {
  const logs = path.join(RESULTS, ticker, 'TradingAgentsStrategy_logs');
  if (!fs.existsSync(logs)) continue;
  for (const name of fs.readdirSync(logs).filter((n) => /^full_states_log_\d{4}-\d{2}-\d{2}\.json$/.test(n))) {
    const state = JSON.parse(fs.readFileSync(path.join(logs, name), 'utf8'));
    const date = state.trade_date;
    const stamp = `${date.replaceAll('-', '')}_090000`;
    const dirName = `${ticker}_${stamp}`;
    const dir = path.join(RESULTS, 'reports', dirName);
    fs.rmSync(dir, { recursive: true, force: true });
    const files = writeReportTree(state, ticker, dir, state.run_settings, `${date} 09:00:00`);
    index.runs.push({
      ticker,
      trade_date: date,
      rating: state.final_rating,
      analysts: state.run_settings?.analysts || [],
      state_log: `sample/results/${ticker}/TradingAgentsStrategy_logs/${name}`,
      report_dir: `sample/results/reports/${dirName}`,
      report_files: files.sort(),
    });
  }
}

index.runs.sort((a, b) => b.trade_date.localeCompare(a.trade_date) || a.ticker.localeCompare(b.ticker));
fs.writeFileSync(path.join(SAMPLE, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log(`wrote ${index.runs.length} sample runs to ${path.relative(process.cwd(), SAMPLE)}`);
