import { describe, expect, test } from "vitest";
import {
  DEFAULT_K,
  SKIN_MAX,
  SKIN_P99_MAX,
  SKIN_TARGET,
  exposureFor,
  gradeFilter,
  isSuspectK,
  skinWithinCeilings,
} from "./portrait-grade";

describe("gradeFilter", () => {
  test("is the chain from the brand guide, in order", () => {
    // Order matters: brightness before contrast, and the 1.04 lift last.
    expect(gradeFilter(1.2)).toBe("grayscale(1) brightness(1.2) contrast(1.42) brightness(1.04)");
  });
  test("defaults to k = 1.0, which cannot burn a frame out", () => {
    expect(gradeFilter()).toContain("brightness(1)");
    expect(DEFAULT_K).toBe(1);
  });
});

describe("exposureFor", () => {
  test("lands lit skin on the target", () => {
    expect(exposureFor(SKIN_TARGET)).toBeCloseTo(1, 5);
    expect(exposureFor(140)).toBeCloseTo(169 / 140, 5);
  });

  test("🔴 clamps at 1.5 — the production failure measured k = 1.52 and burnt out 8.7% of the frame", () => {
    // 111 was the bad measurement (a box round the whole head); 158 was the
    // true lit-skin median.
    expect(exposureFor(111)).toBe(1.5);
    expect(exposureFor(158)).toBeLessThan(1.5);
  });

  test("clamps the bottom too, so an overexposed source is not crushed", () => {
    expect(exposureFor(500)).toBe(0.5);
  });

  test("junk input falls back to leaving the frame alone", () => {
    expect(exposureFor(0)).toBe(DEFAULT_K);
    expect(exposureFor(-10)).toBe(DEFAULT_K);
    expect(exposureFor(Number.NaN)).toBe(DEFAULT_K);
    expect(exposureFor(Number.POSITIVE_INFINITY)).toBe(DEFAULT_K);
  });
});

describe("isSuspectK", () => {
  test("flags the exposure the bad-box failure produced", () => {
    expect(isSuspectK(1.52)).toBe(true);
    expect(isSuspectK(1.4)).toBe(true);
  });
  test("leaves ordinary exposures alone", () => {
    expect(isSuspectK(1.0)).toBe(false);
    expect(isSuspectK(1.2)).toBe(false);
  });
  test("clamping alone does not clear the flag — a clamped k is still suspect", () => {
    // exposureFor caps at 1.5, which is ABOVE the suspect threshold on
    // purpose: clamping stops the burn, it does not fix the measurement.
    expect(isSuspectK(exposureFor(111))).toBe(true);
  });
});

describe("skinWithinCeilings", () => {
  test("judges the skin's own distribution, not the whole frame", () => {
    expect(SKIN_P99_MAX).toBe(235);
    expect(SKIN_MAX).toBe(245);
  });
  test("passes a frame inside both ceilings", () => {
    expect(skinWithinCeilings(230, 240)).toBe(true);
  });
  test("🔴 fails on p99 alone — a face reads burnt at 0.06% global clipping", () => {
    // Which is exactly why a frame-wide clipped-pixel check passes it.
    expect(skinWithinCeilings(236, 240)).toBe(false);
  });
  test("fails on max alone", () => {
    expect(skinWithinCeilings(230, 250)).toBe(false);
  });
  test("the ceilings are exclusive, not inclusive", () => {
    expect(skinWithinCeilings(SKIN_P99_MAX, 240)).toBe(false);
    expect(skinWithinCeilings(230, SKIN_MAX)).toBe(false);
  });
});
