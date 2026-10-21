import { describe, expect, test } from "vitest";
import {
  CHROME_INIT_SCRIPT,
  SCALE_CHOICES,
  SCALE_STEPS,
  applyScale,
  resolveScale,
  scaleCookieString,
  scaleForWidth,
  scaleValue,
  type Scale,
} from "./scale";

describe("scaleForWidth", () => {
  test.each([
    [1280, 1, "13\" laptop"],
    [1512, 1, "14\" MacBook Pro default"],
    [1680, 1, "top of the laptop rung"],
    [1681, 1.15, "first pixel of the next rung"],
    [1920, 1.15, "1080p external at 1x"],
    [2199, 1.15, "top of that rung"],
    [2560, 1.25, "27\" QHD at 1x"],
    [2879, 1.25, "top of that rung"],
    [3072, 1.4, "the window this was designed against"],
    [3840, 1.4, "4K at 1x"],
  ])("%ipx → %f (%s)", (w, expected) => {
    expect(scaleForWidth(w)).toBe(expected);
  });

  test("⛔ never returns a rung below 1", () => {
    // Body is 13px at compact and the face stops being legible under it on the
    // dark ground, so scaling DOWN to fit more on a small screen is not on
    // offer. A narrow window gets scale 1 and a scrollbar.
    for (const w of [320, 768, 1024, 1280]) expect(scaleForWidth(w)).toBe(1);
    expect(Math.min(...SCALE_STEPS.map((s) => s.scale))).toBe(1);
  });

  test("junk widths fall to 1 rather than NaN", () => {
    for (const w of [0, -1, NaN, Infinity * 0]) expect(scaleForWidth(w)).toBe(1);
  });

  test("the ladder is ordered and total", () => {
    const maxes = SCALE_STEPS.map((s) => s.maxWidth);
    expect(maxes).toEqual([...maxes].sort((a, b) => a - b));
    expect(maxes.at(-1)).toBe(Infinity); // no width falls off the end
  });
});

describe("resolveScale", () => {
  test("an explicit choice is honoured", () => {
    for (const c of SCALE_CHOICES) expect(resolveScale(c)).toBe(c);
  });

  test("junk, null and undefined fall to auto", () => {
    for (const v of ["0.5", "2", "", "big", null, undefined, "AUTO"]) {
      expect(resolveScale(v)).toBe("auto");
    }
  });

  test("🔴 a cookie asking to scale DOWN is not honoured", () => {
    // The floor has to hold at the cookie as well as at the ladder, or anyone
    // who hand-edits the cookie gets 10px body text.
    expect(resolveScale("0.75")).toBe("auto");
    expect(resolveScale("-1")).toBe("auto");
  });
});

describe("scaleValue", () => {
  test("auto reads the viewport", () => {
    expect(scaleValue("auto", 1512)).toBe(1);
    expect(scaleValue("auto", 2560)).toBe(1.25);
  });

  test("a pinned rung ignores the viewport entirely", () => {
    // Someone who pinned 1.4 on a 4K keeps it when the window moves to the
    // laptop screen. That is the point of pinning.
    for (const w of [1280, 1920, 3840]) expect(scaleValue("1.4", w)).toBe(1.4);
  });
});

describe("scaleCookieString", () => {
  test("estate-scoped in production so one setting follows every app", () => {
    const c = scaleCookieString("1.25", "home.cgspectrum.com");
    expect(c).toContain("domain=.cgspectrum.com");
    expect(c).toContain("secure");
  });

  test("host-only on localhost, where a domain attribute is rejected", () => {
    const c = scaleCookieString("1.25", "localhost");
    expect(c).not.toContain("domain=");
    expect(c).not.toContain("secure");
  });
});

