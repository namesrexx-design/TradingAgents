/*
 * TradingAgents web dashboard: run-output adapter.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * Turns what a TradingAgents run writes to disk into one view model:
 *
 *   1. The state log, written by TradingAgentsGraph._log_state():
 *        <results_dir>/<TICKER>/TradingAgentsStrategy_logs/full_states_log_<date>.json
 *   2. The report tree, written by tradingagents/reporting.py write_report_tree():
 *        <results_dir>/reports/<TICKER>_<stamp>/1_analysts/market.md ... complete_report.md
 *   3. The CLI's live section files (cli/run.py):
 *        <results_dir>/<TICKER>/<date>/reports/market_report.md ...
 *
 * Pure functions, no DOM and no fetch, so `node --test` can run them.
 */

export const SAMPLE_MARKER = 'SAMPLE — illustrative, not real analysis.';

/** The 5-tier scale from tradingagents/agents/rating.py, most bullish first. */
export const RATINGS = ['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell'];
export const RATING_REVIEW = 'REVIEW';

/** Analysts as tradingagents/graph/analyst_execution.py names them. */
export const ANALYSTS = [
  { key: 'market', agent: 'Market Analyst', reportKey: 'market_report', title: 'Market analysis', file: 'market.md' },
  { key: 'social', agent: 'Sentiment Analyst', reportKey: 'sentiment_report', title: 'Social sentiment', file: 'sentiment.md' },
  { key: 'news', agent: 'News Analyst', reportKey: 'news_report', title: 'News analysis', file: 'news.md' },
  { key: 'fundamentals', agent: 'Fundamentals Analyst', reportKey: 'fundamentals_report', title: 'Fundamentals analysis', file: 'fundamentals.md' },
];

/** Graph nodes after the analysts, in run order (tradingagents/graph/setup.py). */
export const TEAMS = [
  { team: 'Research team', agents: ['Bull Researcher', 'Bear Researcher', 'Research Manager'] },
  { team: 'Trading team', agents: ['Trader'] },
  { team: 'Risk management', agents: ['Aggressive Analyst', 'Conservative Analyst', 'Neutral Analyst'] },
  { team: 'Portfolio management', agents: ['Portfolio Manager'] },
];

const INVEST_SPEAKERS = ['Bull Analyst', 'Bear Analyst'];
const RISK_SPEAKERS = ['Aggressive Analyst', 'Conservative Analyst', 'Neutral Analyst'];

const str = (v) => (typeof v === 'string' ? v : '');

export function containsSampleMarker(text) {
  return str(text).includes(SAMPLE_MARKER);
}

/**
 * Read `**Label**: value` blocks, the markdown shape tradingagents/agents/schemas.py
 * renders for the Research Manager, Trader and Portfolio Manager. A value runs
 * until the next label that opens a line, or the trader's FINAL TRANSACTION line.
 */
export function parseLabeledFields(markdown) {
  const text = str(markdown);
  const fields = {};
  const re = /^\*\*([^*\n]+?)\*\*:[ \t]*/gm;
  const hits = [];
  let m;
  while ((m = re.exec(text)) !== null) hits.push({ label: m[1].trim(), start: m.index, valueStart: re.lastIndex });
  hits.forEach((hit, i) => {
    let end = i + 1 < hits.length ? hits[i + 1].start : text.length;
    const finalLine = text.slice(hit.valueStart, end).search(/^FINAL TRANSACTION PROPOSAL:/m);
    if (finalLine !== -1) end = hit.valueStart + finalLine;
    fields[hit.label] = text.slice(hit.valueStart, end).trim();
  });
  const proposal = text.match(/FINAL TRANSACTION PROPOSAL:\s*\*\*(\w+)\*\*/);
  if (proposal) fields['FINAL TRANSACTION PROPOSAL'] = proposal[1];
  return fields;
}

/** "not provided" is how schemas.py writes an optional field the model left out. */
export function providedOrNull(value) {
  const v = str(value).trim();
  return v === '' || v.toLowerCase() === 'not provided' ? null : v;
}

/**
 * The 5-tier rating as rating.py extract_rating() reads it: a "Rating: X" label,
 * the first one opening its own line, else the last anywhere. null when absent.
 */
