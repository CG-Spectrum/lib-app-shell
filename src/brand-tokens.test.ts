import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const brandCss = readFileSync(new URL("./styles/brand.css", import.meta.url), "utf8");

/* A var() reference with no fallback resolves to the guaranteed-invalid value
   when the referenced property is unset, and that poisons the whole custom
   property it sits in — the rest of the comma list never applies. A font stack
   written `var(--font-mono), "IBM Plex Mono", monospace` therefore has no
   fallback at all: every `font-family: var(--brand-mono)` inherits instead.
   --brand-mono shipped that way and rendered as body type, because nothing in
   the estate defines --font-mono. The quoted name goes inside the var(). */
describe("brand.css font stacks", () => {
  const stacks = [...brandCss.matchAll(/^\s*(--brand-(?:body|display|mono))\s*:\s*([^;]+);/gm)];

  test("all three faces are declared", () => {
    expect(stacks.map(([, name]) => name).sort()).toEqual([
      "--brand-body",
      "--brand-display",
      "--brand-mono",
    ]);
  });

  test.each(stacks.map(([, name, value]) => [name, value] as const))(
    "%s gives every var() a fallback",
    (_name, value) => {
      for (const [, ref] of value.matchAll(/var\(\s*(--[\w-]+)([^)]*)\)/g)) {
        // --brand-display legitimately chains to --brand-body, which is itself
        // always defined here. Only the next/font variables, set by the
        // consuming layout and absent on any app that forgets the className,
        // need a literal to land on.
        if (ref.startsWith("--brand-")) continue;
        expect(value).toMatch(new RegExp(`var\\(\\s*${ref}\\s*,`));
      }
    },
  );

  test("--brand-mono lands on IBM Plex Mono, not the body face", () => {
    const mono = stacks.find(([, name]) => name === "--brand-mono")?.[2] ?? "";
    expect(mono).toMatch(/var\(\s*--font-mono\s*,\s*"IBM Plex Mono"\s*\)/);
    expect(mono).toMatch(/monospace\s*$/);
  });
});

/* The original --brand-mono bug had two halves. The fallback sat outside the
   var(), which the tests above now catch — but the reason it mattered is that
   --font-mono was named by brand.css and set by nobody: fonts.ts exported
   display and body only, and had done since phase 2 while the comment beside
   the token said Plex would arrive "at phase 4". A token that reads a variable
   no one defines is the bug; the broken fallback only decided how loudly it
   failed. This is the half that notices. */
