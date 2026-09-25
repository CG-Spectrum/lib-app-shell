import { describe, it, expect } from "vitest";
import { APPS, visibleApps, adminEntryFor } from "./apps";

describe("visibleApps", () => {
  it("staff (product only) sees just Product", () => {
    expect(visibleApps(APPS, ["product"], "product").map((a) => a.key)).toEqual(["product"]);
  });

  it("leadership sees four, not cms", () => {
    expect(
      visibleApps(APPS, ["product", "audit", "scheduling", "sales"], "audit").map((a) => a.key),
    ).toEqual(["product", "sales", "scheduling", "audit"]);
  });

  it("admin sees all five", () => {
    expect(
      visibleApps(APPS, ["product", "audit", "scheduling", "sales", "cms"], "cms").map((a) => a.key),
    ).toEqual(["product", "sales", "scheduling", "cms", "audit"]);
  });

  it("always includes the current app even when not granted", () => {
    expect(visibleApps(APPS, ["product"], "audit").map((a) => a.key)).toEqual(["product", "audit"]);
  });

  it("ignores unknown grant keys", () => {
    expect(visibleApps(APPS, ["product", "bogus"], "product").map((a) => a.key)).toEqual(["product"]);
  });

  it("user with no grants still sees the current app", () => {
    expect(visibleApps(APPS, [], "audit").map((a) => a.key)).toEqual(["audit"]);
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
