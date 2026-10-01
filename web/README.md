<!-- TradingAgents web dashboard. Modified by BizBox: added web dashboard. Apache-2.0. -->
# TradingAgents web dashboard

Research tool. Not financial advice. No orders are placed. There is no broker integration.

A browser view of TradingAgents runs: run setup, a live run view (each agent's
stage, its output, the bull vs. bear and risk debates), the final report, and
past runs. Styled from the Refero Wealthsimple export in
`docs/design/refero/wealthsimple/` (`tokens.css` is imported as-is).

## Preview (no Python, no keys)

```bash
cd web
npm install
npm run build && npm run preview   # or: npm run dev
```

Without the bridge the app shows the bundled SAMPLE runs in `public/sample/`:
a fictional ticker, `DEMO`, with every field marked
"SAMPLE — illustrative, not real analysis". The live view replays the sample.

## What it reads

| Written by | Path | Adapter |
|---|---|---|
| `TradingAgentsGraph._log_state()` | `<results_dir>/<TICKER>/TradingAgentsStrategy_logs/full_states_log_<date>.json` | `fromStateLog()` |
| `reporting.write_report_tree()` | `<results_dir>/reports/<TICKER>_<stamp>/1_analysts/*.md … complete_report.md` | `fromReportTree()` |
| CLI live sections (`cli/run.py`) | `<results_dir>/<TICKER>/<date>/reports/*_report.md` | `fromReportTree()` |

`results_dir` defaults to `~/.tradingagents/logs` (`TRADINGAGENTS_RESULTS_DIR` overrides it).
`npm test` checks the adapter against the sample; `npm run sample:reports`
rebuilds the sample report trees from the sample state logs with a port of
`write_report_tree()`.

## Running live

`bridge/server.py` is a FastAPI stub (not run in this change). With Python 3.11+:

```bash
pip install .                                   # from the repo root
pip install -r web/bridge/requirements.txt
cp .env.example .env                            # add your provider key here, server-side only
python -m uvicorn web.bridge.server:app --host 127.0.0.1 --port 8765
cd web && npm run dev                           # Vite proxies /api to the bridge
```

The browser never sees a key: `/api/health` only says whether the configured
provider has one. Runs write the same state log and report tree as the CLI.
