<!-- TradingAgents web dashboard. Modified by BizBox: added web dashboard. Apache-2.0. -->
# TradingAgents web dashboard

Research tool. Not financial advice. No orders are placed. There is no broker integration.

A browser view of TradingAgents runs: run setup, a live run view (each agent's
stage, its output, the bull vs. bear and risk debates), the final report, and
past runs. Styled from the Refero Wealthsimple export in
`docs/design/refero/wealthsimple/`.

## Styling: what comes from the export, what is ours

- **Straight from the export's code** (`docs/design/refero/wealthsimple/`, unchanged): `tokens.css`
  (loaded in `src/main.jsx`) and `tailwind.css`, the Tailwind v4 `@theme`, imported verbatim in
  `src/styles/index.css`. Every color, font, size, spacing and radius utility the components use
  (`bg-bronze-field`, `text-graphite-ink`, `font-tiempos`, `text-display`, `p-32`, `rounded-full` = 100px,
  `rounded-full-2` = 1600px) is generated from it.
- **Ours, implementing DESIGN.md's written specs** (the export ships no component source):
  `src/styles/theme-extensions.css` (letter-spacings and a line-height DESIGN.md states in prose, the
  page max-width alias, the line-draw animation), `src/components/recipes.js` (nav, pill buttons,
  soft cards, inputs, eyebrows, feature columns, each quoting its spec), the screens, and the
  sculpture in `scripts/hero-scene.html` (three.js), rendered to `art/*.png` (lossless) and
  `src/assets/*.webp` by `npm run render:hero`.
- Fonts: DESIGN.md's substitutes (Source Serif 4, Inter) registered under the export's family names
  in `src/styles/fonts.css`.

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
