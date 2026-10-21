import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

// Regression tests for scripts/adherence.mjs.
//
// ⚖️ RUN AS A SUBPROCESS, NOT IMPORTED. The script is deliberately a
// single dependency-free file, because CI in 17 repos fetches and runs it
// directly rather than installing it. Extracting its rules into an importable
// module to make testing tidier would break that. So the test drives it the way
// CI does.
//
// 🔴 EVERY CASE HERE IS A BUG THAT ACTUALLY SHIPPED. Two of them twice.

// ESM: the package is "type": "module", so there is no __dirname.
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "scripts", "adherence.mjs");
const dirs: string[] = [];

function check(files: Record<string, string>, ...flags: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "adherence-"));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  try {
    const out = execFileSync("node", [SCRIPT, dir, ...flags], { encoding: "utf8" });
    return { out, exit: 0 };
  } catch (e) {
    const err = e as { stdout?: string; status?: number };
    return { out: err.stdout ?? "", exit: err.status ?? -1 };
  }
}

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("the backtracking lookahead bug — shipped twice", () => {
  // Written `prop\s*:\s*(?!value)`, the trailing \s* backtracks to zero width,
  // the lookahead tests the SPACE after the colon rather than the value, and
  // every declaration matches including the legal ones. It happened first on
  // font-family and then again, identically, on border-radius and box-shadow.

  test("font-family through a brand token is not flagged", () => {
    const { out } = check({ "a.css": ".x { font-family: var(--brand-body); }" });
    expect(out).not.toContain("non-brand-font");
  });

  test("a non-brand font-family IS flagged", () => {
    const { out, exit } = check({ "a.css": ".x { font-family: Comic Sans, cursive; }" });
    expect(out).toContain("non-brand-font");
    expect(exit).toBe(1);
  });

  test("border-radius: 0 is not flagged", () => {
    const { out } = check(
      { "a.css": ".x { border-radius: 0; }\n.y { border-radius: 0px; }\n.z { border-radius: 0%; }" },
      "--geometry",
    );
    expect(out).not.toContain("rounded-corners");
  });

  test("a non-zero radius IS flagged", () => {
    const { out } = check({ "a.css": ".x { border-radius: 8px; }" }, "--geometry");
    expect(out).toContain("rounded-corners");
  });

  test("box-shadow: none and inset are not flagged — inset draws the selected row", () => {
    const { out } = check(
      { "a.css": ".x { box-shadow: none; }\n.y { box-shadow: inset 3px 0 0 red; }" },
      "--geometry",
    );
    expect(out).not.toContain("drop-shadow");
  });

  test("🔴 a Tailwind arbitrary inset is not flagged — underscores are word characters", () => {
    // `[box-shadow:inset_3px_0_0_var(--x)]`: `inset\b` fails because `_` is a
    // word char, so the lookahead passed and the rule replaced the very inset
    // shadow it exists to protect — truncating the string and breaking
    // auditapp's selected-row rule.
    const { out } = check(
      { "a.tsx": 'const c = "bg-x [box-shadow:inset_3px_0_0_var(--color-accent)]";' },
      "--geometry",
    );
    expect(out).not.toContain("drop-shadow");
  });

  test("an outer shadow IS flagged", () => {
    const { out } = check({ "a.css": ".x { box-shadow: 0 8px 24px rgba(0,0,0,.3); }" }, "--geometry");
    expect(out).toContain("drop-shadow");
  });
});

describe("the identifier bug — a codemod acting on it broke a build", () => {
  // `\brounded\b` matched the variable in `const rounded = Math.round(...)`.
  // A substitution driven off that flag renamed it to `rounded-none` and
  // CourseTypes.tsx stopped parsing.

  test("a variable named `rounded` is not a Tailwind class", () => {
    const { out } = check(
      { "a.tsx": "const rounded = Math.round(n * 10) / 10;\nexport const x = rounded.toFixed(1);" },
      "--geometry",
    );
    expect(out).not.toContain("rounded-corners");
  });

  test("the word 'rounded' in prose is not a class either", () => {
    const { out } = check({ "a.tsx": 'const label = "this is rounded nicely";' }, "--geometry");
    expect(out).not.toContain("rounded-corners");
  });

  test("but `rounded` in a className IS flagged", () => {
    const { out } = check({ "a.tsx": 'export const A = () => <div className="rounded border" />;' }, "--geometry");
    expect(out).toContain("rounded-corners");
  });

  test("and `rounded-lg` is flagged anywhere, being distinctive enough", () => {
    const { out } = check({ "a.tsx": 'const c = "rounded-lg";' }, "--geometry");
    expect(out).toContain("rounded-corners");
  });

  test("rounded-none is the fix, so it must never be flagged", () => {
    const { out } = check({ "a.tsx": 'export const A = () => <div className="rounded-none" />;' }, "--geometry");
    expect(out).not.toContain("rounded-corners");
  });
});

