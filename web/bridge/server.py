"""TradingAgents web dashboard: server-side bridge (stub).

Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
(see LICENSE and NOTICE at the repository root).

Not run as part of this change: it documents, in working shape, how the web
dashboard starts a ``TradingAgentsGraph`` run and streams its state. It follows
``cli/run.py`` step for step, so a run started here writes the same files the
CLI does:

- the state log, ``<results_dir>/<TICKER>/TradingAgentsStrategy_logs/full_states_log_<date>.json``
- the report tree, ``<results_dir>/reports/<TICKER>_<stamp>/...``
- the memory-log entry used by later runs of the same ticker

Research tool. Not financial advice. No orders are placed: nothing here talks
to a broker, and the trader's "proposal" is text in a report.

Keys stay on the server. Provider keys are read from the repository ``.env``
(see ``.env.example``) by ``python-dotenv``; the browser only ever learns
whether the configured provider has one.

Run it (Python 3.11+, from the repository root)::

    pip install .                       # the framework
    pip install -r web/bridge/requirements.txt
    python -m uvicorn web.bridge.server:app --host 127.0.0.1 --port 8765
    cd web && npm install && npm run dev  # Vite proxies /api to :8765

HTTP API (consumed by web/src/data/source.js):

- ``GET  /api/health``                 ``{ok, provider, key_configured}``
- ``GET  /api/runs``                   ``{runs: [{ticker, trade_date, rating, analysts, state_log, report_dir, report_files}]}``
- ``GET  /api/runs/{ticker}/{date}``   the state log JSON, unchanged
- ``GET  /api/reports/{dir}/{file}``   one markdown file of a saved report tree
- ``POST /api/live``                   ``{ticker, trade_date, analysts, research_depth}`` -> ``{run_id}``
- ``GET  /api/live/{run_id}/events``   Server-Sent Events, one JSON event per message,
  in the protocol documented in web/src/data/replay.js
"""

from __future__ import annotations

import asyncio
import json
import os
import queue
import threading
import uuid
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")  # before DEFAULT_CONFIG reads TRADINGAGENTS_* overrides

from tradingagents.agents.rating import run_rating  # noqa: E402
from tradingagents.dataflows.symbols import safe_ticker_component  # noqa: E402
from tradingagents.default_config import build_default_config  # noqa: E402
from tradingagents.graph.analyst_execution import build_analyst_execution_plan  # noqa: E402
from tradingagents.graph.trading_graph import TradingAgentsGraph, _validate_trade_date  # noqa: E402
from tradingagents.llm_clients.api_key_env import get_api_key_env  # noqa: E402

ANALYST_ORDER = ["market", "social", "news", "fundamentals"]
INVEST_SPEAKERS = ("Bull Analyst", "Bear Analyst")
RISK_SPEAKERS = ("Aggressive Analyst", "Conservative Analyst", "Neutral Analyst")

app = FastAPI(title="TradingAgents dashboard bridge", docs_url=None, redoc_url=None)

# One run at a time: TradingAgentsGraph sets a process-wide dataflow config.
_RUN_LOCK = threading.Lock()
_RUNS: dict[str, queue.Queue] = {}


def _config() -> dict:
    return build_default_config()


def _key_configured(config: dict) -> bool:
    env = get_api_key_env(config["llm_provider"])
    # Providers with no key (ollama, bedrock's credential chain) count as configured.
    return env is None or bool(os.environ.get(env))


def _results_dir() -> Path:
    return Path(_config()["results_dir"])


def _redact(text: str) -> str:
    """Never echo a secret back to the browser, even inside a provider error."""
    for name, value in os.environ.items():
        if value and len(value) >= 12 and ("KEY" in name or "TOKEN" in name or "SECRET" in name):
            text = text.replace(value, "[redacted]")
    return text


# ---------------------------------------------------------------- read side

@app.get("/api/health")
def health():
    config = _config()
    return {"ok": True, "provider": config["llm_provider"], "key_configured": _key_configured(config)}


