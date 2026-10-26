import { describe, it, expect } from "vitest";
import {
  isActiveTab,
  startsNewGroup,
  tabClassName,
  inlineTabClassName,
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

describe("isActiveTab, exact", () => {
  // 🔴 The gap that caused app-auth to fork this component: a parent route
  // and its children are all tabs, and prefix matching lit the parent on
  // every child page.
  it("a parent tab is NOT lit on its children when exact", () => {
    expect(isActiveTab("/admin", "/admin/logs", true)).toBe(false);
    expect(isActiveTab("/admin", "/admin/apps", true)).toBe(false);
    expect(isActiveTab("/admin", "/admin", true)).toBe(true);
  });

  it("a child tab is still lit on its own page when exact", () => {
    expect(isActiveTab("/admin/logs", "/admin/logs", true)).toBe(true);
    expect(isActiveTab("/admin/logs", "/admin", true)).toBe(false);
  });

  // ⛔ Default stays prefix, so no existing caller changes behaviour.
  it("defaults to prefix matching", () => {
    expect(isActiveTab("/admin", "/admin/logs")).toBe(true);
    expect(isActiveTab("/admin", "/admin/logs", false)).toBe(true);
  });

  it("root is exact either way", () => {
    expect(isActiveTab("/", "/dashboard", false)).toBe(false);
    expect(isActiveTab("/", "/", true)).toBe(true);
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

  it("marks the active tab with the accent MARK and accent ink", () => {
    // The underline is a decoration beside the type, so it is the mark: on
    // white, --color-accent is Ink Green and a 2px rule in it goes dull.
    expect(tabClassName(true)).toContain("border-accent-mark");
    expect(tabClassName(true)).not.toMatch(/border-accent(?![\w-])/);
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

describe("inlineTabClassName — v3.7, the tab row inside a panel", () => {
  it("is the button box in the rung, hairline, wraps (no -mb-px underline)", () => {
    const c = inlineTabClassName(false);
    expect(c).toContain("h-[30px]");
    expect(c).toContain("[html[data-density='compact']_&]:h-[26px]");
    expect(c).toContain("font-mono text-[11px]");
    expect(c).toContain("border-border");
    expect(c).not.toContain("border-b-2");
    expect(c).not.toContain("-mb-px");
  });

  it("selected is the selection register: accent hairline + tint, never the mark as a fill", () => {
    const c = inlineTabClassName(true);
    expect(c).toContain("border-accent ");
    expect(c).toContain("bg-accent-tint");
    expect(c).not.toContain("bg-accent-mark");
    expect(c).not.toContain("border-accent-mark");
  });
});