describe("CHROME_INIT_SCRIPT", () => {
  // 🔴 DENSITY HAD NEVER RUN. All 17 apps inject THEME_INIT_SCRIPT and none
  // injected DENSITY_INIT_SCRIPT, so data-density was never stamped and
  // compact was inert in production. These assertions exist so the third
  // setting cannot be added and then quietly not shipped the same way.
  test("resolves all three settings, not just the theme", () => {
    expect(CHROME_INIT_SCRIPT).toContain("cgsi-theme");
    expect(CHROME_INIT_SCRIPT).toContain("cgsi-density");
    expect(CHROME_INIT_SCRIPT).toContain("cgsi-scale");
  });

  test("THEME_INIT_SCRIPT is the same string, so no app has to change", async () => {
    const { THEME_INIT_SCRIPT } = await import("./theme");
    expect(THEME_INIT_SCRIPT).toBe(CHROME_INIT_SCRIPT);
  });

  test("it runs, and stamps a dark unstyled document", () => {
    const d = { documentElement: { dataset: {} as Record<string, string>, style: new Map() } };
    const el = d.documentElement;
    const ctx = {
      document: { documentElement: { dataset: el.dataset, style: { setProperty: (k: string, v: string) => el.style.set(k, v) } }, cookie: "" },
      window: { innerWidth: 2560, matchMedia: () => ({ matches: false }), addEventListener: () => {} },
    } as Record<string, unknown>;
    ctx.addEventListener = () => {};
    new Function("document", "window", "addEventListener", "matchMedia", CHROME_INIT_SCRIPT)(
      (ctx.document as object), (ctx.window as object), () => {}, () => ({ matches: false }),
    );
    expect(el.dataset.theme).toBe("dark");
    expect(el.dataset.density).toBe("comfortable");
    expect(el.dataset.scale).toBe("auto");
    expect(el.style.get("--ui-scale")).toBe("1.25");
  });

  test.each([
    [1512, "1"],
    [1920, "1.15"],
    [2560, "1.25"],
    [3072, "1.4"],
  ])("auto at %ipx resolves to %s, matching scaleForWidth", (width, expected) => {
    // ⚠️ The ladder is written twice — once in SCALE_STEPS for the app and
    // once inlined in the init script, which cannot import anything because
    // it is a string injected before any bundle runs. This is the test that
    // keeps the two honest.
    const el = { dataset: {} as Record<string, string>, style: new Map() };
    new Function("document", "window", "addEventListener", "matchMedia", CHROME_INIT_SCRIPT)(
      { documentElement: { dataset: el.dataset, style: { setProperty: (k: string, v: string) => el.style.set(k, v) } }, cookie: "" },
      { innerWidth: width },
      () => {},
      () => ({ matches: false }),
    );
    expect(el.style.get("--ui-scale")).toBe(expected);
    expect(Number(el.style.get("--ui-scale"))).toBe(scaleForWidth(width));
  });

  test("a thrown error still leaves a usable page", () => {
    const el = { dataset: {} as Record<string, string>, style: new Map() };
    new Function("document", "window", "addEventListener", "matchMedia", CHROME_INIT_SCRIPT)(
      { documentElement: { dataset: el.dataset, style: { setProperty: (k: string, v: string) => el.style.set(k, v) } }, get cookie(): string { throw new Error("blocked"); } },
      { innerWidth: 2560 },
      () => {},
      () => ({ matches: false }),
    );
    expect(el.dataset.theme).toBe("dark");
    expect(el.style.get("--ui-scale")).toBe("1");
  });
});

describe("applyScale", () => {
  test("stamps the element and writes the cookie", () => {
    const el = { dataset: {} as Record<string, string>, style: { setProperty: (_k: string, _v: string) => {} } };
    const set: string[] = [];
    el.style.setProperty = (k, v) => set.push(`${k}=${v}`);
    const g = globalThis as unknown as Record<string, unknown>;
    const written: string[] = [];
    g.document = { documentElement: el, set cookie(v: string) { written.push(v); } };
    g.window = { innerWidth: 2560 };
    g.location = { hostname: "home.cgspectrum.com" };
    applyScale("1.4" as Scale);
    expect(el.dataset.scale).toBe("1.4");
    expect(set).toContain("--ui-scale=1.4");
    expect(written[0]).toContain("cgsi-scale=1.4");
  });
});
