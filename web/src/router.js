/*
 * TradingAgents web dashboard: hash routing helper.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 */
export function go(path) {
  window.location.hash = path;
}
