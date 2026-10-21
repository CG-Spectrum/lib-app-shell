// Filter-bar behaviour, separated from the markup so the rules are testable.
//
// 🔴 THE OPTION SET NEVER RESHUFFLES. A zero-count option stays visible and
// disabled rather than disappearing. Options that vanish as you filter make
// the bar move under the cursor, and the thing you were about to click is no
// longer where you are looking. It also hides the useful fact that a category
// exists and currently has nothing in it.
//
// ⚖️ ROWS ALIGN ACROSS PANELS AND APPS. One row per dimension, a fixed 110px
// label column, options to the right. That is why the label width is a shared
// constant here rather than a per-app choice.

export const FILTER_LABEL_WIDTH = 110;

/** Above this, a row becomes a select. Never wrap a row to three lines. */
export const FILTER_COLLAPSE_AFTER = 6;

export interface FilterOption {
  value: string;
  label: string;
  /** Shown in mono after the label. Zero stays visible, disabled. */
  count?: number;
}

/**
 * "All" is the absence of a selection, not a value. Representing it as a
 * member of the set means two ways to say the same thing ([] and ["all"]) and
 * a bug the first time somebody checks the wrong one.
 */
export const ALL = "__all__";

export function isAllSelected(selection: readonly string[]): boolean {
  return selection.length === 0;
}

/**
 * Next selection after clicking `value`.
 * Single-select replaces; multi-select toggles. Clicking "All" clears.
 * Clicking the only selected value in a single-select row clears it too —
 * otherwise a row can be entered but never left without finding "All".
 */
export function nextSelection(
  current: readonly string[],
  value: string,
  multi: boolean,
): string[] {
  if (value === ALL) return [];
  if (!multi) return current.length === 1 && current[0] === value ? [] : [value];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

/** More than six options and the row collapses to a select with the same label. */
export function shouldCollapse(optionCount: number): boolean {
  return optionCount > FILTER_COLLAPSE_AFTER;
}

export interface ActiveDimension {
  /** The dimension's label, for counting. */
  label: string;
  /** Labels of the selected options, in the order the options were declared. */
  selected: string[];
}

/**
 * The summary line under the bar: "2 active · Australia, Career changer".
 *
 * Counts DIMENSIONS, not values, because that is what the reader is checking:
 * how many ways this view is narrowed. Three regions in one row is still one
 * narrowing. Returns null when nothing is active, so the caller renders no
 * line at all rather than "0 active".
 */
export function filterSummary(dimensions: readonly ActiveDimension[]): string | null {
  const active = dimensions.filter((d) => d.selected.length > 0);
  if (active.length === 0) return null;
  const values = active.flatMap((d) => d.selected);
  return `${active.length} active · ${values.join(", ")}`;
}

/**
 * Whether a reset control should show at all. Same condition as the summary
 * line, kept as its own function so the two cannot drift apart and leave a
 * Reset button next to no summary.
 */
export function hasActiveFilters(dimensions: readonly ActiveDimension[]): boolean {
  return dimensions.some((d) => d.selected.length > 0);
}
