/*
 * TradingAgents web dashboard: live run view.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * Two sources, one view: a real run streamed from the bridge over SSE, or a
 * replay of a finished run (the SAMPLE run in preview) rebuilt into the same
 * events. Statuses follow the CLI's live panel in cli/run.py.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ANALYSTS, TEAMS } from '../data/adapter.js';
import { buildReplayEvents, initialLiveState, reduceLive, replayDelay } from '../data/replay.js';
import { subscribeRun } from '../data/source.js';
import Markdown from '../components/Markdown.jsx';
import { Eyebrow, RatingBadge, SampleBanner, StatusPill } from '../components/ui.jsx';

function liveReducer(state, action) {
  if (action.type === '__reset') return initialLiveState(action.analysts);
  return reduceLive(state, action);
}

/** Reveal text progressively so a filed section reads like it is being written. */
function useReveal(content, key, speed) {
  const [shown, setShown] = useState(0);
  useEffect(() => { setShown(0); }, [key]);
  useEffect(() => {
    if (!content || shown >= content.length) return undefined;
    const id = setTimeout(() => setShown((n) => Math.min(content.length, n + Math.ceil(14 * speed))), 16);
    return () => clearTimeout(id);
  }, [content, shown, speed]);
  return content ? content.slice(0, shown) : '';
}

function DebateColumn({ title, turns, speaker }) {
  const mine = turns.filter((t) => t.speaker === speaker);
  return (
    <div className="debate-col">
      <p className="debate-col-title">{title}</p>
      {mine.length === 0 && <p className="muted small">Waiting for the first argument.</p>}
      {mine.map((t, i) => (
        <div className="turn" key={i}>
          <p className="turn-meta">Turn {i + 1}</p>
          <Markdown text={t.text} />
        </div>
      ))}
    </div>
  );
}