describe("brand.css and fonts.ts agree on what is defined", () => {
  const fontsTs = readFileSync(new URL("./fonts.ts", import.meta.url), "utf8");

  const declared = new Set(
    [...fontsTs.matchAll(/variable:\s*"(--font-[\w-]+)"/g)].map(([, v]) => v),
  );
  const referenced = new Set(
    [...brandCss.matchAll(/var\(\s*(--font-[\w-]+)/g)].map(([, v]) => v),
  );

  test("fonts.ts exports all three faces", () => {
    expect([...declared].sort()).toEqual(["--font-body", "--font-display", "--font-mono"]);
  });

  test.each([...referenced])("%s is set by a font export, not just named", (v) => {
    expect(declared).toContain(v);
  });

  test("every exported face is actually reached by a token", () => {
    // The other direction: a face loaded and never referenced is dead weight
    // downloaded on every page.
    for (const v of declared) expect(referenced).toContain(v);
  });

  test("mono ships the weights the standard asks for", () => {
    // Labels, tabs, strips and buttons are all mono 500 caps; 400 carries
    // captions and inline code. A missing 500 silently synthesises a bold.
    const block = fontsTs.slice(fontsTs.indexOf("export const mono"));
    expect(block).toMatch(/weight:\s*"400"/);
    expect(block).toMatch(/weight:\s*"500"/);
  });
});

/* After the phase 4 face flip (v1.36.0). The three faces named by the standard
   are the three the package loads, and no fourth. */
describe("the three 2027 faces", () => {
  const fontsTs = readFileSync(new URL("./fonts.ts", import.meta.url), "utf8");

  test("--brand-body lands on Stack Sans Text, and Quicksand is gone from the stack", () => {
    const stack = /--brand-body\s*:\s*([^;]+);/.exec(brandCss)?.[1] ?? "";
    expect(stack).toMatch(/var\(\s*--font-body\s*,\s*"Stack Sans Text"\s*\)/);
    expect(stack).not.toMatch(/Quicksand/);
  });

  test("no font file in the package is a Quicksand one", () => {
    expect(fontsTs).not.toMatch(/path:\s*"[^"]*Quicksand/);
  });

  test.each([
    ["display", "stack-sans-notch"],
    ["body", "stack-sans-text"],
    ["mono", "ibm-plex-mono"],
  ])("%s loads %s", (exportName, file) => {
    const block = fontsTs.slice(fontsTs.indexOf(`export const ${exportName}`));
    expect(block.slice(0, 400)).toContain(file);
  });

  test("both Stack faces declare the full 200–700 axis", () => {
    // ⚠️ Their fvar default instance is 200, so a missing or narrowed range
    // does not degrade to Regular — it degrades to hairlines. And on Notch a
    // weight outside the axis is synthesised, which smears the notch into a
    // strikethrough.
    //
    // The literal is repeated at both call sites because next/font rejects a
    // constant ("Font loader values must be explicitly written literals") and
    // only says so during `next build` — tsc and vitest both pass a version
    // that breaks every app. So the guard against the two drifting apart is
    // this test rather than a shared binding.
    for (const name of ["display", "body"]) {
      const at = fontsTs.indexOf(`export const ${name}`);
      expect(fontsTs.slice(at, at + 400)).toContain('weight: "200 700"');
    }
  });

  test("no font loader value is a constant — next/font only rejects that at build time", () => {
    const loaders = [...fontsTs.matchAll(/localFont\(\{[\s\S]*?\n\}\)/g)].map(([m]) => m);
    expect(loaders).toHaveLength(3);
    for (const block of loaders) {
      for (const [, value] of block.matchAll(/(?:path|weight|style|variable|display):\s*([^,\n}]+)/g)) {
        expect(value.trim()).toMatch(/^["']/);
      }
    }
  });
});

/* The light palette is written out TWICE — once for html[data-theme="light"]
   and once for html:not([data-theme]) inside a prefers-color-scheme query,
   which covers a page that renders before THEME_INIT_SCRIPT can stamp it.
   Plain CSS has no way to share a declaration block between a selector and a
   media query, so the duplication is unavoidable; what is avoidable is the two
   drifting. At the phase 4 flip that risk was real and immediate: every value
   in both blocks changed at once, and a miss would have shown only on an
   unstamped page on a light-preferring OS, which is the hardest surface in the
   estate to notice. */
describe("the two light blocks", () => {
  // ⚠️ Anchored to the start of a line. A bare indexOf finds the mention of
  // html[data-theme="light"] in the file header comment, forty lines above the
  // rule — which silently made this compare the DARK block against itself and
  // pass. Found while writing it, which is the only reason it is not still
  // passing vacuously.
  function block(selector: string) {
    const at = brandCss.search(new RegExp(`^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m"));
    expect(at, `${selector} not found as a rule`).toBeGreaterThan(-1);
    const open = brandCss.indexOf("{", at);
    let depth = 0;
    for (let i = open; i < brandCss.length; i++) {
      if (brandCss[i] === "{") depth++;
      else if (brandCss[i] === "}" && --depth === 0) {
        return [...brandCss.slice(open + 1, i).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
          .map(([, k, v]) => `${k}: ${v.trim()}`);
      }
    }
    throw new Error(`unbalanced braces after ${selector}`);
  }

  const stamped = block('html[data-theme="light"]');
  const unstamped = block("html:not([data-theme])");

  test("declare exactly the same tokens with the same values", () => {
    expect(unstamped).toEqual(stamped);
  });

  test("and are not empty, which would make the comparison vacuous", () => {
    expect(stamped.length).toBeGreaterThan(15);
  });
});

/* The 2027 values. Spot-checks on the handful where being wrong is invisible
   until someone complains, not a transcription of the whole palette. */
describe("the 2027 palette", () => {
  const lightAt = brandCss.search(/^html\[data-theme="light"\]\s*\{/m);
  const dark = brandCss.slice(brandCss.indexOf("@theme static"), lightAt);
  const light = brandCss.slice(lightAt);

  test("the ground and the accent are the 2027 pair", () => {
    // v3.0.0 moved the ramp down a step: the page is near black and the panel
    // took what used to be the page. #131919 is still in the palette — it is
    // --color-surface now.
    expect(dark).toMatch(/--color-bg:\s*#0d1110;/);
    expect(dark).toMatch(/--color-surface:\s*#131919;/);
    expect(dark).toMatch(/--color-accent:\s*#44d62c;/);
  });

  // ⚖️ The separation is carried by the gap, not by the tone — the pair this
  // was modelled on measured 1.071:1, LESS than the 1.088:1 it replaced. A
  // ramp shifted without the air changes almost nothing, so the token has to
  // exist for the release to mean anything.
  test("the panel gap is declared once and is not a theme value", () => {
    expect(dark).toMatch(/--panel-gap:\s*12px;/);
    // ⛔ Not redeclared per theme. The air does not change between light and
    // dark, and a second declaration is exactly the drift the single token
    // exists to prevent.
    expect(light).not.toMatch(/--panel-gap:/);
  });

  test("light moves its ground down too, and keeps the panel at white", () => {
    expect(light).toMatch(/--color-bg:\s*#e7e8e7;/);
    expect(light).toMatch(/--color-surface:\s*#ffffff;/);
  });

  test("🔴 light overrides --color-accent-mark, and it is the bright green", () => {
    // Without this, marks inherit --color-accent (Ink Green) and the light
    // theme has no bright element left anywhere.
    expect(light).toMatch(/--color-accent-mark:\s*#44d62c;/);
    expect(light).toMatch(/--color-accent:\s*#1e7d10;/);
  });

  test("dark leaves --color-accent-mark tracking the accent", () => {
    expect(dark).toMatch(/--color-accent-mark:\s*var\(--color-accent\);/);
  });

  test("success is sage, never the accent green", () => {
    // Green marks selection. If good and accent ever share a value, a selected
    // row and a passing status become the same signal.
    const good = /--color-good:\s*(#[0-9a-f]{6});/i.exec(dark)?.[1];
    expect(good?.toLowerCase()).toBe("#a8d08d");
    expect(good?.toLowerCase()).not.toBe("#44d62c");
  });

  test("no 2025 value survives anywhere in the file", () => {
    for (const dead of ["#EA27C2", "#030B1B", "#0E1729", "#C313A0", "#F5F8FA", "#FF7276"]) {
      expect(brandCss.toLowerCase()).not.toContain(`${dead.toLowerCase()};`);
    }
  });

  test("the retired groups still defined are grey, not hues", () => {
    // A retired group keeps a value rather than vanishing, so a straggler
    // degrades to grey instead of rendering as nothing. Grey is the point: if
    // one is still a hue, the retirement has not happened for whoever uses it.
    for (const t of ["cat-industry", "cat-community", "cat-marketing", "cat-lci"]) {
      expect(dark).toMatch(new RegExp(`--color-${t}:\\s*#8f8f8b;`));
    }
  });

  test("the discipline group is gone entirely, not just greyed", () => {
    // Removed 21 Oct 2026 after an estate-wide check found zero users. The
    // category and status groups are NOT gone and must not be deleted on the
    // strength of this one: partnerships still renders .chip.cat-*, and five
    // apps still render .chip.status-*.
    for (const t of ["animation", "gamedesign", "digitalart", "disc-anim", "disc-game", "disc-art"]) {
      expect(brandCss).not.toMatch(new RegExp(`^\\s*--color-${t}\\s*:`, "m"));
    }
  });

  test("--color-accent-soft is gone; --color-accent-tint is the one accent fill", () => {
    expect(brandCss).not.toMatch(/^\s*--color-accent-soft\s*:/m);
    expect(dark).toMatch(/--color-accent-tint:\s*rgba\(68, 214, 44, 0\.08\);/);
  });
});
