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
  // ⚖️ These two asserted the OPPOSITE until the phase 4 flip, and were right
  // to: geometry described the destination brand while the estate still wore
  // 2025, so erroring would have failed every repo for being what it was
  // supposed to be. The flip ended that argument — the estate now wears the
  // brand it is measured against, every repo is at zero geometry, and a
  // separate tier from here is just somewhere for new rounding to accumulate
  // quietly. Rewritten rather than deleted so the change of contract is
  // visible to whoever greps for why their build started failing.
  test("geometry findings fail the build, as of the phase 4 flip", () => {
    const { out, exit } = check({ "a.css": ".x { border-radius: 8px; }" });
    expect(out).toContain("rounded-corners");
    expect(exit).toBe(1);
  });

  test("freeze findings always fail the build", () => {
    const { exit } = check({ "a.css": ".x { color: #EA27C2; }" });
    expect(exit).toBe(1);
  });

  test("--geometry is accepted and does nothing", () => {
    // Kept so CI and muscle memory do not break. ⚠️ It must still be consumed
    // as a flag: unread, it would fall through to the list of directories to
    // scan and the run would die on a missing path called "--geometry".
    const plain = check({ "a.css": ".x { border-radius: 8px; }" });
    const flagged = check({ "a.css": ".x { border-radius: 8px; }" }, "--geometry");
    expect(flagged.exit).toBe(plain.exit);
    expect(flagged.out.replace(/adherence-\w+/g, "")).toBe(plain.out.replace(/adherence-\w+/g, ""));
  });

  test("the geometry rules are all three enforced", () => {
    for (const css of [
      ".x { border-radius: 8px; }",
      ".x { box-shadow: 0 2px 8px rgba(0,0,0,.4); }",
      ".x { background: linear-gradient(180deg, red, blue); }",
    ]) {
      expect(check({ "a.css": css }).exit, css).toBe(1);
    }
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

describe("fontFamily — the React style object the check could not see", () => {
  // Only the CSS spelling was matched, so type set inline from JSX walked
  // straight past the freeze. governance and referrals each carried one while
  // reporting zero.
  test("fontFamily: \"monospace\" is flagged", () => {
    const { out, exit } = check({
      "a.tsx": 'const s = <td style={{ fontFamily: "monospace" }} />;',
    });
    expect(out).toContain("non-brand-font");
    expect(exit).toBe(1);
  });

  test("a style object closing on the same line still terminates the value", () => {
    const { out } = check({
      "a.tsx": 'const s = <td style={{ fontFamily: "Comic Sans MS", fontSize: 12 }} />;',
    });
    expect(out).toContain("non-brand-font");
    expect(out).not.toContain("fontSize");
  });

  test("fontFamily: \"var(--brand-mono)\" passes — the quote does not hide the var", () => {
    const { out, exit } = check({
      "a.tsx": 'const s = <td style={{ fontFamily: "var(--brand-mono)" }} />;',
    });
    expect(out).not.toContain("non-brand-font");
    expect(exit).toBe(0);
  });

  test("the CSS spelling still works", () => {
    const { out } = check({ "a.css": ".x { font-family: Comic Sans MS; }" });
    expect(out).toContain("non-brand-font");
  });

  test("a legal CSS declaration is still legal", () => {
    const { exit } = check({ "a.css": ".x { font-family: var(--brand-body); }" });
    expect(exit).toBe(0);
  });
});

describe("the comma is a separator in one language and a list in the other", () => {
  test("a CSS font stack is reported whole", () => {
    const { out } = check({ "a.css": ".x { font-family: Arial, Helvetica, sans-serif; }" });
    expect(out).toContain("Arial, Helvetica, sans-serif");
  });

  test("a style object's next property is not part of the font", () => {
    const { out } = check({
      "a.tsx": 'const s = <td style={{ fontFamily: "Comic Sans MS", fontSize: 12 }} />;',
    });
    expect(out).toContain('fontFamily: "Comic Sans MS"');
    expect(out).not.toContain("fontSize");
  });
});

describe("a generated file is not where the fix goes", () => {
  // people's src/lib/mentor-badges.ts is emitted from @cg-spectrum/catalogue
  // and its test asserts the output matches the package verbatim. Reported as
  // 16 ordinary findings it read as sixteen edits to make in people; making
  // them broke the test, which is what happened on 21 Oct.
  const banner = "// GENERATED FILE — do not edit by hand.\n";

  test("its findings are set aside, not counted", () => {
    const { out, exit } = check({ "a.ts": `${banner}export const c = "#EA27C2";` });
    expect(out).toContain("UPSTREAM");
    expect(out).toContain("0 errors");
    expect(exit).toBe(0);
  });

  test("but they are still printed — a silent skip is a better hiding place than a pragma", () => {
    const { out } = check({ "a.ts": `${banner}export const c = "#EA27C2";` });
    expect(out).toContain("a.ts");
    expect(out).toMatch(/UPSTREAM {2}\(1\)/);
  });

  test.each(["@generated", "DO NOT EDIT", "auto-generated"])("%s marks it too", (mark) => {
    const { exit } = check({ "a.ts": `// ${mark}\nexport const c = "#EA27C2";` });
    expect(exit).toBe(0);
  });

  test("the banner has to be at the top, not anywhere in the file", () => {
    // Otherwise a comment mentioning a generated file elsewhere exempts the
    // whole thing, which is a one-line way to switch the check off.
    const body = Array(10).fill("// filler").join("\n");
    const { exit } = check({
      "a.ts": `${body}\n// GENERATED FILE\nexport const c = "#EA27C2";`,
    });
    expect(exit).toBe(1);
  });

  test("an ordinary file is unaffected", () => {
    const { out, exit } = check({ "a.ts": 'export const c = "#EA27C2";' });
    expect(out).not.toContain("UPSTREAM");
    expect(exit).toBe(1);
  });
});

describe("a mask gradient is not a gradient fill", () => {
  // mask-image paints no colour. It is how an edge fade is drawn, which the
  // brand asks for by name on graded photography — so flagging it told people
  // to delete the thing the standard requires, and the obvious "compliant"
  // rewrite is a real gradient overlay in the ground colour.
  test("mask-image is not flagged", () => {
    const { out } = check({
      "a.css": ".x { mask-image: linear-gradient(0deg, rgba(0,0,0,0) 10%, var(--color-bg) 50%); }",
    }, "--geometry");
    expect(out).not.toContain("gradient-fill");
  });

  test("the -webkit- prefix too", () => {
    const { out } = check({
      "a.css": ".x { -webkit-mask-image: linear-gradient(0deg, transparent, var(--color-bg)); }",
    }, "--geometry");
    expect(out).not.toContain("gradient-fill");
  });

  test("the shorthand mask property too", () => {
    const { out } = check({
      "a.css": ".x { mask: linear-gradient(0deg, transparent, var(--color-bg)); }",
    }, "--geometry");
    expect(out).not.toContain("gradient-fill");
  });

  test("an actual background gradient is still flagged", () => {
    const { out } = check({
      "a.css": ".x { background: linear-gradient(180deg, var(--color-bg), var(--color-surface)); }",
    }, "--geometry");
    expect(out).toContain("gradient-fill");
  });

  test("a gradient on the line after a mask declaration is still flagged", () => {
    // The lookbehind must not let a mask on one line excuse a fill on the next.
    const { out } = check({
      "a.css": [
        ".x { mask-image: linear-gradient(0deg, transparent, var(--color-bg)); }",
        ".y { background: linear-gradient(180deg, var(--color-bg), var(--color-surface)); }",
      ].join("\n"),
    }, "--geometry");
    expect(out).toContain("a.css:2");
    expect(out).not.toContain("a.css:1");
  });
});

describe("a focus ring is not a drop shadow", () => {
  // `box-shadow: 0 0 0 3px <colour>` has no offset and no blur: it draws a
  // solid outline outside the border box, which is how a focus indicator is
  // built when `outline` cannot follow the shape. It casts nothing. WCAG 2.4.7
  // requires the indicator, "accessibility overrides brand" is a standing
  // ruling, so a rule that flagged it was going to lose that argument every
  // time it came up.
  test("a zero-offset zero-blur ring passes", () => {
    const { out } = check({
      "a.css": ".x:focus { box-shadow: 0 0 0 3px var(--color-accent); }",
    }, "--geometry");
    expect(out).not.toContain("drop-shadow");
  });

  test("any ring width passes", () => {
    const { out } = check({
      "a.css": ".x { box-shadow: 0 0 0 2px var(--color-accent); }\n.y { box-shadow: 0 0 0 12px red; }",
    }, "--geometry");
    expect(out).not.toContain("drop-shadow");
  });

  test("a blur makes it a shadow again", () => {
    // 0 0 4px is no offset but a real blur — that is elevation.
    const { out } = check({
      "a.css": ".x { box-shadow: 0 0 4px rgba(0,0,0,.5); }",
    }, "--geometry");
    expect(out).toContain("drop-shadow");
  });

  test("an offset makes it a shadow again", () => {
    const { out } = check({
      "a.css": ".x { box-shadow: -8px 0 32px rgba(0, 0, 0, .5); }",
    }, "--geometry");
    expect(out).toContain("drop-shadow");
  });

  test("Tailwind's shadow utilities are untouched by this", () => {
    const { out } = check({ "a.tsx": '<div className="shadow-lg" />' }, "--geometry");
    expect(out).toContain("drop-shadow");
  });
});

describe("a hatch is not a gradient fill", () => {
  // repeating-linear-gradient(…, 0 1px, transparent 1px 5px) draws stripes.
  // It is not a wash and it fakes no depth — it is a non-hue channel carrying
  // meaning, which is what this brand asks for everywhere else. marketing
  // hatches a promotion window; scheduling hatches the over-allocated part of
  // a utilisation bar, and marketing's test asserts the hatch is present.
  test("repeating-linear-gradient passes", () => {
    const { out } = check({
      "a.css": ".x { background-image: repeating-linear-gradient(135deg, var(--color-accent) 0 1px, transparent 1px 5px); }",
    }, "--geometry");
    expect(out).not.toContain("gradient-fill");
  });

  test("repeating-radial-gradient too", () => {
    const { out } = check({
      "a.css": ".x { background: repeating-radial-gradient(circle, red 0 1px, transparent 1px 4px); }",
    }, "--geometry");
    expect(out).not.toContain("gradient-fill");
  });

  test("a plain linear-gradient is still a fill", () => {
    const { out } = check({
      "a.css": ".x { background: linear-gradient(180deg, var(--color-bg), var(--color-surface)); }",
    }, "--geometry");
    expect(out).toContain("gradient-fill");
  });

  test("the word repeating elsewhere on the line does not excuse a fill", () => {
    const { out } = check({
      "a.css": "/* repeating */ .x { background: linear-gradient(180deg, red, blue); }",
    }, "--geometry");
    expect(out).toContain("gradient-fill");
  });
});

describe("rebuilt parts — the gap that let the estate fork while the count read zero", () => {
  // 🔴 Found 22 Oct 2026 by releasing a change to Ledger, Status and Delta and
  // then discovering no app imports any of them. Every other rule checks a
  // VALUE; none checked whether a part was rebuilt. 112 raw <table> files
  // across 14 apps, every adherence run green.
  test("a hand-rolled table is flagged, and the message names the component", () => {
    const { out } = check({ "Dash.tsx": "export const D = () => <table><tr /></table>;" }, "--advisory");
    expect(out).toContain("rebuilt-table");
    expect(out).toContain("Ledger");
  });

  test("a locally redefined part is flagged", () => {
    const { out } = check({ "Badge.tsx": "export function StatusBadge() { return null; }" }, "--advisory");
    expect(out).toContain("rebuilt-part");
  });

  test("both are advisory, so they never fail a repo on their own", () => {
    const { out, exit } = check(
      { "Dash.tsx": "export const D = () => <table />;\nexport function Panel() { return null; }\n" },
      "--advisory",
    );
    expect(exit).toBe(0);
    expect(out).toContain("0 errors");
  });

  test("silent without --advisory, like every other advisory rule", () => {
    const { out } = check({ "Dash.tsx": "export const D = () => <table />;" });
    expect(out).not.toContain("rebuilt-table");
  });

  // ⛔ HTML email needs table layout. Exempt by path, and it must stay that way.
  test("an email template is not a rebuilt table", () => {
    const { out } = check({ "email-receipt.tsx": "export const E = () => <table />;" }, "--advisory");
    expect(out).not.toContain("rebuilt-table");
  });

  // 🔴 The exemption was keyed to cwd first. That looked right and was wrong
  // exactly here: these tests run the script FROM the package against a temp
  // directory, so every case above came back clean and the rule would have
  // shipped never firing. It is keyed to the scanned root instead.
  test("the package exemption follows the scanned root, not the working directory", () => {
    const { out } = check({ "Dash.tsx": "export const D = () => <table />;" }, "--advisory");
    expect(out).toContain("rebuilt-table");
  });
});

describe("the stock Tailwind palette — the hole raw-hex left open", () => {
  // 🔴 `#16a34a` was caught and `bg-green-600` was not, though they are the
  // same colour on the same screen. Two StatusBadge components in marketing
  // sat at "0 errors" through four sweeps while written entirely in Tailwind's
  // stock palette; 112 occurrences across seven repos were found the day the
  // rule was written.

  test("a palette class is a finding", () => {
    const { out } = check({ "a.tsx": `<span className="bg-green-100 text-green-800" />` }, "--advisory");
    expect(out).toContain("raw-palette");
  });

  test("it is advisory on arrival, so it cannot fail a repo on day one", () => {
    const { exit } = check({ "a.tsx": `<span className="bg-green-100" />` });
    expect(exit).toBe(0);
  });

  test("a dark-mode variant is still a palette class", () => {
    // `dark:` ends in a colon, which is a word boundary, so the match lands on
    // the `bg`. Half the estate's findings are spelled this way.
    const { out } = check({ "a.tsx": `<span className="dark:bg-amber-950" />` }, "--advisory");
    expect(out).toContain("raw-palette");
  });

  test("an opacity suffix does not hide it", () => {
    // `/40` starts with a non-word character, so `\b` closes on the `0`.
    const { out } = check({ "a.tsx": `<span className="bg-green-900/40" />` }, "--advisory");
    expect(out).toContain("raw-palette");
  });

  test("it reads CSS as well as components", () => {
    const { out } = check({ "a.css": `.badge { @apply bg-red-100 text-red-700; }` }, "--advisory");
    expect(out).toContain("raw-palette");
  });

  // ⛔ THE REGRESSION THAT WOULD MATTER MOST. The palette names are listed
  // explicitly rather than matched as `\w+` so that the package's own classes
  // do not report themselves. A generic pattern flags Ledger.tsx against the
  // brand it defines.
  test("a brand token class is not a palette class", () => {
    const { out, exit } = check(
      { "a.tsx": `<td className="bg-surface-2 text-text-3 border-border-strong bg-surface-3" />` },
      "--advisory",
    );
    expect(out).not.toContain("raw-palette");
    expect(exit).toBe(0);
  });

  test("a utility that merely ends in a number is not a colour", () => {
    const { out } = check(
      { "a.tsx": `<div className="grid-cols-2 gap-4 ring-2 shadow-lg text-[13px] z-10" />` },
      "--advisory",
    );
    expect(out).not.toContain("raw-palette");
  });
});
