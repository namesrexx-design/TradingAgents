/*
 * TradingAgents web dashboard: shared pieces.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 */
import { RATINGS, RATING_REVIEW } from '../data/adapter.js';

export function Eyebrow({ children, className = '' }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

const STATUS_LABEL = { pending: 'Waiting', in_progress: 'Working', completed: 'Done' };

export function StatusPill({ status }) {
  return (
    <span className={`status status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

/** The 5-tier scale with the run's rating filled; REVIEW fills none. */
export function RatingScale({ rating, onDark = false }) {
  return (
    <div className={`scale ${onDark ? 'scale-dark' : ''}`} role="img"
      aria-label={rating === RATING_REVIEW ? 'No readable rating: review' : `Rating ${rating} on a five-step scale`}>
      {RATINGS.map((r) => (
        <span key={r} className={`scale-step ${r === rating ? 'is-active' : ''}`}>{r}</span>
      ))}
    </div>
  );
}

export function RatingBadge({ rating }) {
  return <span className={`badge ${rating === RATING_REVIEW ? 'badge-outline' : ''}`}>{rating}</span>;
}

export function SampleBanner() {
  return (
    <div className="sample-banner" role="note">
      <strong>SAMPLE</strong>
      <span>Illustrative, not real analysis. DEMO is a fictional ticker; no model was called and no market data was read.</span>
    </div>
  );
}

export function KeyValue({ label, value, note }) {
  return (
    <div className="kv">
      <p className="kv-label">{label}</p>
      <p className="kv-value">{value ?? <span className="muted">Not provided</span>}</p>
      {note && <p className="kv-note">{note}</p>}
    </div>
  );
}

export function analystLabel(key) {
  return { market: 'Market', social: 'Sentiment', news: 'News', fundamentals: 'Fundamentals' }[key] || key;
}