@app.get("/api/runs")
def list_runs():
    root = _results_dir()
    reports = sorted((root / "reports").glob("*_*"), reverse=True) if (root / "reports").is_dir() else []
    runs = []
    for log in sorted(root.glob("*/TradingAgentsStrategy_logs/full_states_log_*.json"), reverse=True):
        try:
            data = json.loads(log.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        ticker, date = data.get("company_of_interest", ""), data.get("trade_date", "")
        # The newest saved report tree for this ticker, if any (its folder has no date in it).
        tree = next((d for d in reports if d.name.startswith(f"{ticker}_")), None)
        runs.append({
            "ticker": ticker,
            "trade_date": date,
            "rating": data.get("final_rating") or run_rating(data),
            "analysts": (data.get("run_settings") or {}).get("analysts", []),
            "state_log": f"/api/runs/{ticker}/{date}",
            "report_dir": f"/api/reports/{tree.name}" if tree else None,
            "report_files": sorted(p.relative_to(tree).as_posix() for p in tree.rglob("*.md")) if tree else [],
        })
    runs.sort(key=lambda r: (r["trade_date"], r["ticker"]), reverse=True)
    return {"runs": runs}


@app.get("/api/runs/{ticker}/{date}")
def get_run(ticker: str, date: str):
    try:
        ticker = safe_ticker_component(ticker)
        date = _validate_trade_date(date)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    path = _results_dir() / ticker / "TradingAgentsStrategy_logs" / f"full_states_log_{date}.json"
    if not path.is_file():
        raise HTTPException(404, "No state log for that ticker and date")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/reports/{folder}/{file_path:path}", response_class=PlainTextResponse)
def get_report_file(folder: str, file_path: str):
    base = (_results_dir() / "reports").resolve()
    target = (base / folder / file_path).resolve()
    if base not in target.parents or target.suffix != ".md" or not target.is_file():
        raise HTTPException(404, "Not a report file")
    return target.read_text(encoding="utf-8")


# ---------------------------------------------------------------- run side

class RunRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=32)
    trade_date: str
    analysts: list[Literal["market", "social", "news", "fundamentals"]] = Field(min_length=1)
    research_depth: Literal[1, 3, 5] = 1


def _new_turns(history: str, seen: int, speakers: tuple[str, ...]) -> tuple[list[tuple[str, str]], int]:
    """Turns appended to a debate history since ``seen`` characters."""
    fresh = history[seen:]
    turns, current = [], None
    for line in fresh.split("\n"):
        head = next((s for s in speakers if line.startswith(f"{s}:")), None)
        if head:
            current = [head, line[len(head) + 1:].lstrip()]
            turns.append(current)
        elif current is not None:
            current[1] += "\n" + line
    return [(s, t.strip()) for s, t in turns], len(history)


