/*
 * TradingAgents web dashboard: entry point.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * Styling comes from the Refero Wealthsimple export, loaded as-is: tokens.css
 * here, and its Tailwind v4 @theme (tailwind.css) through styles/index.css.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../docs/design/refero/wealthsimple/tokens.css';
import './styles/index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
