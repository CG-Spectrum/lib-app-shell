import { describe, expect, test } from "vitest";
import {
  ALL,
  FILTER_COLLAPSE_AFTER,
  filterSummary,
  hasActiveFilters,
  isAllSelected,
  nextSelection,
  shouldCollapse,
} from "./filters-logic";

describe("isAllSelected", () => {
  test("an empty selection IS All — All is the absence of a choice, not a value", () => {
    expect(isAllSelected([])).toBe(true);
    expect(isAllSelected(["au"])).toBe(false);
  });
});

describe("nextSelection", () => {
  test("clicking All clears, in both modes", () => {
    expect(nextSelection(["au", "nz"], ALL, true)).toEqual([]);
    expect(nextSelection(["au"], ALL, false)).toEqual([]);
  });

  test("single-select replaces rather than accumulating", () => {
    expect(nextSelection(["au"], "nz", false)).toEqual(["nz"]);
    expect(nextSelection([], "nz", false)).toEqual(["nz"]);
  });

  test("single-select: clicking the selected value clears it", () => {
    // Without this a single-select row can be entered but not left except by
    // hunting for All, which is the far end of the row.
    expect(nextSelection(["au"], "au", false)).toEqual([]);
  });

  test("multi-select toggles", () => {
    expect(nextSelection(["au"], "nz", true)).toEqual(["au", "nz"]);
    expect(nextSelection(["au", "nz"], "au", true)).toEqual(["nz"]);
  });

  test("multi-select deselecting the last value lands on All, not an invalid state", () => {
    expect(isAllSelected(nextSelection(["au"], "au", true))).toBe(true);
  });

  test("never mutates the selection it was given", () => {
    const current = ["au"];
    nextSelection(current, "nz", true);
    expect(current).toEqual(["au"]);
  });
});

describe("shouldCollapse", () => {
  test("six options stay as chips, seven collapse to a select", () => {
    expect(shouldCollapse(6)).toBe(false);
    expect(shouldCollapse(7)).toBe(true);
    expect(FILTER_COLLAPSE_AFTER).toBe(6);
  });
  test("an empty or tiny row never collapses", () => {
    expect(shouldCollapse(0)).toBe(false);
    expect(shouldCollapse(1)).toBe(false);
  });
});

describe("filterSummary", () => {
  test("nothing active → no line at all, never '0 active'", () => {
    expect(filterSummary([])).toBeNull();
    expect(filterSummary([{ label: "Region", selected: [] }])).toBeNull();
  });

  test("counts DIMENSIONS, not values — three regions is still one narrowing", () => {
    const line = filterSummary([
      { label: "Region", selected: ["Australia", "New Zealand", "Canada"] },
    ]);
    expect(line).toBe("1 active · Australia, New Zealand, Canada");
  });

  test("the documented example", () => {
    expect(
      filterSummary([
        { label: "Region", selected: ["Australia"] },
        { label: "Persona", selected: ["Career changer"] },
      ]),
    ).toBe("2 active · Australia, Career changer");
  });

  test("inactive dimensions are left out of both the count and the values", () => {
    expect(
      filterSummary([
        { label: "Region", selected: ["Australia"] },
        { label: "Intake", selected: [] },
        { label: "Persona", selected: ["Upskiller"] },
      ]),
    ).toBe("2 active · Australia, Upskiller");
  });
});

describe("hasActiveFilters", () => {
  test("agrees with filterSummary, so Reset never shows beside a missing summary", () => {
    const cases = [
      [],
      [{ label: "Region", selected: [] }],
      [{ label: "Region", selected: ["Australia"] }],
      [
        { label: "Region", selected: [] },
        { label: "Persona", selected: ["Upskiller"] },
      ],
    ];
    for (const dims of cases) {
      expect(hasActiveFilters(dims)).toBe(filterSummary(dims) !== null);
    }
  });
});
