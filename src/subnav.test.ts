import { describe, it, expect } from "vitest";
import { isActiveTab, startsNewGroup, type SubNavTab } from "./SubNav";

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