describe("the comment bug — the check flagged the note explaining the rule", () => {
  // SubNav.tsx carries "#EA27C2 under white fails AA at this size" above code
  // that correctly uses tokens. Reporting it teaches people to delete the
  // explanation.

  test("hex inside a line comment is not flagged", () => {
    const { out } = check({ "a.tsx": "// #EA27C2 under white fails AA at this size\nconst x = 1;" });
    expect(out).not.toContain("raw-hex");
  });

  test("hex inside a block comment is not flagged", () => {
    const { out } = check({ "a.css": "/* was #EA27C2, now a token */\n.x { color: var(--color-accent); }" });
    expect(out).not.toContain("raw-hex");
  });

  test("hex in real code IS flagged", () => {
    const { out, exit } = check({ "a.css": ".x { color: #EA27C2; }" });
    expect(out).toContain("raw-hex");
    expect(exit).toBe(1);
  });

  test("blanking comments preserves line numbers", () => {
    const { out } = check({
      "a.css": "/* a\n   multi\n   line */\n.x { color: #EA27C2; }",
    });
    expect(out).toMatch(/a\.css:4/);
  });
});

describe("things that look like hex but are not", () => {
  test("🔴 an HTML entity is not a colour", () => {
    // `&#160;` is a non-breaking space, `&#8217;` a curly apostrophe. Caught
    // flagging an entity-strip in marketing's blog-post cleaner.
    const { out, exit } = check({ "a.ts": '.replace(/&nbsp;|&#160;|\u00a0/g, " ")' });
    expect(out).not.toContain("raw-hex");
    expect(exit).toBe(0);
  });

  test("a real hex beside an entity is still caught", () => {
    const { out } = check({ "a.ts": 'const a = "&#160;"; const b = "#EA27C2";' });
    expect(out).toContain("raw-hex");
  });
});

describe("tiers", () => {
  test("geometry findings do not fail the build by default", () => {
    const { out, exit } = check({ "a.css": ".x { border-radius: 8px; }" });
    expect(exit).toBe(0);
    expect(out).not.toContain("rounded-corners");
  });

  test("freeze findings always fail the build", () => {
    const { exit } = check({ "a.css": ".x { color: #EA27C2; }" });
    expect(exit).toBe(1);
  });

  test("geometry findings are reported but still do not fail, even when asked for", () => {
    // They describe the destination brand. The estate is correctly rounded
    // today; erroring would fail every repo for being what it is meant to be.
    const { out, exit } = check({ "a.css": ".x { border-radius: 8px; }" }, "--geometry");
    expect(out).toContain("rounded-corners");
    expect(exit).toBe(0);
  });
});

describe("suppression pragmas", () => {
  test("a pragma with a reason suppresses its rule", () => {
    const { out, exit } = check({
      "a.css": "/* cgsi-adherence-allow: raw-hex — transitional, removed in phase 4 */\n.x { color: #EA27C2; }",
    });
    expect(out).not.toContain("raw-hex");
    expect(exit).toBe(0);
  });

  test("🔴 a pragma WITHOUT a reason suppresses nothing", () => {
    // The reason is what makes a suppression reviewable rather than a way to
    // make the check quiet.
    const { out, exit } = check({
      "a.css": "/* cgsi-adherence-allow: raw-hex */\n.x { color: #EA27C2; }",
    });
    expect(out).toContain("raw-hex");
    expect(exit).toBe(1);
  });

  test("a pragma stops at the end of its CSS block, not leaking into the next selector", () => {
    const { out } = check({
      "a.css": [
        "/* cgsi-adherence-allow: raw-hex — only this rule */",
        ".x { color: #EA27C2; }",
        ".y { color: #FF0000; }",
      ].join("\n"),
    });
    expect(out).toContain("a.css:3");
    expect(out).not.toContain("a.css:2");
  });
});

