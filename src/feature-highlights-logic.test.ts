/**
 * Feature highlights: who sees what as new.
 *
 * ⚖️ The rule is access and recency, nothing else: published, live within the
 * window, not used, and ungated or gated by a permission the person holds.
 * At most `max` highlighted, newest first; the rest only in What's new.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createUsedRecorder,
  isFeatureNew,
  permissionCheck,
  safeFeatureHref,
  selectFeatures,
  whatsNewLabel,
  type Feature,
} from "./feature-highlights-logic";

const NOW = new Date("2026-11-26T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const feature = (key: string, over: Partial<Feature> = {}): Feature => ({
  feature_key: key,
  permission: null,
  anchor: `nav.${key.split(".").pop()}`,
  href: `/${key.split(".").pop()}`,
  summary: `Summary for ${key}`,
  live_at: daysAgo(1),
  expires_at: null,
  ...over,
});

const select = (features: Feature[], over: Partial<Parameters<typeof selectFeatures>[1]> = {}) =>
  selectFeatures(features, { used: [], permissions: [], now: NOW, ...over });

const keys = (fs: Feature[]) => fs.map((f) => f.feature_key);

describe("published and within the window", () => {
  const can = () => true;
  const none = new Set<string>();

  it("is new the moment it goes live", () => {
    expect(isFeatureNew(feature("c.a", { live_at: NOW.toISOString() }), none, can, NOW)).toBe(true);
  });

  it("is not new before live_at", () => {
    expect(isFeatureNew(feature("c.a", { live_at: daysAgo(-1) }), none, can, NOW)).toBe(false);
  });

  it("is new on day 30 and not after (default window)", () => {
    expect(isFeatureNew(feature("c.a", { live_at: daysAgo(30) }), none, can, NOW)).toBe(true);
    expect(isFeatureNew(feature("c.a", { live_at: daysAgo(30.01) }), none, can, NOW)).toBe(false);
  });

  it("honours a custom window", () => {
    const f = feature("c.a", { live_at: daysAgo(8) });
    expect(isFeatureNew(f, none, can, NOW, 7)).toBe(false);
    expect(isFeatureNew(f, none, can, NOW, 14)).toBe(true);
  });

  it("stops at expires_at, even inside the window", () => {
    expect(isFeatureNew(feature("c.a", { expires_at: daysAgo(0.5) }), none, can, NOW)).toBe(false);
    expect(isFeatureNew(feature("c.a", { expires_at: NOW.toISOString() }), none, can, NOW)).toBe(false);
    expect(isFeatureNew(feature("c.a", { expires_at: daysAgo(-5) }), none, can, NOW)).toBe(true);
  });

  it("treats an unparseable live_at or expires_at as not live", () => {
    expect(isFeatureNew(feature("c.a", { live_at: "soon" }), none, can, NOW)).toBe(false);
    expect(isFeatureNew(feature("c.a", { expires_at: "never" }), none, can, NOW)).toBe(false);
  });

  it("is not new once used", () => {
    expect(isFeatureNew(feature("c.a"), new Set(["c.a"]), can, NOW)).toBe(false);
  });
});

describe("permission filter", () => {
  const gated = feature("console.roles.grid", { permission: "access.roles.read" });
  const open = feature("console.home.search");

  it("shows an ungated feature to everyone", () => {
    expect(keys(select([open], { permissions: [] }).unused)).toEqual(["console.home.search"]);
  });

  it("as an array: shows a gated feature only to a holder", () => {
    expect(keys(select([gated], { permissions: [] }).unused)).toEqual([]);
    expect(keys(select([gated], { permissions: ["other.thing"] }).unused)).toEqual([]);
    expect(keys(select([gated], { permissions: ["access.roles.read"] }).unused)).toEqual([
      "console.roles.grid",
    ]);
  });

  it("as a function: asks the predicate with the dotted name", () => {
    const pred = vi.fn((p: string) => p === "access.roles.read");
    // Same live_at, so the tie breaks on feature_key.
    expect(keys(select([gated, open], { permissions: pred }).unused)).toEqual([
      "console.home.search",
      "console.roles.grid",
    ]);
    expect(pred).toHaveBeenCalledWith("access.roles.read");
    // The ungated feature never asks.
    expect(pred).toHaveBeenCalledTimes(1);
  });

  it("as a function: a predicate that refuses hides the feature", () => {
    expect(keys(select([gated], { permissions: () => false }).unused)).toEqual([]);
  });

  it("as a function: a predicate that throws counts as no", () => {
    const boom = () => {
      throw new Error("model check failed");
    };
    expect(permissionCheck(boom)("x")).toBe(false);
    expect(keys(select([gated, open], { permissions: boom }).unused)).toEqual(["console.home.search"]);
  });

  it("as a function: only a literal true counts", () => {
    const truthy = (() => "yes") as unknown as (p: string) => boolean;
    expect(keys(select([gated], { permissions: truthy }).unused)).toEqual([]);
  });
});

describe("the cap and the order", () => {
  const five = [
    feature("c.e", { live_at: daysAgo(5) }),
    feature("c.a", { live_at: daysAgo(1) }),
    feature("c.c", { live_at: daysAgo(3) }),
    feature("c.d", { live_at: daysAgo(4) }),
    feature("c.b", { live_at: daysAgo(2) }),
  ];

  it("highlights at most 3 by default, newest live_at first", () => {
    const s = select(five);
    expect(keys(s.highlighted)).toEqual(["c.a", "c.b", "c.c"]);
  });

  it("keeps every unused new feature in the list, newest first", () => {
    expect(keys(select(five).unused)).toEqual(["c.a", "c.b", "c.c", "c.d", "c.e"]);
  });

  it("honours a custom max, including zero", () => {
    expect(keys(select(five, { max: 1 }).highlighted)).toEqual(["c.a"]);
    expect(select(five, { max: 0 }).highlighted).toEqual([]);
  });

  it("applies the cap AFTER the filters, so a used feature frees its slot", () => {
    expect(keys(select(five, { used: ["c.a"] }).highlighted)).toEqual(["c.b", "c.c", "c.d"]);
  });

  it("applies the cap after expiry and permission too", () => {
    const mixed = [
      feature("c.gated", { live_at: daysAgo(0.5), permission: "p.x" }),
      feature("c.gone", { live_at: daysAgo(0.6), expires_at: daysAgo(0.1) }),
      ...five,
    ];
    expect(keys(select(mixed).highlighted)).toEqual(["c.a", "c.b", "c.c"]);
    expect(keys(select(mixed, { permissions: ["p.x"] }).highlighted)).toEqual(["c.gated", "c.a", "c.b"]);
  });

  it("breaks a live_at tie on feature_key, so server and client agree", () => {
    const t = daysAgo(1);
    const s = select([feature("c.z", { live_at: t }), feature("c.m", { live_at: t })]);
    expect(keys(s.unused)).toEqual(["c.m", "c.z"]);
  });

  it("shows a duplicated key once", () => {
    expect(keys(select([feature("c.a"), feature("c.a")]).unused)).toEqual(["c.a"]);
  });

  it("returns nothing for an empty list", () => {
    expect(select([])).toEqual({ unused: [], highlighted: [] });
  });
});

describe("onUsed is called exactly once per key", () => {
  it("calls once, however often the key is marked", () => {
    const onUsed = vi.fn();
    const record = createUsedRecorder(() => onUsed);
    expect(record("c.a")).toBe(true);
    expect(record("c.a")).toBe(false);
    record("c.a");
    record("c.b");
    expect(onUsed).toHaveBeenCalledTimes(2);
    expect(onUsed).toHaveBeenNthCalledWith(1, "c.a");
    expect(onUsed).toHaveBeenNthCalledWith(2, "c.b");
  });

  it("swallows a throw and still does not retry", () => {
    const onUsed = vi.fn(() => {
      throw new Error("route down");
    });
    const record = createUsedRecorder(() => onUsed);
    expect(() => record("c.a")).not.toThrow();
    expect(() => record("c.a")).not.toThrow();
    expect(onUsed).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejected promise", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const record = createUsedRecorder(() => () => Promise.reject(new Error("503")));
    record("c.a");
    await new Promise((r) => setTimeout(r, 0));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("uses the latest callback without resetting the guard", () => {
    const first = vi.fn();
    const second = vi.fn();
    let current = first;
    const record = createUsedRecorder(() => current);
    record("c.a");
    current = second;
    record("c.a");
    record("c.b");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith("c.b");
  });

  it("tolerates no callback", () => {
    const record = createUsedRecorder(() => undefined);
    expect(record("c.a")).toBe(true);
  });
});

describe("What's new links stay inside the app", () => {
  it("allows an app-relative path", () => {
    expect(safeFeatureHref("/roles?tab=grid")).toBe("/roles?tab=grid");
  });

  it("refuses anything that could leave the app", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "roles", ""]) {
      expect(safeFeatureHref(bad)).toBeNull();
    }
    expect(safeFeatureHref(null)).toBeNull();
  });
});

describe("the trigger's accessible name counts in words", () => {
  it("singular and plural", () => {
    expect(whatsNewLabel(1)).toBe("What's new: 1 new feature");
    expect(whatsNewLabel(4)).toBe("What's new: 4 new features");
  });
});
