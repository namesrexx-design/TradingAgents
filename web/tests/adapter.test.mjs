/*
 * TradingAgents web dashboard: adapter tests (node --test, no dependencies).
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractRating, fromReportTree, fromStateLog, parseLabeledFields, parseSentimentHeader,
  splitTurns, SAMPLE_MARKER,
} from '../src/data/adapter.js';
import { buildReplayEvents } from '../src/data/replay.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '../public');
const index = JSON.parse(fs.readFileSync(path.join(pub, 'sample/index.json'), 'utf8'));

function loadBoth(entry) {
  const json = JSON.parse(fs.readFileSync(path.join(pub, entry.state_log), 'utf8'));
  const files = Object.fromEntries(entry.report_files.map((f) => [f, fs.readFileSync(path.join(pub, entry.report_dir, f), 'utf8')]));
  return { json, fromJson: fromStateLog(json), fromTree: fromReportTree(files) };
}

test('the sample state logs carry exactly the keys _log_state() writes', () => {
  const keys = [
    'company_of_interest', 'trade_date', 'market_report', 'sentiment_report', 'news_report',
    'fundamentals_report', 'investment_debate_state', 'trader_investment_plan', 'risk_debate_state',
    'investment_plan', 'final_trade_decision', 'final_rating', 'run_settings',
  ];
  for (const entry of index.runs) {
    const { json } = loadBoth(entry);
    assert.deepEqual(Object.keys(json), keys);
    assert.deepEqual(Object.keys(json.investment_debate_state), ['bull_history', 'bear_history', 'history', 'current_response']);
    assert.deepEqual(Object.keys(json.risk_debate_state), ['aggressive_history', 'conservative_history', 'neutral_history', 'history']);
  }
});

test('every non-empty text field in the sample is marked SAMPLE', () => {
  for (const entry of index.runs) {
    const { json } = loadBoth(entry);
    const texts = [
      json.market_report, json.sentiment_report, json.news_report, json.fundamentals_report,
      ...Object.values(json.investment_debate_state), ...Object.values(json.risk_debate_state),
      json.investment_plan, json.trader_investment_plan, json.final_trade_decision,
    ].filter(Boolean);
    for (const t of texts) assert.ok(t.includes(SAMPLE_MARKER), t.slice(0, 60));
    assert.match(json.run_settings.llm_provider, /SAMPLE/);
    assert.equal(json.company_of_interest, 'DEMO');
  }
});

test('state log and report tree adapt to the same run', () => {
  for (const entry of index.runs) {
    const { fromJson, fromTree } = loadBoth(entry);
    assert.equal(fromTree.ticker, fromJson.ticker);
    assert.equal(fromTree.tradeDate, fromJson.tradeDate);
    assert.equal(fromTree.rating, fromJson.rating);
    assert.deepEqual(fromTree.decision, fromJson.decision);
    assert.deepEqual(fromTree.traderPlan, fromJson.traderPlan);
    assert.deepEqual(fromTree.researchPlan, fromJson.researchPlan);
    assert.deepEqual(fromTree.debate.turns, fromJson.debate.turns);
    assert.deepEqual(fromTree.risk.turns, fromJson.risk.turns);
    assert.deepEqual(fromTree.analysts.map((a) => a.key), fromJson.analysts.map((a) => a.key));
    assert.deepEqual(fromTree.settings.analysts, fromJson.settings.analysts);
    assert.ok(fromJson.isSample && fromTree.isSample);
  }
});

test('labeled fields follow schemas.py render helpers', () => {
  const f = parseLabeledFields('**Action**: Buy\n\n**Reasoning**: Because.\n\n**Entry Price**: not provided\n\nFINAL TRANSACTION PROPOSAL: **BUY**');
  assert.equal(f.Action, 'Buy');
  assert.equal(f.Reasoning, 'Because.');
  assert.equal(f['Entry Price'], 'not provided');
  assert.equal(f['FINAL TRANSACTION PROPOSAL'], 'BUY');
});

test('rating extraction mirrors rating.py', () => {
  assert.equal(extractRating('**Rating**: Overweight\n\nConsensus rating: Buy'), 'Overweight');
  assert.equal(extractRating('Rating Scale: Buy, Hold, Sell'), null);
  assert.equal(extractRating('We think it is not a Sell'), null);
  assert.equal(fromStateLog({ company_of_interest: 'X', trade_date: '2026-01-01', final_trade_decision: 'no label' }).rating, 'REVIEW');
});

test('debate turns and sentiment header', () => {
  const turns = splitTurns('\nBull Analyst: up\nmore\nBear Analyst: down', ['Bull Analyst', 'Bear Analyst']);
  assert.deepEqual(turns, [{ speaker: 'Bull Analyst', text: 'up\nmore' }, { speaker: 'Bear Analyst', text: 'down' }]);
  assert.deepEqual(parseSentimentHeader('**Overall Sentiment:** **Mixed** (Score: 5.4/10)\n**Confidence:** Medium'),
    { band: 'Mixed', score: 5.4, confidence: 'Medium' });
});

test('a replay ends with the run rating and visits every agent', () => {
  const { fromJson } = loadBoth(index.runs[0]);
  const events = buildReplayEvents(fromJson);
  assert.equal(events.at(-1).type, 'run_completed');
  assert.equal(events.at(-1).rating, fromJson.rating);
  const done = new Set(events.filter((e) => e.type === 'agent_status' && e.status === 'completed').map((e) => e.agent));
  for (const agent of ['Market Analyst', 'Bull Researcher', 'Bear Researcher', 'Research Manager', 'Trader', 'Portfolio Manager']) {
    assert.ok(done.has(agent), agent);
  }
});
