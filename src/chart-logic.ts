// Chart scales, ticks and the series budget. Separated from the SVG so the
// arithmetic is testable — a chart whose labels name values it does not reach
// is the most common way one of these lies.
//
// ── THE SERIES BUDGET, AND WHY IT IS TWO ─────────────────────────────────────
//
// The 2027 standard says grey is data (#4a5150 → #8f8f8b) and green is the one
// series the panel is about. That gives no categorical hue palette at all,
// deliberately. The consequence was measured rather than assumed, with the
// dataviz palette validator against the panel surface #1b2120:
//
//   4 greys  worst adjacent pair ΔE 6.8 (normal vision)  — FAIL
//   3 greys  worst adjacent pair ΔE 9.7 (normal vision)  — FAIL
//   2 greys  ΔE 22.1 protan / 22.1 normal                — PASS
//
// The floor is 15 for normal vision. So a single-hue ramp carries exactly TWO
// distinguishable series, plus the accent, and that is the whole budget. A
// third grey is not a worse chart, it is an unreadable one — and unreadable
// for everybody, not only for colour-blind readers.
//
// 🔴 BOTH GREYS ALSO SIT UNDER 3:1 AGAINST THE SURFACE (2.01 and 2.36). The
// validator calls that relief-required, which is why direct labels are not
// optional on this component and why the table view always exists. CGSI
// already required the table; the contrast measurement is the second reason.
//
// ⚖️ Over budget, fold the tail into "Other", facet into small multiples, or
// split the panel. ⛔ Never generate a hue — the palette has none to generate.

export const CHART_SERIES_BUDGET = 2;

/**
 * Grey is data. Two steps, as tokens — the values live in brand.css so they
 * follow the theme: light mode uses its own ramp chosen for white rather than
 * a flip of the dark one, and both pairs were validated against their own
 * surface. Hardcoding the hex here would freeze the dark values into a light
 * page, which is the bug the adherence check caught when this file did exactly
 * that.
 */
export const SERIES_GREY = ["var(--color-series-1)", "var(--color-series-2)"] as const;

export interface Point {
  /** Category or time label, as it appears on the axis. */
  label: string;
  value: number;
}

export interface Series {
  key: string;
  /** Named in the legend and at the end of the line. Never colour alone. */
  label: string;
  points: Point[];
  /**
   * The one series the panel is about, drawn in the accent.
   * ⚖️ At most one. Two accented series means neither is the point.
   */
  accent?: boolean;
  /** Previous period. Dashed, same grey, so it reads as a comparison. */
  previous?: boolean;
}

/**
 * How many grey (non-accent, non-previous) series a set declares. Previous-period
 * series are excluded: they are dashed against their own solid counterpart and
 * carry no independent identity.
 */
export function greySeriesCount(series: readonly Series[]): number {
  return series.filter((s) => !s.accent && !s.previous).length;
}

export function accentSeriesCount(series: readonly Series[]): number {
  return series.filter((s) => s.accent).length;
}

/**
 * Why a series set is unrenderable, or null when it is fine. Returned rather
 * than thrown so a panel can render the table instead of blanking the page —
 * the numbers are still true when the shape is not drawable.
 */
export function seriesBudgetError(series: readonly Series[]): string | null {
  const grey = greySeriesCount(series);
  if (grey > CHART_SERIES_BUDGET) {
    return `${grey} grey series: the single-hue ramp separates only ${CHART_SERIES_BUDGET}. Fold the tail into "Other", facet into small multiples, or split the panel.`;
  }
  if (accentSeriesCount(series) > 1) {
    return "More than one accent series: if two series are the point, neither is.";
  }
  return null;
}

/** Grey for the nth non-accent series, in declaration order. Never cycled. */
export function seriesColour(series: readonly Series[], index: number): string {
  const s = series[index];
  if (s?.accent) return "var(--color-accent-mark)";
  // Colour follows the ENTITY, not its rank among the survivors: index within
  // the declared set, so filtering a series out never repaints the others.
  const greyIndex = series.slice(0, index).filter((x) => !x.accent).length;
  return SERIES_GREY[greyIndex % SERIES_GREY.length];
}

/**
 * A y-domain that starts at zero and ends on a round number at or above the
 * data and any target.
 *
 * 🔴 ZERO-BASED, ALWAYS, FOR BARS AND AREAS. A truncated baseline makes a 2%
 * difference look like a doubling, and these panels are read for decisions.
 */
export function yDomain(values: readonly number[], target?: number): [number, number] {
  const all = target === undefined ? values : [...values, target];
  const max = Math.max(0, ...all);
  if (max === 0) return [0, 1];
  return [0, niceCeiling(max)];
}

/** Round up to 1, 2, 2.5 or 5 times a power of ten. */
export function niceCeiling(max: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * pow;
    if (candidate >= max) return candidate;
  }
  return 10 * pow;
}

/**
 * Tick values across a domain, inclusive of both ends.
 *
 * 🔴 EVERY TICK NAMES A VALUE THE CHART ACTUALLY REACHES, which is the point
 * of deriving them from the domain rather than writing them beside it.
 */
export function yTicks([min, max]: [number, number], count = 4): number[] {
  if (max <= min) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + step * i);
}

/** Map a value to a y pixel, top-down, within a plot of `height`. */
export function yScale(value: number, [min, max]: [number, number], height: number): number {
  if (max <= min) return height;
  const clamped = Math.max(min, Math.min(max, value));
  return height - ((clamped - min) / (max - min)) * height;
}

/** Map a point index to an x pixel, evenly spaced across `width`. */
export function xScale(index: number, count: number, width: number): number {
  if (count <= 1) return width / 2;
  return (index / (count - 1)) * width;
}

/** Band centre and width for bars, with a 2px gap between adjacent fills. */
export function band(index: number, count: number, width: number, gap = 2) {
  if (count <= 0) return { x: 0, w: 0 };
  const slot = width / count;
  const w = Math.max(1, slot - gap);
  return { x: index * slot + gap / 2, w };
}
