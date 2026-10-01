/*
 * TradingAgents web dashboard: run events.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * One event protocol for both sources of a live view:
 *   - the bridge (web/bridge/server.py) streams these over SSE while a real
 *     TradingAgentsGraph.stream_run() is in progress;
 *   - buildReplayEvents() rebuilds them from a finished run, so the SAMPLE run
 *     can be replayed with no server, no Python and no keys.
 *
 * Events:
 *   { type: 'run_started', ticker, trade_date, analysts }
 *   { type: 'agent_status', agent, status: 'in_progress' | 'completed' }
 *   { type: 'report', key, agent, content }         a state field was filed
 *   { type: 'debate_turn', debate: 'investment' | 'risk', speaker, content }
 *   { type: 'message', agent, content }              a log line (tool call, note)
 *   { type: 'run_completed', ticker, trade_date, rating }
 *   { type: 'error', message }
 */
import { ANALYSTS } from './adapter.js';

const RISK_AGENT = {
  'Aggressive Analyst': 'Aggressive Analyst',
  'Conservative Analyst': 'Conservative Analyst',
  'Neutral Analyst': 'Neutral Analyst',
};

/** Initial live-view state for a run with these analysts. */
export function initialLiveState(analystKeys = []) {
  const agents = {};
  for (const a of ANALYSTS) if (analystKeys.includes(a.key)) agents[a.agent] = 'pending';
  for (const name of ['Bull Researcher', 'Bear Researcher', 'Research Manager', 'Trader',
    'Aggressive Analyst', 'Conservative Analyst', 'Neutral Analyst', 'Portfolio Manager']) agents[name] = 'pending';
  return {
    ticker: '', tradeDate: '', analysts: analystKeys, agents,
    reports: {}, investTurns: [], riskTurns: [], log: [],
    current: null, done: false, rating: null, error: null,
  };
}

/** Fold one event into the live-view state. */
export function reduceLive(state, ev) {
  switch (ev.type) {
    case 'run_started':
      return { ...initialLiveState(ev.analysts), ticker: ev.ticker, tradeDate: ev.trade_date,
        log: [{ agent: 'System', content: `Analyzing ${ev.ticker} as of ${ev.trade_date}` }] };
    case 'agent_status':
      return { ...state, agents: { ...state.agents, [ev.agent]: ev.status } };
    case 'report':
      return { ...state, reports: { ...state.reports, [ev.key]: ev.content },
        log: [...state.log, { agent: ev.agent, content: `Filed ${ev.key}` }].slice(-80),
        current: { agent: ev.agent, title: ev.agent, content: ev.content, key: `${ev.key}:${ev.content.length}` } };
    case 'debate_turn': {
      const turn = { speaker: ev.speaker, text: ev.content };
      const key = ev.debate === 'risk' ? 'riskTurns' : 'investTurns';
      return { ...state, [key]: [...state[key], turn],
        log: [...state.log, { agent: ev.speaker, content: `${ev.debate === 'risk' ? 'Risk' : 'Research'} debate, turn ${state[key].length + 1}` }].slice(-80),
        current: { agent: ev.speaker, title: ev.speaker, content: ev.content, key: `${ev.speaker}:${state[key].length}` } };
    }
    case 'message':
      return { ...state, log: [...state.log, { agent: ev.agent, content: ev.content }].slice(-80) };
    case 'run_completed':
      return { ...state, done: true, rating: ev.rating,
        log: [...state.log, { agent: 'System', content: `Completed. Research rating: ${ev.rating}` }] };
    case 'error':
      return { ...state, error: ev.message, log: [...state.log, { agent: 'System', content: `Error: ${ev.message}` }] };
    default:
      return state;
  }
}

/** Rebuild a finished run's event stream, in the order the graph produces it. */
export function buildReplayEvents(run) {
  const keys = run.analysts.map((a) => a.key);
  const ev = [];
  ev.push({ type: 'run_started', ticker: run.ticker, trade_date: run.tradeDate, analysts: keys });
  // The analysts start together (setup.py adds an edge from START to each).
  for (const a of run.analysts) {
    ev.push({ type: 'agent_status', agent: a.agent, status: 'in_progress' });
    ev.push({ type: 'message', agent: a.agent, content: 'Started (replay: no tools are called)' });
  }
  for (const a of run.analysts) {
    ev.push({ type: 'report', key: a.reportKey, agent: a.agent, content: a.body });
    ev.push({ type: 'agent_status', agent: a.agent, status: 'completed' });
  }
  // Research debate: Bull opens, then they alternate; the manager judges.
  for (const turn of run.debate.turns) {
    const agent = turn.speaker === 'Bull Analyst' ? 'Bull Researcher' : 'Bear Researcher';
    ev.push({ type: 'agent_status', agent, status: 'in_progress' });
    ev.push({ type: 'debate_turn', debate: 'investment', speaker: turn.speaker, content: turn.text });
  }
  ev.push({ type: 'agent_status', agent: 'Bull Researcher', status: 'completed' });
  ev.push({ type: 'agent_status', agent: 'Bear Researcher', status: 'completed' });
  ev.push({ type: 'agent_status', agent: 'Research Manager', status: 'in_progress' });
  if (run.researchPlan.raw) ev.push({ type: 'report', key: 'investment_plan', agent: 'Research Manager', content: run.researchPlan.raw });
  ev.push({ type: 'agent_status', agent: 'Research Manager', status: 'completed' });
  ev.push({ type: 'agent_status', agent: 'Trader', status: 'in_progress' });
  if (run.traderPlan.raw) ev.push({ type: 'report', key: 'trader_investment_plan', agent: 'Trader', content: run.traderPlan.raw });
  ev.push({ type: 'agent_status', agent: 'Trader', status: 'completed' });
  // Risk debate: Aggressive, Conservative, Neutral, repeating.
  for (const turn of run.risk.turns) {
    const agent = RISK_AGENT[turn.speaker];
    ev.push({ type: 'agent_status', agent, status: 'in_progress' });
    ev.push({ type: 'debate_turn', debate: 'risk', speaker: turn.speaker, content: turn.text });
  }
  for (const agent of Object.values(RISK_AGENT)) ev.push({ type: 'agent_status', agent, status: 'completed' });
  ev.push({ type: 'agent_status', agent: 'Portfolio Manager', status: 'in_progress' });
  if (run.decision.raw) ev.push({ type: 'report', key: 'final_trade_decision', agent: 'Portfolio Manager', content: run.decision.raw });
  ev.push({ type: 'agent_status', agent: 'Portfolio Manager', status: 'completed' });
  ev.push({ type: 'run_completed', ticker: run.ticker, trade_date: run.tradeDate, rating: run.rating });
  return ev;
}

/** How long the replay lingers after an event, in ms at 1x. */
export function replayDelay(ev) {
  if (ev.type === 'report' || ev.type === 'debate_turn') return 900 + Math.min(2600, (ev.content || '').length * 2.5);
  if (ev.type === 'agent_status') return 260;
  return 160;
}
