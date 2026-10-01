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
import { btn, button, card, cardTitle, container, focusRing, heading, headingLg } from '../components/recipes.js';

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
    <div className="min-w-0 border-t border-stone pt-16">
      <p className="mb-12 text-subheading font-medium">{title}</p>
      {mine.length === 0 && <p className="text-caption text-pebble">Waiting for the first argument.</p>}
      {mine.map((t, i) => (
        <div key={i} className="border-t border-stone py-12 text-caption leading-caption first-of-type:border-t-0 first-of-type:pt-0 motion-safe:animate-rise">
          <p className="mb-6 text-pebble">Turn {i + 1}</p>
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
      <section className="bg-paper-white py-80">
        <div className={container}>
          <Eyebrow>Live run</Eyebrow>
          <h1 className={`${heading} mb-16`}>The bridge is not running.</h1>
          <p className="text-subheading leading-subheading">
            This link follows a run on the local bridge. Start web/bridge/server.py, or <a className="underline" href="#/live">replay the sample</a>.
          </p>
        </div>
      </section>
    );
  }


  return (
    <section className="bg-paper-white pt-48 pb-80">
      <div className={container}>
        <div className="mb-32 flex flex-wrap items-end justify-between gap-24">
          <div className="min-w-0">
            <Eyebrow>{isLive ? 'Live run · streamed from the bridge' : 'Replay · rebuilt from a finished run'}</Eyebrow>
            <h1 className={`${headingLg} max-md:text-heading max-md:leading-heading`}>
              {state.ticker || replayRun?.ticker || '…'}
              <span className="font-normal text-pebble"> · {state.tradeDate || replayRun?.tradeDate || ''}</span>
            </h1>
          </div>
          {!isLive && (
            <div className="grid w-full grid-cols-2 gap-8 sm:flex sm:w-auto sm:flex-wrap" aria-label="Replay controls">
              <button type="button" className={`${btn('outline', 'sm')} ${focusRing}`} onClick={() => setPlaying((p) => !p)}
                disabled={!events || cursor >= events.length}>{playing ? 'Pause' : 'Resume'}</button>
              <button type="button" className={`${btn('outline', 'sm')} ${focusRing}`} onClick={() => setSpeed((s) => (s === 1 ? 4 : 1))}>Speed {speed}x</button>
              <button type="button" className={`${btn('outline', 'sm')} ${focusRing}`} onClick={skip} disabled={!events || cursor >= events.length}>Skip to end</button>
              <button type="button" className={`${btn('ghost', 'sm')} ${focusRing}`} onClick={restart} disabled={!events}>Restart</button>
            </div>
          )}
        </div>

        {sample && <SampleBanner className="mb-32" />}
        {loadError && <p className="mb-16 border-l border-graphite-ink pl-12 text-caption" role="alert">{loadError}</p>}
        {state.error && <p className="mb-16 border-l border-graphite-ink pl-12 text-caption" role="alert">{state.error}</p>}

        <div className="h-px overflow-hidden bg-stone" aria-label={`${done} of ${total} agents done`}>
          <div className="h-full bg-graphite-ink transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <p className="mt-8 mb-32 text-caption text-pebble">{done} of {total} agents done{state.done ? ' · run complete' : ''}</p>

        <div className="grid items-start gap-24 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Pipeline: a Soft Card Surface. On phones it follows the writing panel. */}
          <aside className={`${card} order-2 lg:sticky lg:top-24 lg:order-none`} aria-label="Pipeline">
            {groups.map((g) => (
              <div className="mb-24" key={g.team}>
                <p className="mb-4 text-caption text-pebble">{g.team}</p>
                <ul>
                  {g.agents.map((a) => (
                    <li key={a} className="flex items-center justify-between gap-12 border-b border-stone py-12">
                      <span className={state.agents[a] === 'in_progress' ? 'font-medium' : ''}>{a}</span>
                      <StatusPill status={state.agents[a] || 'pending'} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {state.done && (
              <div className="grid justify-items-start gap-12">
                <p className="text-caption text-pebble">Research rating</p>
                <RatingBadge rating={state.rating} />
                <a className={`${button.primary} ${focusRing}`} href={reportHref}>Open the report</a>
              </div>
            )}
          </aside>

          <div className="contents lg:grid lg:min-w-0 lg:gap-24">
            <div className={`${card} order-1 min-h-[280px] lg:order-none`}>
              <div className="mb-16 flex items-baseline justify-between gap-12">
                <p className={cardTitle}>{state.current ? state.current.title : 'Waiting for the first report'}</p>
                {state.current && <span className="text-caption text-pebble">{writing ? 'Writing…' : 'Filed'}</span>}
              </div>
              {state.current
                ? <><Markdown text={revealed} />{writing && <span aria-hidden="true" className="inline-block h-16 w-px bg-graphite-ink align-text-bottom" />}</>
                : <p className="text-pebble">The analysts start together. Their reports land here as each one files.</p>}
            </div>

            <div className={`${card} order-3 lg:order-none`}>
              <Eyebrow>Research debate</Eyebrow>
              <h2 className={`${cardTitle} mb-24`}>Bull vs. bear</h2>
              <div className="grid gap-32 md:grid-cols-2">
                <DebateColumn title="Bull researcher" speaker="Bull Analyst" turns={state.investTurns} />
                <DebateColumn title="Bear researcher" speaker="Bear Analyst" turns={state.investTurns} />
              </div>
            </div>

            <div className={`${card} order-3 lg:order-none`}>
              <Eyebrow>Risk debate</Eyebrow>
              <h2 className={`${cardTitle} mb-24`}>Three views on the trader&apos;s paper plan</h2>
              <div className="grid gap-24 xl:grid-cols-3">
                <DebateColumn title="Aggressive" speaker="Aggressive Analyst" turns={state.riskTurns} />
                <DebateColumn title="Conservative" speaker="Conservative Analyst" turns={state.riskTurns} />
                <DebateColumn title="Neutral" speaker="Neutral Analyst" turns={state.riskTurns} />
              </div>
            </div>

            <div className={`${card} order-3 lg:order-none`}>
              <Eyebrow>Activity</Eyebrow>
              <ol className="max-h-[260px] overflow-y-auto text-caption leading-caption" ref={logRef}>
                {state.log.map((l, i) => (
                  <li key={i} className="flex gap-12 border-b border-stone py-8">
                    <span className="w-[120px] shrink-0 text-pebble sm:w-[150px]">{l.agent}</span>
                    <span className="min-w-0 break-words">{l.content}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
