// Calendar layout: overlap clustering, lane assignment, out-of-hours banding
// and the busiest-day mark.
//
// 🔴 OVERLAPPING EVENTS ARE NEVER STACKED ON TOP OF EACH OTHER. They cluster,
// take lanes, and split the column width evenly with a 2px gutter. A calendar
// that stacks hides the appointment underneath, and the whole point of the
// view is seeing that two things collide.

/** Working day, in minutes from midnight. Outside this is banded as out-of-hours. */
export const DAY_START_MIN = 6 * 60;
export const DAY_END_MIN = 22 * 60;

/** Gutter between lanes, in px. Matches the chart's bar gap. */
export const LANE_GUTTER = 2;

export interface CalendarEvent {
  key: string;
  /** Minutes from midnight. */
  start: number;
  /** Minutes from midnight. Must be > start. */
  end: number;
  /** Day index within the rendered range, 0-based. */
  day: number;
  title: string;
  /** Named in text, never carried by colour alone. */
  type?: string;
  cancelled?: boolean;
  selected?: boolean;
}

/**
 * Do two events share any time? Touching at a boundary is NOT an overlap:
 * a 09:00-10:00 and a 10:00-11:00 are back to back, and treating them as
 * colliding would halve the width of every consecutive pair in the estate.
 */
export function overlaps(a: CalendarEvent, b: CalendarEvent): boolean {
  if (a.day !== b.day) return false;
  return a.start < b.end && b.start < a.end;
}

/**
 * Group events into clusters of transitively-overlapping events.
 *
 * Transitive matters: A overlaps B, B overlaps C, A does not overlap C. All
 * three must share a lane assignment, or A and C both take lane 0 and draw on
 * top of each other while B sits beside them.
 *
 * Events are returned grouped and sorted by start, so lane assignment is
 * deterministic and two renders of the same data cannot differ.
 */
export function clusterEvents(events: readonly CalendarEvent[]): CalendarEvent[][] {
  const sorted = [...events].sort((a, b) => a.day - b.day || a.start - b.start || a.key.localeCompare(b.key));
  const clusters: CalendarEvent[][] = [];

  for (const event of sorted) {
    // A cluster accepts the event if ANY member overlaps it. Because the input
    // is start-sorted, that is the transitive closure within a day.
    const cluster = clusters.find((c) => c.some((m) => overlaps(m, event)));
    if (cluster) cluster.push(event);
    else clusters.push([event]);
  }

  return clusters;
}

export interface LaneAssignment {
  key: string;
  lane: number;
  /** Total lanes in this event's cluster, which sets its width. */
  lanes: number;
}

/**
 * Assign each event in a cluster the first lane free at its start time.
 *
 * Width comes from the cluster's lane count, not the global maximum: a day
 * with one triple-booking and six single appointments should not render every
 * appointment at one-third width.
 */
export function assignLanes(cluster: readonly CalendarEvent[]): LaneAssignment[] {
  const laneEnds: number[] = [];
  const out: { key: string; lane: number }[] = [];

  for (const event of cluster) {
    // First lane whose last event has finished by the time this one starts.
    let lane = laneEnds.findIndex((end) => end <= event.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(event.end);
    } else {
      laneEnds[lane] = event.end;
    }
    out.push({ key: event.key, lane });
  }

  const lanes = laneEnds.length;
  return out.map((o) => ({ ...o, lanes }));
}

/** Lane assignments for every event, across all clusters. */
export function layoutEvents(events: readonly CalendarEvent[]): Map<string, LaneAssignment> {
  const map = new Map<string, LaneAssignment>();
  for (const cluster of clusterEvents(events)) {
    for (const a of assignLanes(cluster)) map.set(a.key, a);
  }
  return map;
}

/** Percentage geometry for a lane within its column. */
export function laneGeometry(lane: number, lanes: number): { left: string; width: string } {
  const pct = 100 / lanes;
  return {
    left: `${lane * pct}%`,
    // calc keeps the gutter a true 2px at any column width, rather than a
    // percentage that collapses on a narrow screen.
    width: `calc(${pct}% - ${LANE_GUTTER}px)`,
  };
}

/** Is this minute outside the working day, and so inside the banded region? */
export function isOutOfHours(minutes: number): boolean {
  return minutes < DAY_START_MIN || minutes >= DAY_END_MIN;
}

/**
 * The single busiest day, or null.
 *
 * 🔴 NULL ON A TIE, DELIBERATELY. The standard says the busiest day header
 * takes the accent and that there is one only. When two days tie there is no
 * single busiest day, and picking the earlier one states something false in
 * the one colour the reader is trained to trust. Marking neither is the honest
 * answer, and the counts are on the page regardless.
 */
export function busiestDay(events: readonly CalendarEvent[], dayCount: number): number | null {
  if (dayCount <= 0) return null;
  const counts = new Array<number>(dayCount).fill(0);
  for (const e of events) {
    if (e.cancelled) continue; // A cancelled event does not make a day busy.
    if (e.day >= 0 && e.day < dayCount) counts[e.day] += 1;
  }
  const max = Math.max(...counts);
  if (max === 0) return null;
  const leaders = counts.reduce<number[]>((acc, n, i) => (n === max ? [...acc, i] : acc), []);
  return leaders.length === 1 ? leaders[0] : null;
}

/** Owner filters beyond this many names become one multi-select. */
export const OWNER_COLLAPSE_AFTER = 6;

export function shouldCollapseOwners(count: number): boolean {
  return count > OWNER_COLLAPSE_AFTER;
}