def _run_worker(run_id: str, req: RunRequest, ticker: str, emit) -> None:
    try:
        config = _config()
        config["max_debate_rounds"] = req.research_depth
        config["max_risk_discuss_rounds"] = req.research_depth
        analysts = [a for a in ANALYST_ORDER if a in set(req.analysts)]
        plan = build_analyst_execution_plan(analysts)
        graph = TradingAgentsGraph(analysts, config=config, debug=False)

        emit({"type": "run_started", "ticker": ticker, "trade_date": req.trade_date, "analysts": analysts})
        for spec in plan.specs:
            emit({"type": "agent_status", "agent": spec.agent_node, "status": "in_progress"})

        # Same initial state propagate() and the CLI build: memory log, identity.
        # Crypto tickers would pass asset_type="crypto", as the CLI detects.
        init_state = graph.create_run_state(ticker, req.trade_date)
        args = graph.propagator.get_graph_args()

        filed: set[str] = set()
        seen_invest = seen_risk = 0
        final_state: dict = {}
        for messages, chunk in graph.stream_run(init_state, **args):
            for message in messages:
                for call in getattr(message, "tool_calls", None) or []:
                    name = call["name"] if isinstance(call, dict) else call.name
                    emit({"type": "message", "agent": "Tool", "content": f"{name} called"})
            if chunk is None:
                continue

            for spec in plan.specs:
                if chunk.get(spec.report_key) and spec.report_key not in filed:
                    filed.add(spec.report_key)
                    emit({"type": "report", "key": spec.report_key, "agent": spec.agent_node, "content": chunk[spec.report_key]})
                    emit({"type": "agent_status", "agent": spec.agent_node, "status": "completed"})

            debate = chunk.get("investment_debate_state") or {}
            turns, seen_invest = _new_turns(debate.get("history", ""), seen_invest, INVEST_SPEAKERS)
            for speaker, text in turns:
                agent = "Bull Researcher" if speaker == "Bull Analyst" else "Bear Researcher"
                emit({"type": "agent_status", "agent": agent, "status": "in_progress"})
                emit({"type": "debate_turn", "debate": "investment", "speaker": speaker, "content": text})

            for key, agent, after in (
                ("investment_plan", "Research Manager", "Trader"),
                ("trader_investment_plan", "Trader", "Aggressive Analyst"),
            ):
                if chunk.get(key) and key not in filed:
                    filed.add(key)
                    if key == "investment_plan":
                        for a in ("Bull Researcher", "Bear Researcher"):
                            emit({"type": "agent_status", "agent": a, "status": "completed"})
                    emit({"type": "report", "key": key, "agent": agent, "content": chunk[key]})
                    emit({"type": "agent_status", "agent": agent, "status": "completed"})
                    emit({"type": "agent_status", "agent": after, "status": "in_progress"})

            risk = chunk.get("risk_debate_state") or {}
            turns, seen_risk = _new_turns(risk.get("history", ""), seen_risk, RISK_SPEAKERS)
            for speaker, text in turns:
                emit({"type": "agent_status", "agent": speaker, "status": "in_progress"})
                emit({"type": "debate_turn", "debate": "risk", "speaker": speaker, "content": text})

            if chunk.get("final_trade_decision") and "final_trade_decision" not in filed:
                filed.add("final_trade_decision")
                for a in RISK_SPEAKERS:
                    emit({"type": "agent_status", "agent": a, "status": "completed"})
                emit({"type": "report", "key": "final_trade_decision", "agent": "Portfolio Manager",
                      "content": chunk["final_trade_decision"]})
                emit({"type": "agent_status", "agent": "Portfolio Manager", "status": "completed"})

            final_state.update(chunk)

        # Same tail as the CLI: state log + memory log, then the report tree.
        graph.record_decision(ticker, req.trade_date, final_state)
        graph.save_reports(final_state, ticker)
        emit({"type": "run_completed", "ticker": ticker, "trade_date": req.trade_date, "rating": run_rating(final_state)})
    except Exception as exc:  # report, never crash the server
        emit({"type": "error", "message": _redact(f"{type(exc).__name__}: {exc}")})
    finally:
        emit(None)
        _RUN_LOCK.release()


@app.post("/api/live")
def start_live(req: RunRequest):
    try:
        ticker = safe_ticker_component(req.ticker.strip().upper())
        _validate_trade_date(req.trade_date)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    if not _key_configured(_config()):
        raise HTTPException(503, "No API key for the configured provider in the server's .env")
    if not _RUN_LOCK.acquire(blocking=False):
        raise HTTPException(409, "A run is already in progress")
    run_id = uuid.uuid4().hex
    events: queue.Queue = queue.Queue()
    _RUNS[run_id] = events
    threading.Thread(target=_run_worker, args=(run_id, req, ticker, events.put), daemon=True).start()
    return {"run_id": run_id}


@app.get("/api/live/{run_id}/events")
async def live_events(run_id: str):
    events = _RUNS.get(run_id)
    if events is None:
        raise HTTPException(404, "Unknown run")

    async def stream():
        while True:
            event = await asyncio.to_thread(events.get)
            if event is None:
                _RUNS.pop(run_id, None)
                break
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