export default function Live({ ctx, liveId }) {
  const { bridge, index, getRun } = ctx;
  const [state, dispatch] = useReducer(liveReducer, undefined, () => initialLiveState([]));
  const [events, setEvents] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [replayRun, setReplayRun] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const isLive = Boolean(liveId && bridge);
  const logRef = useRef(null);

  // Live: subscribe to the bridge.
  useEffect(() => {
    if (!isLive) return undefined;
    dispatch({ type: '__reset', analysts: [] });
    return subscribeRun(liveId, (ev) => dispatch(ev));
  }, [isLive, liveId]);

  // Replay: load the newest run in the index (the SAMPLE run in preview).
  useEffect(() => {
    if (isLive || !index?.runs?.length) return;
    let live = true;
    getRun(index.runs[0]).then((run) => {
      if (!live) return;
      setReplayRun(run);
      setEvents(buildReplayEvents(run));
      setCursor(0);
      dispatch({ type: '__reset', analysts: run.analysts.map((a) => a.key) });
    }).catch((e) => live && setLoadError(String(e.message || e)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, index]);

  // Replay clock.
  useEffect(() => {
    if (!events || !playing || cursor >= events.length) return undefined;
    const ev = events[cursor];
    const delay = cursor === 0 ? 300 : replayDelay(events[cursor - 1]) / speed;
    const id = setTimeout(() => { dispatch(ev); setCursor((c) => c + 1); }, delay);
    return () => clearTimeout(id);
  }, [events, cursor, playing, speed]);

  useEffect(() => {
    if (isLive && state.done) ctx.refreshIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, state.done]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  const restart = () => {
    if (!replayRun) return;
    dispatch({ type: '__reset', analysts: replayRun.analysts.map((a) => a.key) });
    setCursor(0);
    setPlaying(true);
  };
  const skip = () => {
    if (!events) return;
    for (let i = cursor; i < events.length; i += 1) dispatch(events[i]);
    setCursor(events.length);
  };

  const revealed = useReveal(state.current?.content || '', state.current?.key, speed);
  const writing = state.current && revealed.length < (state.current.content || '').length;

  const groups = useMemo(() => {
    const analystAgents = ANALYSTS.filter((a) => state.agents[a.agent]).map((a) => a.agent);
    return [{ team: 'Analyst team', agents: analystAgents }, ...TEAMS];
  }, [state.agents]);
  const total = Object.keys(state.agents).length || 1;
  const done = Object.values(state.agents).filter((s) => s === 'completed').length;
  const sample = !isLive && (replayRun?.isSample ?? index?.sample);
  const reportHref = state.ticker && state.tradeDate ? `#/report/${encodeURIComponent(state.ticker)}/${state.tradeDate}` : '#/report';

  if (liveId && bridge === null) {
    return (
      <section className="section"><div className="container">
        <Eyebrow>Live run</Eyebrow>
        <h1 className="heading">The bridge is not running.</h1>
        <p className="lede">This link follows a run on the local bridge. Start web/bridge/server.py, or <a href="#/live">replay the sample</a>.</p>
      </div></section>
    );
  }

  return (
    <section className="section section-tight">
      <div className="container">
        <div className="page-head">
          <div>
            <Eyebrow>{isLive ? 'Live run · streamed from the bridge' : 'Replay · rebuilt from a finished run'}</Eyebrow>
            <h1 className="heading">
              {state.ticker || replayRun?.ticker || '…'}
              <span className="heading-soft"> · {state.tradeDate || replayRun?.tradeDate || ''}</span>
            </h1>
          </div>
          {!isLive && (
            <div className="controls" aria-label="Replay controls">
              <button type="button" className="btn btn-small btn-outline" onClick={() => setPlaying((p) => !p)}
                disabled={!events || cursor >= events.length}>{playing ? 'Pause' : 'Resume'}</button>
              <button type="button" className="btn btn-small btn-outline" onClick={() => setSpeed((s) => (s === 1 ? 4 : 1))}>
                Speed {speed}x</button>
              <button type="button" className="btn btn-small btn-outline" onClick={skip} disabled={!events || cursor >= events.length}>Skip to end</button>
              <button type="button" className="btn btn-small btn-ghost" onClick={restart} disabled={!events}>Restart</button>
            </div>
          )}
        </div>

        {sample && <SampleBanner />}
        {loadError && <p className="run-error" role="alert">{loadError}</p>}
        {state.error && <p className="run-error" role="alert">{state.error}</p>}

        <div className="progress" aria-label={`${done} of ${total} agents done`}>
          <div className="progress-bar" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <p className="progress-label">{done} of {total} agents done{state.done ? ' · run complete' : ''}</p>

        <div className="live-grid">
          <aside className="pipeline" aria-label="Pipeline">
            {groups.map((g) => (
              <div className="pipeline-group" key={g.team}>
                <p className="pipeline-team">{g.team}</p>
                <ul>
                  {g.agents.map((a) => (
                    <li key={a} className={`pipeline-row ${state.agents[a] === 'in_progress' ? 'is-working' : ''}`}>
                      <span>{a}</span>
                      <StatusPill status={state.agents[a] || 'pending'} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {state.done && (
              <div className="pipeline-done">
                <p className="pipeline-team">Research rating</p>
                <p className="pipeline-rating"><RatingBadge rating={state.rating} /></p>
                <a className="btn btn-primary btn-block" href={reportHref}>Open the report</a>
              </div>
            )}
          </aside>

          <div className="live-main">
            <div className="panel now">
              <div className="panel-head">
                <p className="panel-title">{state.current ? state.current.title : 'Waiting for the first report'}</p>
                {state.current && <span className="muted small">{writing ? 'Writing…' : 'Filed'}</span>}
              </div>
              {state.current
                ? <Markdown text={revealed} className={writing ? 'is-writing' : ''} />
                : <p className="muted">The analysts start together. Their reports land here as each one files.</p>}
            </div>

            <div className="block">
              <Eyebrow>Research debate</Eyebrow>
              <h2 className="subheading">Bull vs. bear</h2>
              <div className="debate">
                <DebateColumn title="Bull researcher" speaker="Bull Analyst" turns={state.investTurns} />
                <DebateColumn title="Bear researcher" speaker="Bear Analyst" turns={state.investTurns} />
              </div>
            </div>

            <div className="block">
              <Eyebrow>Risk debate</Eyebrow>
              <h2 className="subheading">Three views on the trader's paper plan</h2>
              <div className="debate debate-3">
                <DebateColumn title="Aggressive" speaker="Aggressive Analyst" turns={state.riskTurns} />
                <DebateColumn title="Conservative" speaker="Conservative Analyst" turns={state.riskTurns} />
                <DebateColumn title="Neutral" speaker="Neutral Analyst" turns={state.riskTurns} />
              </div>
            </div>

            <div className="block">
              <Eyebrow>Activity</Eyebrow>
              <ol className="log" ref={logRef}>
                {state.log.map((l, i) => (
                  <li key={i}><span className="log-agent">{l.agent}</span><span className="log-text">{l.content}</span></li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
