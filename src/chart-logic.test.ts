import { describe, expect, test } from "vitest";
import {
  CHART_SERIES_BUDGET,
  SERIES_GREY,
  accentSeriesCount,
  band,
  greySeriesCount,
  niceCeiling,
  seriesBudgetError,
  seriesColour,
  xScale,
  yDomain,
  yScale,
  yTicks,
  type Series,
} from "./chart-logic";

const s = (key: string, extra: Partial<Series> = {}): Series => ({
  key,
  label: key,
  points: [{ label: "a", value: 1 }],
  ...extra,
});

describe("the series budget", () => {
  test("is two, the measured limit of a single-hue ramp", () => {
    // 3 greys measured ΔE 9.7 against a floor of 15; 2 measured 22.1.
    expect(CHART_SERIES_BUDGET).toBe(2);
    expect(SERIES_GREY).toHaveLength(2);
  });

  test("two greys plus an accent is fine", () => {
    expect(seriesBudgetError([s("a"), s("b"), s("c", { accent: true })])).toBeNull();
  });

  test("🔴 three greys is an error, and says what to do instead", () => {
    const err = seriesBudgetError([s("a"), s("b"), s("c")]);
    expect(err).toContain("3 grey series");
    expect(err).toMatch(/Other|small multiples|split/);
  });

  test("previous-period series do not spend budget — they are dashed against their own solid", () => {
    const series = [s("a"), s("b"), s("a-prev", { previous: true }), s("b-prev", { previous: true })];
    expect(greySeriesCount(series)).toBe(2);
    expect(seriesBudgetError(series)).toBeNull();
  });

  test("⚖️ two accent series is an error: if both are the point, neither is", () => {
    const err = seriesBudgetError([s("a", { accent: true }), s("b", { accent: true })]);
    expect(err).toContain("accent");
  });

  test("accentSeriesCount counts only accented series", () => {
    expect(accentSeriesCount([s("a"), s("b", { accent: true })])).toBe(1);
  });

  test("an empty set is renderable — the empty state is the chart's job, not an error", () => {
    expect(seriesBudgetError([])).toBeNull();
  });
});

describe("seriesColour", () => {
  test("the accent series takes the mark token, not a grey", () => {
    const series = [s("a"), s("b", { accent: true })];
    expect(seriesColour(series, 1)).toBe("var(--color-accent-mark)");
  });

  test("greys are assigned in declaration order", () => {
    const series = [s("a"), s("b")];
    expect(seriesColour(series, 0)).toBe(SERIES_GREY[0]);
    expect(seriesColour(series, 1)).toBe(SERIES_GREY[1]);
  });

  test("🔴 colour follows the entity, not its rank — an accent in the middle does not shift the greys after it", () => {
    // If grey assignment counted position rather than grey-position, inserting
    // an accent series would repaint every series after it.
    const series = [s("a"), s("hero", { accent: true }), s("b")];
    expect(seriesColour(series, 0)).toBe(SERIES_GREY[0]);
    expect(seriesColour(series, 2)).toBe(SERIES_GREY[1]);
  });
});

describe("niceCeiling", () => {
  test("rounds up to 1/2/2.5/5 times a power of ten", () => {
    expect(niceCeiling(7)).toBe(10);
    expect(niceCeiling(12)).toBe(20);
    expect(niceCeiling(21)).toBe(25);
    expect(niceCeiling(140)).toBe(200);
    expect(niceCeiling(1)).toBe(1);
  });
  test("an exact round value is not pushed to the next step", () => {
    expect(niceCeiling(10)).toBe(10);
    expect(niceCeiling(200)).toBe(200);
  });
});

describe("yDomain", () => {
  test("🔴 always starts at zero — a truncated baseline makes 2% look like a doubling", () => {
    expect(yDomain([80, 90, 100])[0]).toBe(0);
  });
  test("ends above the data", () => {
    const [, max] = yDomain([80, 90, 100]);
    expect(max).toBeGreaterThanOrEqual(100);
  });
  test("includes the target, so the target line is never drawn off the plot", () => {
    const [, max] = yDomain([10, 20], 180);
    expect(max).toBeGreaterThanOrEqual(180);
  });
  test("all-zero data still gives a usable domain rather than [0,0]", () => {
    expect(yDomain([0, 0])).toEqual([0, 1]);
    expect(yDomain([])).toEqual([0, 1]);
  });
  test("negatives do not drag the floor below zero", () => {
    expect(yDomain([-5, 10])[0]).toBe(0);
  });
});

describe("yTicks", () => {
  test("🔴 every tick names a value inside the domain", () => {
    const domain: [number, number] = [0, 200];
    for (const t of yTicks(domain)) {
      expect(t).toBeGreaterThanOrEqual(domain[0]);
      expect(t).toBeLessThanOrEqual(domain[1]);
    }
  });
  test("includes both ends", () => {
    const ticks = yTicks([0, 200], 4);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(200);
    expect(ticks).toHaveLength(5);
  });
  test("a degenerate domain yields one tick, not a division by zero", () => {
    expect(yTicks([5, 5])).toEqual([5]);
  });
});

describe("yScale", () => {
  test("is top-down: the domain maximum is y=0", () => {
    expect(yScale(100, [0, 100], 200)).toBe(0);
    expect(yScale(0, [0, 100], 200)).toBe(200);
  });
  test("maps the midpoint to the middle", () => {
    expect(yScale(50, [0, 100], 200)).toBe(100);
  });
  test("clamps out-of-domain values into the plot rather than drawing outside it", () => {
    expect(yScale(150, [0, 100], 200)).toBe(0);
    expect(yScale(-10, [0, 100], 200)).toBe(200);
  });
});

describe("xScale", () => {
  test("spreads points across the full width, first at 0 and last at width", () => {
    expect(xScale(0, 5, 400)).toBe(0);
    expect(xScale(4, 5, 400)).toBe(400);
  });
  test("a single point sits in the centre rather than at the left edge", () => {
    expect(xScale(0, 1, 400)).toBe(200);
  });
});

describe("band", () => {
  test("leaves a 2px gap between adjacent fills", () => {
    const a = band(0, 4, 400);
    const b = band(1, 4, 400);
    expect(b.x - (a.x + a.w)).toBeCloseTo(2, 5);
  });
  test("never returns a negative or zero width, however many bars", () => {
    for (const n of [1, 10, 100, 400]) {
      expect(band(0, n, 400).w).toBeGreaterThan(0);
    }
  });
  test("zero bars does not divide by zero", () => {
    expect(band(0, 0, 400)).toEqual({ x: 0, w: 0 });
  });
});
