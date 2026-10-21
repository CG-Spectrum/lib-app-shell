import { describe, expect, test } from "vitest";
import {
  DAY_END_MIN,
  DAY_START_MIN,
  LANE_GUTTER,
  assignLanes,
  busiestDay,
  clusterEvents,
  isOutOfHours,
  laneGeometry,
  layoutEvents,
  overlaps,
  shouldCollapseOwners,
  type CalendarEvent,
} from "./calendar-logic";

const ev = (key: string, start: number, end: number, day = 0, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  key,
  start,
  end,
  day,
  title: key,
  ...extra,
});

const h = (hours: number) => hours * 60;

describe("overlaps", () => {
  test("events sharing time overlap", () => {
    expect(overlaps(ev("a", h(9), h(11)), ev("b", h(10), h(12)))).toBe(true);
  });

  test("🔴 touching at a boundary is NOT an overlap", () => {
    // 09:00-10:00 and 10:00-11:00 are back to back. Treating that as a
    // collision would halve the width of every consecutive pair in the estate.
    expect(overlaps(ev("a", h(9), h(10)), ev("b", h(10), h(11)))).toBe(false);
  });

  test("an event fully containing another overlaps it", () => {
    expect(overlaps(ev("a", h(9), h(17)), ev("b", h(12), h(13)))).toBe(true);
  });

  test("events on different days never overlap, whatever their times", () => {
    expect(overlaps(ev("a", h(9), h(11), 0), ev("b", h(9), h(11), 1))).toBe(false);
  });
});

describe("clusterEvents", () => {
  test("non-overlapping events are separate clusters", () => {
    const clusters = clusterEvents([ev("a", h(9), h(10)), ev("b", h(11), h(12))]);
    expect(clusters).toHaveLength(2);
  });

  test("🔴 transitive overlap stays in ONE cluster", () => {
    // A overlaps B, B overlaps C, A does not overlap C. If these split into
    // two clusters, A and C both take lane 0 and draw on top of each other
    // while B sits beside them.
    const clusters = clusterEvents([
      ev("a", h(9), h(11)),
      ev("b", h(10), h(13)),
      ev("c", h(12), h(14)),
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].map((e) => e.key)).toEqual(["a", "b", "c"]);
  });

  test("clusters never span days", () => {
    const clusters = clusterEvents([ev("a", h(9), h(11), 0), ev("b", h(9), h(11), 1)]);
    expect(clusters).toHaveLength(2);
  });

  test("output is start-sorted, so two renders of the same data cannot differ", () => {
    const clusters = clusterEvents([ev("late", h(14), h(15)), ev("early", h(9), h(10))]);
    expect(clusters[0][0].key).toBe("early");
  });

  test("every input event appears exactly once", () => {
    const input = [
      ev("a", h(9), h(11)),
      ev("b", h(10), h(12)),
      ev("c", h(15), h(16)),
      ev("d", h(9), h(10), 1),
    ];
    const keys = clusterEvents(input).flat().map((e) => e.key).sort();
    expect(keys).toEqual(["a", "b", "c", "d"]);
  });

  test("an empty input gives no clusters", () => {
    expect(clusterEvents([])).toEqual([]);
  });
});

describe("assignLanes", () => {
  test("a lone event takes lane 0 of 1, so it renders full width", () => {
    expect(assignLanes([ev("a", h(9), h(10))])).toEqual([{ key: "a", lane: 0, lanes: 1 }]);
  });

  test("two overlapping events take two lanes", () => {
    const lanes = assignLanes([ev("a", h(9), h(11)), ev("b", h(10), h(12))]);
    expect(lanes.map((l) => l.lane)).toEqual([0, 1]);
    expect(lanes.every((l) => l.lanes === 2)).toBe(true);
  });

  test("a lane is reused once its previous event has finished", () => {
    // a 09-10, b 09-11 (lane 1), c 10-11 reuses lane 0 — two lanes, not three.
    const lanes = assignLanes([ev("a", h(9), h(10)), ev("b", h(9), h(11)), ev("c", h(10), h(11))]);
    expect(lanes.find((l) => l.key === "c")!.lane).toBe(0);
    expect(lanes.every((l) => l.lanes === 2)).toBe(true);
  });

  test("a triple booking takes three lanes", () => {
    const lanes = assignLanes([
      ev("a", h(9), h(12)),
      ev("b", h(9), h(12)),
      ev("c", h(9), h(12)),
    ]);
    expect(lanes.map((l) => l.lane).sort()).toEqual([0, 1, 2]);
    expect(lanes.every((l) => l.lanes === 3)).toBe(true);
  });

  test("no two overlapping events ever share a lane", () => {
    const cluster = [
      ev("a", h(9), h(13)),
      ev("b", h(10), h(11)),
      ev("c", h(10), h(12)),
      ev("d", h(11), h(12)),
    ];
    const lanes = assignLanes(cluster);
    const laneOf = new Map(lanes.map((l) => [l.key, l.lane]));
    for (const x of cluster) {
      for (const y of cluster) {
        if (x.key !== y.key && overlaps(x, y)) {
          expect(laneOf.get(x.key)).not.toBe(laneOf.get(y.key));
        }
      }
    }
  });
});

