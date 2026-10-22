/**
 * Pure decisions behind the Breadcrumb component — exported for direct unit
 * testing (package tests are logic-only, no DOM rendering).
 */

export interface BreadcrumbItem {
  label: string;
  href?: string;
  /**
   * This crumb is a NAME or a code, not a section — a person, a partner, a
   * record title. It keeps the mono face and the trail's size, but drops the
   * uppercase, because "JEREMY CHINN" is the same mistake the imported-text
   * rule exists to prevent. Sections are the default; verbatim is the exception.
   */
  verbatim?: boolean;
}

export type SegmentKind = "link" | "current";

/**
 * How a breadcrumb segment renders.
 *
 * Rules:
 *  - the LAST item is always current-page text, even if an href was supplied
 *    (you don't link to the page you're on)
 *  - any earlier item WITHOUT an href renders as plain current-style text
 *  - everything else (earlier item with href) renders as a link
 */
export function segmentKind(
  item: BreadcrumbItem,
  index: number,
  total: number
): SegmentKind {
  if (index === total - 1) return "current";
  return item.href !== undefined ? "link" : "current";
}

/**
 * Whether a segment is uppercased.
 *
 * Sections shout — the trail is chrome and reads as `LEADERSHIP / CONVERSION`.
 * A name or a code does not: `verbatim` keeps the mono face and the size but
 * leaves the characters alone, so a record trail reads
 * `PEOPLE / STAFF / Jeremy Chinn` and not `JEREMY CHINN`.
 */
export function segmentCase(item: BreadcrumbItem): "upper" | "verbatim" {
  return item.verbatim ? "verbatim" : "upper";
}

/** aria-current="page" goes on the final segment only. */
export function isCurrentPage(index: number, total: number): boolean {
  return index === total - 1;
}