export function extractRating(text) {
  const lines = str(text).normalize('NFKC').split(/\r?\n/);
  const valid = new Set(RATINGS.map((r) => r.toLowerCase()));
  const lineRe = /^[\s*_#]*(?:\w+\s+)?rating[^\w:\-\u2010-\u2015]*[:\-\u2010-\u2015][\s*]*(\w+)/i;
  const labelRe = /(?<![a-z])rating\b[^:\-\u2010-\u2015]*[:\-\u2010-\u2015][\s*]*(\w+)/i;
  let own = null;
  let anywhere = null;
  for (const line of lines) {
    if (/rating\s*(scale|options|legend)/i.test(line)) continue;
    const a = line.match(lineRe);
    if (own === null && a && valid.has(a[1].toLowerCase())) own = cap(a[1]);
    const b = line.match(labelRe);
    if (b && valid.has(b[1].toLowerCase())) anywhere = cap(b[1]);
  }
  return own || anywhere;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** rating.py run_rating(): final_rating, else read from the decision, else REVIEW. */
export function runRating(state) {
  return str(state.final_rating) || extractRating(state.final_trade_decision) || RATING_REVIEW;
}

/** The header schemas.py render_sentiment_report() puts on the sentiment report. */
export function parseSentimentHeader(report) {
  const text = str(report);
  const band = text.match(/\*\*Overall Sentiment:\*\*\s*\*\*([^*]+)\*\*\s*\(Score:\s*([\d.]+)\/10\)/);
  const confidence = text.match(/\*\*Confidence:\*\*\s*(\w+)/);
  if (!band) return null;
  return { band: band[1].trim(), score: Number(band[2]), confidence: confidence ? confidence[1] : null };
}

/**
 * Split a debate history into turns. Every agent prefixes its argument with its
 * name ("Bull Analyst: ...") and the graph joins turns with a newline.
 */
export function splitTurns(history, speakers) {
  const text = str(history);
  if (!text.trim()) return [];
  const names = speakers.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(?:^|\\n)(${names}):[ \\t]*`, 'g');
  const turns = [];
  const marks = [];
  let m;
  while ((m = re.exec(text)) !== null) marks.push({ speaker: m[1], start: m.index, bodyStart: re.lastIndex });
  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    const body = text.slice(mark.bodyStart, end).trim();
    if (body) turns.push({ speaker: mark.speaker, text: body });
  });
  return turns;
}

/**
 * Rebuild the interleaved order from per-speaker histories when only those
 * exist (the report tree saves bull.md and bear.md, not the joint history).
 * The graph always opens with the first speaker and rotates (conditional_logic.py).
 */
export function interleave(perSpeaker, speakers) {
  const queues = speakers.map((s) => splitTurns(perSpeaker[s], [s]));
  const out = [];
  for (let round = 0; queues.some((q) => q[round]); round += 1) {
    queues.forEach((q) => q[round] && out.push(q[round]));
  }
  return out;
}

function analystSections(state) {
  return ANALYSTS.filter((a) => str(state[a.reportKey]).trim()).map((a) => ({
    ...a,
    body: state[a.reportKey],
    sentiment: a.key === 'social' ? parseSentimentHeader(state[a.reportKey]) : null,
  }));
}

function researchPlan(md) {
  const f = parseLabeledFields(md);
  return {
    raw: str(md),
    recommendation: f.Recommendation || extractRating(md),
    rationale: f.Rationale || null,
    strategicActions: f['Strategic Actions'] || null,
  };
}

function traderPlan(md) {
  const f = parseLabeledFields(md);
  return {
    raw: str(md),
    action: f.Action || f['FINAL TRANSACTION PROPOSAL'] || null,
    reasoning: f.Reasoning || null,
    entryPrice: providedOrNull(f['Entry Price']),
    stopLoss: providedOrNull(f['Stop Loss']),
    positionSizing: providedOrNull(f['Position Sizing']),
  };
}

function decision(md, rating) {
  const f = parseLabeledFields(md);
  return {
    raw: str(md),
    rating,
    executiveSummary: f['Executive Summary'] || null,
    investmentThesis: f['Investment Thesis'] || null,
    priceTarget: providedOrNull(f['Price Target']),
    timeHorizon: providedOrNull(f['Time Horizon']),
  };
}

/** Shared tail: everything after the raw fields are known. */
function buildRun(state, source, extra = {}) {
  const inv = state.investment_debate_state || {};
  const risk = state.risk_debate_state || {};
  const rating = runRating(state);
  const investTurns = str(inv.history).trim()
    ? splitTurns(inv.history, INVEST_SPEAKERS)
    : interleave({ 'Bull Analyst': inv.bull_history, 'Bear Analyst': inv.bear_history }, INVEST_SPEAKERS);
  const riskTurns = str(risk.history).trim()
    ? splitTurns(risk.history, RISK_SPEAKERS)
    : interleave({
      'Aggressive Analyst': risk.aggressive_history,
      'Conservative Analyst': risk.conservative_history,
      'Neutral Analyst': risk.neutral_history,
    }, RISK_SPEAKERS);
  const settings = state.run_settings || extra.settings || null;
  const texts = [
    state.market_report, state.sentiment_report, state.news_report, state.fundamentals_report,
    inv.history, inv.bull_history, risk.history, state.investment_plan,
    state.trader_investment_plan, state.final_trade_decision,
  ];
  return {
    id: `${state.company_of_interest}/${state.trade_date}`,
    ticker: str(state.company_of_interest),
    tradeDate: str(state.trade_date),
    rating,
    isReview: rating === RATING_REVIEW,
    isSample: Boolean(extra.isSample) || texts.some(containsSampleMarker),
    source,
    settings,
    analysts: analystSections(state),
    debate: { turns: investTurns },
    researchPlan: researchPlan(state.investment_plan),
    traderPlan: traderPlan(state.trader_investment_plan),
    risk: { turns: riskTurns },
    decision: decision(state.final_trade_decision, rating),
    state,
  };
}

/** Adapter for the state log JSON (`full_states_log_<date>.json`). */
export function fromStateLog(json, meta = {}) {
  if (!json || typeof json !== 'object') throw new Error('State log is not a JSON object');
  for (const key of ['company_of_interest', 'trade_date', 'final_trade_decision']) {
    if (!(key in json)) throw new Error(`State log is missing "${key}"`);
  }
  return buildRun(json, { kind: 'state_log', path: meta.path || null }, meta);
}

/** Read the header write_report_tree() puts on complete_report.md. */
export function parseCompleteReportHeader(md) {
  const text = str(md);
  const out = {};
  const title = text.match(/^# Trading Analysis Report: (.+)$/m);
  if (title) out.ticker = title[1].trim();
  const date = text.match(/^- Analysis date: (\S+)/m);
  if (date) out.tradeDate = date[1];
  const gen = text.match(/^- Generated: (.+)$/m);
  if (gen) out.generated = gen[1].trim();
  const models = text.match(/^- TradingAgents (\S+): ([^,]+), deep ([^,]+), quick (.+)$/m);
  const analysts = text.match(/^- Analysts: ([^;]*); research debate rounds (\S+), risk debate rounds (\S+)$/m);
  if (models || analysts) {
    out.settings = {
      version: models ? models[1] : null,
      llm_provider: models ? models[2].trim() : null,
      deep_think_llm: models ? models[3].trim() : null,
      quick_think_llm: models ? models[4].trim() : null,
      analysts: analysts ? analysts[1].split(',').map((s) => s.trim()).filter(Boolean) : [],
      max_debate_rounds: analysts ? Number(analysts[2]) : null,
      max_risk_discuss_rounds: analysts ? Number(analysts[3]) : null,
    };
  }
  return out;
}

/**
 * Adapter for a report tree. `files` maps paths relative to the run folder to
 * their text. Accepts the write_report_tree() layout (1_analysts/market.md ...)
 * and the CLI's live layout (market_report.md, investment_plan.md, ...).
 */
export function fromReportTree(files, meta = {}) {
  const get = (...names) => {
    for (const n of names) if (typeof files[n] === 'string') return files[n];
    return '';
  };
  const header = parseCompleteReportHeader(get('complete_report.md'));
  const state = {
    company_of_interest: meta.ticker || header.ticker || '',
    trade_date: meta.tradeDate || header.tradeDate || '',
    market_report: get('1_analysts/market.md', 'market_report.md'),
    sentiment_report: get('1_analysts/sentiment.md', 'sentiment_report.md'),
    news_report: get('1_analysts/news.md', 'news_report.md'),
    fundamentals_report: get('1_analysts/fundamentals.md', 'fundamentals_report.md'),
    investment_debate_state: {
      bull_history: get('2_research/bull.md'),
      bear_history: get('2_research/bear.md'),
      history: '',
      current_response: '',
    },
    investment_plan: get('2_research/manager.md', 'investment_plan.md'),
    trader_investment_plan: get('3_trading/trader.md', 'trader_investment_plan.md'),
    risk_debate_state: {
      aggressive_history: get('4_risk/aggressive.md'),
      conservative_history: get('4_risk/conservative.md'),
      neutral_history: get('4_risk/neutral.md'),
      history: '',
    },
    final_trade_decision: get('5_portfolio/decision.md', 'final_trade_decision.md'),
  };
  return buildRun(state, { kind: 'report_tree', path: meta.path || null, generated: header.generated || null }, {
    ...meta,
    settings: header.settings || null,
  });
}

/** Files a report tree may contain, relative to its folder. */
export const REPORT_TREE_FILES = [
  'complete_report.md',
  '1_analysts/market.md', '1_analysts/sentiment.md', '1_analysts/news.md', '1_analysts/fundamentals.md',
  '2_research/bull.md', '2_research/bear.md', '2_research/manager.md',
  '3_trading/trader.md',
  '4_risk/aggressive.md', '4_risk/conservative.md', '4_risk/neutral.md',
  '5_portfolio/decision.md',
];
