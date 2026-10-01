/*
 * TradingAgents web dashboard: component recipes.
 * Modified by BizBox: added web dashboard. Licensed under the Apache License 2.0
 * (see LICENSE and NOTICE at the repository root).
 *
 * The export ships tokens and a Tailwind @theme, not component source. These
 * are our implementations of DESIGN.md's written component specs, composed
 * only from utilities that the export's @theme (and theme-extensions.css)
 * generate. The quoted line above each recipe is the spec it follows.
 */

/* "Pill-shaped (1600px radius) … Label set in Wealthsimple Sans 400, 16px,
   0.025em letter-spacing. Vertical padding ~12px, horizontal padding 24–32px.
   No shadow." */
const pillCore = 'inline-flex items-center justify-center rounded-full-2 border font-wealthsimple-sans font-normal text-body tracking-control leading-control whitespace-nowrap no-underline cursor-pointer transition-colors';
const sizes = {
  md: 'py-12 px-24',
  sm: 'py-8 px-16', // compact toolbar pills; same 16px label
};
const disabled = 'disabled:bg-fog-veil disabled:border-fog-veil disabled:text-pebble disabled:cursor-not-allowed';
const kinds = {
  /* Filled Dark Pill: "Charcoal or Graphite fill, Paper White text" */
  primary: `bg-charcoal border-charcoal text-paper-white hover:bg-graphite-ink hover:border-graphite-ink ${disabled}`,
  /* Outlined Pill: "transparent fill, 1px Graphite Ink border, Graphite text" */
  outline: `bg-transparent border-graphite-ink text-graphite-ink hover:bg-fog-veil ${disabled}`,
  /* Ghost Pill: "no visible border, Linen Cream fill, Graphite Ink text" */
  ghost: `bg-linen-cream border-linen-cream text-graphite-ink hover:bg-fog-veil ${disabled}`,
  /* Bronze hero secondary: "outlined pill (1px Paper White border, transparent fill)" */
  outlineOnDark: 'bg-transparent border-paper-white text-paper-white hover:bg-paper-white/10',
};

export function btn(kind = 'primary', size = 'md') {
  return `${pillCore} ${sizes[size]} ${kinds[kind]}`;
}

export const button = {
  primary: btn('primary'),
  outline: btn('outline'),
  ghost: btn('ghost'),
  outlineOnDark: btn('outlineOnDark'),
};

/* Soft Card Surface: "Linen Cream or Paper White fill, 100px
   corner radius, 32px padding on all sides, no border, no shadow."
   (--radius-full is 100px in the export's @theme.) */
export const card = 'bg-linen-cream rounded-full p-32 min-w-0';
export const cardWhite = 'bg-paper-white rounded-full p-32 min-w-0';

/* Eyebrow Tag: "The Future 400, 14–16px, 0.005em letter-spacing, Pebble.
   Sits 12–16px above the Tiempos heading. Never bold, never uppercase." */
export const eyebrow = 'font-the-future font-normal text-caption leading-caption tracking-body text-pebble normal-case mb-12';
export const eyebrowOnDark = 'font-the-future font-normal text-caption leading-caption tracking-body text-paper-white/70 normal-case mb-16';

/* Editorial Section Heading: "Tiempos 500 at 56–84px … letter-spacing -0.01em";
   "36px for sub-section heads". */
export const headingLg = 'font-tiempos font-medium text-heading-lg leading-heading-lg tracking-heading-lg text-graphite-ink';
export const heading = 'font-tiempos font-medium text-heading leading-heading tracking-heading text-graphite-ink';
/* Card titles: "The Future … card titles", 500 at 18–20px. */
export const cardTitle = 'font-the-future font-medium text-heading-sm leading-heading-sm text-graphite-ink';

/* Text Input: "Transparent or Paper White fill, 1px Stone border, 100px radius,
   The Future 400 16px. Focus state: 1px Graphite Ink border, no glow.
   Placeholder text in Pebble. 16px vertical padding." */
export const input = 'w-full min-w-0 bg-paper-white border border-stone rounded-full font-the-future font-normal text-body tracking-body text-graphite-ink placeholder:text-pebble py-16 px-24 outline-none shadow-none focus:border-graphite-ink';

/* Feature Column with Top Divider: "starts with a 1px Stone hairline rule at
   the top, followed by a The Future 500 18–20px headline, then a 14–16px The
   Future 400 paragraph in Graphite Ink. No background fill, no card." */
export const feature = 'border-t border-stone pt-24';
export const featureTitle = 'font-the-future font-medium text-heading-sm leading-heading-sm text-graphite-ink mb-12';
export const featureBody = 'font-the-future font-normal text-body leading-body text-graphite-ink';

/* Badges and tags: "1600px" radius. */
export const badge = 'inline-flex items-center rounded-full-2 border font-wealthsimple-sans tracking-control leading-control text-caption py-6 px-16';

/* Hairline divider: "1px Stone". */
export const hairline = 'border-stone';

/* Keyboard focus for custom controls: a 1px Graphite outline, never a glow. */
export const focusRing = 'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-graphite-ink';

/* Page container: "max-width 1200px centered". */
export const container = 'max-w-page mx-auto px-16 md:px-24';