describe("the retired token groups", () => {
  test.each([
    ["--color-animation", "deprecated-discipline"],
    ["--color-gamedesign", "deprecated-discipline"],
    ["--color-disc-anim", "deprecated-discipline"],
    ["--color-cat-industry", "deprecated-category"],
    ["--color-accent-soft", "deprecated-soft"],
    ["--color-good-soft", "deprecated-soft"],
  ])("%s is frozen (%s)", (token, rule) => {
    const { out, exit } = check({ "a.css": `.x { color: var(${token}); }` });
    expect(out).toContain(rule);
    expect(exit).toBe(1);
  });

  test("--color-accent-tint survives: it is the one accent fill 2027 keeps", () => {
    const { out, exit } = check({ "a.css": ".x { background: var(--color-accent-tint); }" });
    expect(out).not.toContain("deprecated-soft");
    expect(exit).toBe(0);
  });
});

describe("alpha hex — the sweep that reported itself complete", () => {
  // The raw-hex pattern was `#[0-9a-fA-F]{6}\b | #[0-9a-fA-F]{3}\b`. Against
  // `#dc262655` the 6-digit arm matches `#dc2626`, then its `\b` fails on the
  // `5`; the 3-digit arm fails the same way; the value passes as clean. home's
  // globals.css carried four of them through a sweep reported as finished.
  test("#rrggbbaa is a colour", () => {
    const { out, exit } = check({ "a.css": ".x { background: #dc262655; }" });
    expect(out).toContain("raw-hex");
    expect(out).toContain("#dc262655");
    expect(exit).toBe(1);
  });

  test("#rgba is a colour", () => {
    const { out, exit } = check({ "a.css": ".x { background: #f00a; }" });
    expect(out).toContain("raw-hex");
    expect(exit).toBe(1);
  });

  test("the longest arm wins — an 8-digit value is not reported as its first six", () => {
    // Ordering the alternatives shortest-first reports `#dc2626`, which sends
    // whoever reads the output looking for a string that is not in the file.
    const { out } = check({ "a.css": ".x { background: #dc262655; }" });
    expect(out).not.toContain(" #dc2626\n");
  });

  test("HTML entities are still not colours", () => {
    // The &-lookahead has to survive on every new arm. `&#8217;` is eight
    // characters of digits after a hash.
    const { exit } = check({ "a.tsx": "const s = 'it&#8217;s';" });
    expect(exit).toBe(0);
  });
});

describe("hex alpha glued to a var() — what the codemod left behind", () => {
  // Replacing the 6-digit head of `#dc262655` with the token leaves
  // `var(--color-bad)55`. Invalid, dropped by the browser, silent. Both halves
  // look legitimate to every other rule, so it needs one of its own.
  test("var(--token)55 is flagged", () => {
    const { out, exit } = check({
      "a.css": ".x { border-color: var(--color-bad)55; }",
    });
    expect(out).toContain("glued-alpha");
    expect(exit).toBe(1);
  });

  test("the 1a form is flagged too", () => {
    const { out } = check({ "a.css": ".x { background: var(--color-bad)1a; }" });
    expect(out).toContain("glued-alpha");
  });

  test("a var() with a fallback is not immune", () => {
    const { out } = check({ "a.css": ".x { color: var(--color-bad, #000)55; }" });
    expect(out).toContain("glued-alpha");
  });

  test("a well-formed var() is left alone", () => {
    const { out, exit } = check({
      "a.css": [
        ".x { color: var(--color-bad); }",
        ".y { background: color-mix(in srgb, var(--color-bad) 33%, transparent); }",
        ".z { font-family: var(--font-body, 'Stack Sans Text'), sans-serif; }",
      ].join("\n"),
    });
    expect(out).not.toContain("glued-alpha");
    expect(exit).toBe(0);
  });

  test("a var() followed by a unit or an identifier is not a glued alpha", () => {
    // `var(--gap)px` is its own bug, but it is not this one, and reporting it
    // as a dropped colour sends the reader to the wrong fix. Two hex digits,
    // and the pattern only matches characters that could be alpha.
    const { out } = check({ "a.css": ".x { margin: var(--gap)rem; }" });
    expect(out).not.toContain("glued-alpha");
  });
});
