import { describe, it, expect } from "vitest";
import { APPS, FLOOR_APPS, visibleApps, adminEntryFor } from "./apps";

/* ⚠️ Every expectation below gained the four floor apps on 21 Oct 2026, when
   visibleApps stopped trusting the token for them — see the FLOOR_APPS block
   at the foot of this file for why. The assertions themselves are unchanged
   in intent: each still pins that a NON-floor app appears only when granted
   or current, which is the property these tests were written to protect. */
describe("visibleApps", () => {
  it("staff (product only) sees the floor and nothing else", () => {
    expect(visibleApps(APPS, ["product"], "product").map((a) => a.key)).toEqual([
      "home", "product", "people", "scheduling",
    ]);
  });

  it("leadership sees its grants and the floor, not cms", () => {
    expect(
      visibleApps(APPS, ["product", "audit", "scheduling", "sales"], "audit").map((a) => a.key),
    ).toEqual(["home", "product", "people", "sales", "scheduling", "audit"]);
  });

  it("a cms grant adds cms on top of the rest", () => {
    expect(
      visibleApps(APPS, ["product", "audit", "scheduling", "sales", "cms"], "cms").map((a) => a.key),
    ).toEqual(["home", "product", "people", "sales", "scheduling", "cms", "audit"]);
  });

  it("always includes the current app even when not granted", () => {
    expect(visibleApps(APPS, ["product"], "audit").map((a) => a.key)).toEqual([
      "home", "product", "people", "scheduling", "audit",
    ]);
  });

  it("ignores unknown grant keys", () => {
    expect(visibleApps(APPS, ["product", "bogus"], "product").map((a) => a.key)).toEqual([
      "home", "product", "people", "scheduling",
    ]);
  });

  it("user with no grants still sees the current app", () => {
    expect(visibleApps(APPS, [], "audit").map((a) => a.key)).toEqual([
      "home", "product", "people", "scheduling", "audit",
    ]);
  });

  it("shows the admin entry only when granted", () => {
    expect(visibleApps(APPS, ["product"], "product").map((a) => a.key)).not.toContain("admin");
    expect(visibleApps(APPS, ["product", "admin"], "product").map((a) => a.key)).toContain("admin");
  });

  it("APPS canonical order", () => {
    expect(APPS.map((a) => a.key)).toEqual([
      "home", "leadership", "product", "people", "marketing", "sales", "scheduling", "finance", "partnerships", "cms", "audit", "governance", "launchpad", "admin",
    ]);
  });

  it("adminEntryFor returns the admin entry only for admin-grant holders", () => {
    expect(adminEntryFor(["product", "people"])).toBeNull();
    expect(adminEntryFor(["product", "admin"])?.key).toBe("admin");
    expect(adminEntryFor(["product", "admin"])?.url).toContain("/admin");
  });

  it("scheduling entry has name Academic Ops and academicops URL (key unchanged)", () => {
    const entry = APPS.find((a) => a.key === "scheduling");
    expect(entry).toBeDefined();
    expect(entry?.name).toBe("Academic Ops");
    expect(entry?.url).toBe("https://academicops.cgspectrum.com");
  });

  // 🔴 The floor keys the auth host composes into every token (app-auth
  // src/lib/grants.ts composeApps) must each have an entry here, or a staffer
  // holds a grant that renders no tile and the app is unreachable from the
  // launcher. `home` was exactly that case until 2026-09-24.
  it("every floor key the auth host composes has a launcher entry", () => {
    const FLOOR = ["home", "product", "people", "scheduling"];
    for (const key of FLOOR) {
      const entry = APPS.find((a) => a.key === key);
      expect(entry, `floor key "${key}" has no APPS entry — it would render no tile`).toBeDefined();
      expect(entry?.url).toMatch(/^https:\/\//);
    }
  });

  it("a staffer with only the floor sees all four floor tiles", () => {
    expect(visibleApps(APPS, ["home", "product", "people", "scheduling"], "home").map((a) => a.key)).toEqual([
      "home", "product", "people", "scheduling",
    ]);
  });
});

/* ─── The floor cannot be hidden by a stale token (Jeremy, 21 Oct 2026) ───── */

describe("visibleApps and the floor", () => {
  // 🔴 The bug as reported: Home was absent from the launcher everywhere
  // except inside Home itself. Grants bake into the JWT at SIGN-IN and `home`
  // only joined the floor on 2026-09-24, so every older session carried a
  // token naming the other three floor apps and not that one.
  it("shows a floor app the token does not name", () => {
    const stale = ["product", "people", "scheduling"]; // a pre-2026-09-24 token
    const keys = visibleApps(APPS, stale, "marketing").map((a) => a.key);
    expect(keys).toContain("home");
  });

  it("shows the whole floor even for a token with nothing in it at all", () => {
    const keys = visibleApps(APPS, [], "marketing").map((a) => a.key);
    for (const f of FLOOR_APPS) expect(keys).toContain(f);
  });

  // ⛔ Unioning the floor must not become "show everything".
  it("still hides an app the user has no grant for", () => {
    const keys = visibleApps(APPS, [], "marketing").map((a) => a.key);
    expect(keys).not.toContain("finance");
    expect(keys).not.toContain("admin");
    expect(keys).not.toContain("governance");
  });

  it("still shows the current app even when it is neither floor nor granted", () => {
    expect(visibleApps(APPS, [], "finance").map((a) => a.key)).toContain("finance");
  });

  it("never duplicates an app the token also names", () => {
    const keys = visibleApps(APPS, ["home", "home", "people"], "home").map((a) => a.key);
    expect(keys.filter((k) => k === "home")).toHaveLength(1);
  });

  // 🔴 Mirrors the auth host's composeApps floor. If that list changes, this
  // fails and tells you which half is out of step.
  it("the floor it unions is the floor the auth host composes", () => {
    expect([...FLOOR_APPS].sort()).toEqual(["home", "people", "product", "scheduling"]);
    for (const f of FLOOR_APPS) {
      expect(APPS.find((a) => a.key === f), `floor key "${f}" has no APPS entry`).toBeDefined();
    }
  });
});
