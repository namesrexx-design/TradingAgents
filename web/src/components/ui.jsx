/*
 * TradingAgents web dashboard: shared pieces.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * Styled only with utilities generated from the export's Tailwind @theme
 * (docs/design/refero/wealthsimple/tailwind.css) and theme-extensions.css.
 */
import { RATINGS, RATING_REVIEW } from '../data/adapter.js';
import heroArt from '../assets/hero-ribbon.webp';
import { badge, container, eyebrow, eyebrowOnDark } from './recipes.js';

export function Eyebrow({ children, onDark = false, className = '' }) {
  return <p className={`${onDark ? eyebrowOnDark : eyebrow} ${className}`}>{children}</p>;
}

const STATUS = {
  pending: { label: 'Waiting', cls: 'border-stone text-pebble bg-paper-white' },
  in_progress: { label: 'Working', cls: 'border-graphite-ink text-graphite-ink bg-paper-white' },
  completed: { label: 'Done', cls: 'border-charcoal bg-charcoal text-paper-white' },
};

export function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-6 rounded-full-2 border py-4 px-12 text-caption leading-control whitespace-nowrap ${s.cls}`}>
      <span aria-hidden="true" className={`size-6 rounded-full-2 bg-current ${status === 'in_progress' ? 'animate-pulse-dot motion-reduce:animate-none' : ''}`} />
      {s.label}
    </span>
  );
}

/** The 5-tier scale as pills, the run's rating filled; REVIEW fills none. */
export function RatingScale({ rating, onDark = false }) {
  return (
    <div className="flex flex-wrap gap-8" role="img"
      aria-label={rating === RATING_REVIEW ? 'No readable rating: review' : `Rating ${rating} on a five-step scale`}>
      {RATINGS.map((r) => {
        const on = r === rating;
        const cls = onDark
          ? (on ? 'bg-paper-white border-paper-white text-graphite-ink' : 'border-paper-white/40 text-paper-white/80')
          : (on ? 'bg-charcoal border-charcoal text-paper-white' : 'border-stone text-pebble');
        return <span key={r} className={`${badge} ${cls}`}>{r}</span>;
      })}
    </div>
  );
}

export function RatingBadge({ rating }) {
  const review = rating === RATING_REVIEW;
  return <span className={`${badge} ${review ? 'border-graphite-ink text-graphite-ink' : 'bg-charcoal border-charcoal text-paper-white'}`}>{rating}</span>;
}

export function SampleBanner({ className = '' }) {
  return (
    <div role="note" className={`flex flex-wrap items-baseline gap-x-12 gap-y-4 rounded-xl md:rounded-full-2 bg-fog-veil py-12 px-24 text-caption leading-caption ${className}`}>
      <strong className="font-wealthsimple-sans font-medium tracking-control">SAMPLE</strong>
      <span>Illustrative, not real analysis. DEMO is a fictional ticker; no model was called and no market data was read.</span>
    </div>
  );
}

/* A Feature Column with Top Divider holding one label and one value. */
export function KeyValue({ label, value, note }) {
  return (
    <div className="min-w-0 border-t border-stone pt-12">
      <p className="mb-4 text-caption leading-caption text-pebble">{label}</p>
      <p className="font-the-future font-medium text-heading-sm leading-heading-sm break-words">
        {value ?? <span className="text-body font-normal text-pebble">Not provided</span>}
      </p>
      {note && <p className="mt-4 text-caption text-pebble">{note}</p>}
    </div>
  );
}

export function analystLabel(key) {
  return { market: 'Market', social: 'Sentiment', news: 'News', fundamentals: 'Fundamentals' }[key] || key;
}

/*
 * DESIGN.md "Agent Prompt Guide" #4, Bronze Field hero: "full-bleed background
 * in Bronze Field, 80–120px vertical padding. Left-aligned at ~40%
 * width … Right side: a large sculptural 3D form … floating on the right with
 * soft warm ambient shadow." The 3D form (scripts/hero-scene.html, rendered by
 * scripts/render-hero.mjs) carries the warm-cream floor, its soft shadow and the
 * radial fade from the dark field, so the chrome has no gradient and no shadow.
 * The thin Paper White line is a chart path drawn once with stroke-dashoffset,
 * like the line the live site draws across its hero; reduced motion shows it
 * already drawn.
 */
export function BronzeHero({ children, className = '' }) {
  return (
    <section className={`on-dark relative overflow-hidden bg-bronze-field py-48 md:py-80 text-paper-white ${className}`}>
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 1440 720" preserveAspectRatio="none">
        <path
          d="M0 706 L110 690 L190 700 L300 676 L390 688 L520 650 L600 664 L700 600 L780 618 L880 540 L960 560 L1060 456 L1140 478 L1240 362 L1310 384 L1390 272 L1440 252"
          pathLength="1" fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinejoin="round"
          className="stroke-paper-white/50 [stroke-dasharray:1] animate-draw-line motion-reduce:animate-none"
        />
      </svg>
      <div className={`${container} relative flex flex-col gap-32 lg:flex-row lg:items-center`}>
        <div className="min-w-0 lg:w-2/5">{children}</div>
        <div aria-hidden="true" className="-mx-16 min-w-0 md:-mx-24 lg:mx-0 lg:-my-48 lg:-mr-64 lg:w-3/5">
          <img src={heroArt} alt="" width="1400" height="1200" decoding="async" className="block h-auto w-full" />
        </div>
      </div>
    </section>
  );
}

/* Hero copy, as #4 specifies it. */
export const heroText = {
  /* "a Tiempos 500 84px headline in Paper White with -0.84px letter-spacing" */
  display: 'font-tiempos font-medium text-heading md:text-heading-lg lg:text-display leading-display tracking-display text-paper-white mb-24',
  /* "a 18px The Future 400 paragraph in Paper White at 80% opacity" */
  lede: 'font-the-future font-normal text-subheading leading-subheading text-paper-white/80 mb-32',
  fine: 'text-caption leading-caption text-paper-white/70',
};
