/*
 * TradingAgents web dashboard: entry point.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * Styling comes from the Refero Wealthsimple export, loaded as-is: every color,
 * font family, radius and spacing value in app.css is a var() from tokens.css.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../docs/design/refero/wealthsimple/tokens.css';
import './styles/fonts.css';
import './styles/app.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
