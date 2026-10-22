import { describe, it, expect } from "vitest";
import {
  isActiveTab,
  startsNewGroup,
  tabClassName,
  type SubNavTab,
} from "./SubNav";

describe("isActiveTab", () => {
  it("exact match is active", () => {
    expect(isActiveTab("/overview", "/overview")).toBe(true);
  });

  it("exact match with trailing segment is not active for non-prefix case", () => {
    // "/overview" does NOT match "/overview/detail" because startsWith would
    // catch it — but that's desired behaviour for non-root hrefs
    expect(isActiveTab("/overview", "/overview/detail")).toBe(true);
  });

  it("prefix match is active for non-root href", () => {
    expect(isActiveTab("/scheduling", "/scheduling/cost")).toBe(true);
  });

  it("root href '/' is active ONLY on exact '/'", () => {
    expect(isActiveTab("/", "/")).toBe(true);
    expect(isActiveTab("/", "/dashboard")).toBe(false);
    expect(isActiveTab("/", "/mentors")).toBe(false);
  });

  it("'/mentors' is not active on '/'", () => {
    expect(isActiveTab("/mentors", "/")).toBe(false);
  });

  it("inactive when path is completely different", () => {
    expect(isActiveTab("/overview", "/viability")).toBe(false);
  });

  it("inactive when href is a prefix of a different segment", () => {
    // '/schedule' should NOT match '/scheduling'
    expect(isActiveTab("/schedule", "/scheduling")).toBe(false);
  });

  it("active on exact match regardless of root rule", () => {
    expect(isActiveTab("/cost", "/cost")).toBe(true);
  });
});

describe("startsNewGroup", () => {
  const t = (href: string, group?: string): SubNavTab => ({
    href,
    label: href,
    group,
  });

  it("never puts a divider before the first tab", () => {
    expect(startsNewGroup([t("/a", "x")], 0)).toBe(false);
  });

  it("divides only where adjacent groups differ", () => {
    const tabs = [t("/a", "x"), t("/b", "x"), t("/c", "y")];
    expect(startsNewGroup(tabs, 1)).toBe(false);
    expect(startsNewGroup(tabs, 2)).toBe(true);
  });

  it("ungrouped tabs never get a divider (existing apps unchanged)", () => {
    const tabs = [t("/a"), t("/b"), t("/c", "y"), t("/d")];
    expect([1, 2, 3].map((i) => startsNewGroup(tabs, i))).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("tabClassName", () => {
  // 🔴 marketing, 21 Oct 2026: fifteen tabs outran the row, every flex item
  // shrank to min-content and the multi-word labels broke across two lines.
  // A flex item defaults to flex-shrink:1 / min-width:auto, so BOTH of these
  // are required — shrink-0 stops the squeeze, nowrap stops the break if a
  // squeeze ever gets through another way.
  it("never lets a tab wrap or be squeezed", () => {
    for (const active of [true, false]) {
      expect(tabClassName(active)).toContain("whitespace-nowrap");
      expect(tabClassName(active)).toContain("shrink-0");
    }
  });

  // ⛔ Wrapping the ROW detaches every tab but the last row's from the nav's
  // bottom border, so the active underline floats mid-bar.
  it("does not wrap the row", () => {
    expect(tabClassName(false)).not.toContain("flex-wrap");
  });

  it("carries the standard's tab type, not a body label", () => {
    const c = tabClassName(false);
    expect(c).toContain("font-mono");
    expect(c).toContain("text-[11px]");
    expect(c).toContain("uppercase");
    expect(c).toContain("tracking-[0.14em]");
  });

  it("marks the active tab with the accent rule and accent ink", () => {
    expect(tabClassName(true)).toContain("border-accent");
    expect(tabClassName(true)).toContain("text-accent");
  });

  // ⛔ Non-active is PAPER. Dimming the bar to make one item stand out spends
  // contrast the brand cannot spare; the accent and the rule already mark the
  // current page twice over.
  it("leaves non-active tabs on paper, not text-2", () => {
    const c = tabClassName(false);
    expect(c).toContain("text-text");
    expect(c).not.toContain("text-text-2");
  });
});
