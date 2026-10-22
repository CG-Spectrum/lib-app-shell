import { describe, expect, test } from "vitest";
import {
  DENSITY_INIT_SCRIPT,
  DENSITY_METRICS,
  densityCookieString,
  densityMetrics,
  resolveDensity,
} from "./density";

describe("resolveDensity", () => {
  test("explicit compact is honoured", () => {
    expect(resolveDensity("compact")).toBe("compact");
  });
  test("explicit comfortable is honoured", () => {
    expect(resolveDensity("comfortable")).toBe("comfortable");
  });
  test("no cookie → comfortable, the shipped default", () => {
    expect(resolveDensity(null)).toBe("comfortable");
    expect(resolveDensity(undefined)).toBe("comfortable");
  });
  test("junk falls to comfortable, never compact", () => {
    // Landing on compact by accident puts somebody on 13px body text they did
    // not ask for. The safe direction for a bad value is the roomier one.
    expect(resolveDensity("tiny")).toBe("comfortable");
    expect(resolveDensity("")).toBe("comfortable");
    expect(resolveDensity("COMPACT")).toBe("comfortable");
  });
});

describe("densityCookieString", () => {
  test("estate hosts get the shared .cgspectrum.com domain, so the choice follows the user", () => {
    const c = densityCookieString("compact", "academicops.cgspectrum.com");
    expect(c).toContain("cgsi-density=compact");
    expect(c).toContain("domain=.cgspectrum.com");
    expect(c).toContain("secure");
  });
  test("localhost stays host-only (a domain attribute would be rejected)", () => {
    const c = densityCookieString("comfortable", "localhost");
    expect(c).not.toContain("domain=");
    expect(c).not.toContain("secure");
  });
  test("scoping matches the theme cookie exactly — two estate cookies must not behave differently", () => {
    const d = densityCookieString("compact", "people.cgspectrum.com");
    for (const attr of ["path=/", "max-age=31536000", "samesite=lax", "domain=.cgspectrum.com", "secure"]) {
      expect(d).toContain(attr);
    }
  });
});

describe("DENSITY_INIT_SCRIPT", () => {
  test("only ever writes a known density", () => {
    // The regex is the guard: a cookie of cgsi-density=0px must not reach
    // dataset.density, because every part sizes off that attribute.
    expect(DENSITY_INIT_SCRIPT).toContain("(comfortable|compact)");
  });
  test("falls back to comfortable when anything throws", () => {
    expect(DENSITY_INIT_SCRIPT).toContain('catch(e){document.documentElement.dataset.density="comfortable"}');
  });
  test("runs against document.cookie, not localStorage (which is per-subdomain)", () => {
    expect(DENSITY_INIT_SCRIPT).toContain("document.cookie");
    expect(DENSITY_INIT_SCRIPT).not.toContain("localStorage");
  });
});

describe("DENSITY_METRICS", () => {
  test("row heights are the standard's 40 and 32", () => {
    expect(DENSITY_METRICS.comfortable.row).toBe(40);
    expect(DENSITY_METRICS.compact.row).toBe(32);
  });
  test("body never drops below 13 — Stack Sans Text 400 stops being legible under it on dark", () => {
    expect(DENSITY_METRICS.comfortable.body).toBe(14);
    expect(DENSITY_METRICS.compact.body).toBe(13);
    for (const d of ["comfortable", "compact"] as const) {
      expect(DENSITY_METRICS[d].body).toBeGreaterThanOrEqual(13);
    }
  });
  test("🔴 padding comes off the six-step scale — density introduces no spacing of its own", () => {
    const SCALE = [4, 8, 12, 16, 24, 40];
    for (const d of ["comfortable", "compact"] as const) {
      expect(SCALE).toContain(DENSITY_METRICS[d].panelPad);
    }
  });
  test("row heights are heights, not spacing steps — 32 is deliberately off the scale", () => {
    // Worth stating, because the obvious assertion (every number here is on
    // the spacing scale) is false and asserting it reads as correct until it
    // fails. 40 is on the scale by coincidence; 32 is the fixed compact row
    // height from the standard and belongs to no scale.
    const SCALE = [4, 8, 12, 16, 24, 40];
    expect(SCALE).toContain(DENSITY_METRICS.comfortable.row);
    expect(SCALE).not.toContain(DENSITY_METRICS.compact.row);
    expect(DENSITY_METRICS.compact.row).toBe(32);
  });
  test("compact is smaller than comfortable on every axis, never larger", () => {
    const a = DENSITY_METRICS.comfortable;
    const b = DENSITY_METRICS.compact;
    expect(b.row).toBeLessThan(a.row);
    expect(b.body).toBeLessThan(a.body);
    expect(b.data).toBeLessThan(a.data);
    expect(b.panelPad).toBeLessThan(a.panelPad);
  });

  // The mono rung sits one step under the body at both densities, because
  // Plex Mono is wider per character than Stack Sans Text.
  test("the data rung is one step under the body, at every density", () => {
    for (const d of ["comfortable", "compact"] as const) {
      expect(DENSITY_METRICS[d].data).toBe(DENSITY_METRICS[d].body - 1);
    }
  });
  test("⛔ density carries no typeface, weight or colour — size only", () => {
    for (const d of ["comfortable", "compact"] as const) {
      // `data` is a SIZE in px, like the rest. The rule this guards is that
      // density never carries a face, a weight or a colour — not that it
      // carries only three numbers.
      expect(Object.keys(DENSITY_METRICS[d]).sort()).toEqual([
        "body",
        "data",
        "panelPad",
        "row",
      ]);
    }
  });
});

describe("densityMetrics", () => {
  test("returns the set for the given density", () => {
    expect(densityMetrics("compact")).toBe(DENSITY_METRICS.compact);
    expect(densityMetrics("comfortable")).toBe(DENSITY_METRICS.comfortable);
  });
});