describe("layoutEvents", () => {
  test("⚖️ width comes from the event's OWN cluster, not the day's worst case", () => {
    // One triple booking in the morning must not render the afternoon's lone
    // appointment at one-third width.
    const layout = layoutEvents([
      ev("a", h(9), h(10)),
      ev("b", h(9), h(10)),
      ev("c", h(9), h(10)),
      ev("solo", h(15), h(16)),
    ]);
    expect(layout.get("a")!.lanes).toBe(3);
    expect(layout.get("solo")!.lanes).toBe(1);
  });

  test("every event gets an assignment", () => {
    const events = [ev("a", h(9), h(11)), ev("b", h(10), h(12)), ev("c", h(9), h(10), 1)];
    const layout = layoutEvents(events);
    for (const e of events) expect(layout.has(e.key)).toBe(true);
  });
});

describe("laneGeometry", () => {
  test("a single lane fills the column, less the gutter", () => {
    expect(laneGeometry(0, 1)).toEqual({ left: "0%", width: `calc(100% - ${LANE_GUTTER}px)` });
  });
  test("lanes divide the column evenly and start where the previous ends", () => {
    expect(laneGeometry(1, 2).left).toBe("50%");
    expect(laneGeometry(2, 4).left).toBe("50%");
  });
  test("the gutter stays a true 2px at any width rather than a collapsing percentage", () => {
    expect(laneGeometry(0, 3).width).toContain(`- ${LANE_GUTTER}px`);
  });
});

describe("isOutOfHours", () => {
  test("the working day runs 06:00 to 22:00", () => {
    expect(DAY_START_MIN).toBe(360);
    expect(DAY_END_MIN).toBe(1320);
  });
  test("inside the day is not banded", () => {
    expect(isOutOfHours(h(6))).toBe(false);
    expect(isOutOfHours(h(12))).toBe(false);
    expect(isOutOfHours(h(21))).toBe(false);
  });
  test("outside it is", () => {
    expect(isOutOfHours(h(5))).toBe(true);
    expect(isOutOfHours(h(22))).toBe(true);
    expect(isOutOfHours(h(23))).toBe(true);
    expect(isOutOfHours(0)).toBe(true);
  });
});

describe("busiestDay", () => {
  test("names the day with the most events", () => {
    expect(busiestDay([ev("a", h(9), h(10), 0), ev("b", h(9), h(10), 1), ev("c", h(11), h(12), 1)], 3)).toBe(1);
  });

  test("🔴 a tie marks NOTHING, rather than arbitrarily picking the earlier day", () => {
    // The accent says "this one". Pointing it at the first of two equals
    // states something false in the one colour the reader trusts.
    expect(busiestDay([ev("a", h(9), h(10), 0), ev("b", h(9), h(10), 1)], 2)).toBeNull();
  });

  test("a cancelled event does not make a day busy", () => {
    const result = busiestDay(
      [
        ev("a", h(9), h(10), 0),
        ev("x", h(9), h(10), 1, { cancelled: true }),
        ev("y", h(11), h(12), 1, { cancelled: true }),
      ],
      2,
    );
    expect(result).toBe(0);
  });

  test("no events, or none in range, marks nothing", () => {
    expect(busiestDay([], 5)).toBeNull();
    expect(busiestDay([ev("a", h(9), h(10), 9)], 5)).toBeNull();
  });

  test("a zero-day range does not throw", () => {
    expect(busiestDay([ev("a", h(9), h(10), 0)], 0)).toBeNull();
  });
});

describe("shouldCollapseOwners", () => {
  test("more than six owner names become one multi-select", () => {
    expect(shouldCollapseOwners(6)).toBe(false);
    expect(shouldCollapseOwners(7)).toBe(true);
  });
});
