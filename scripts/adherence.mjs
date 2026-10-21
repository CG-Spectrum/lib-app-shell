#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   CGSI app-layer brand adherence check.

   Ships from @cgsi/app-shell so all 17 consuming apps run one source of truth:

     npx cgsi-adherence            # lint ./src
     npx cgsi-adherence src app    # lint named roots
     npx cgsi-adherence --advisory # also report the advisory tier

   Why this and not oxlint. The brand skill ships `_adherence.oxlintrc.json`,
   but it does not run: oxlint rejects its top-level `x-omelette` key, and it
   has no `no-restricted-syntax` rule, which is what every check in that file
   is built on. It is also the WEBSITE config — its tokens are `--cg-*` and its
   components are MentorCard / RoomTile / WorkTile, none of which exist in an
   app. Checked against oxlint 1.87.0, Oct 2026.

   The deciding reason is CSS. oxlint parses JS/TS/JSX only, and most of the
   estate's raw hex is in stylesheets, not components: courseapp's 54 values and
   studentportal's 54 are each almost entirely in one globals.css. A JS-only
   linter cannot see the majority of the problem. This reads both.

   No dependencies, so adding it to a repo is one devDependency bump and one CI
   step, not a toolchain decision.
   ──────────────────────────────────────────────────────────────────────────── */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";

const SOURCE_EXT = /\.(tsx?|jsx?|mjs|cjs|css|scss)$/;
const SKIP_DIR = /^(node_modules|\.next|\.git|dist|build|coverage|out)$/;

/* brand.css is the one file allowed to hold raw colour: it is where the tokens
   are defined. Tests assert on literals, so they are exempt too. */
/* 🔴 EMAIL IS NOT THE APP LAYER. Email clients do not support CSS variables,
   so an email template MUST inline its hex and use a web-safe face — one
   marketing file carries the note "every colour is explicit: an inherited one
   has rendered dark-on-dark". Flagging those teaches people the check is
   wrong rather than the code. The brand treats email as its own surface
   (600 wide) for the same reason. Anything outside this naming convention
   should carry a pragma naming email as the reason. */
const EXEMPT = (path) =>
  basename(path) === "brand.css" ||
  /\.(test|spec)\.[tj]sx?$/.test(path) ||
  /email/i.test(path);

/* The live app-layer tokens, for the "use this instead" hint. */
const TOKENS =
  "--color-bg | surface | surface-2 | surface-3 | border | border-strong | " +
  "text | text-2 | text-3 | accent | accent-mark | accent-tint | good | warn | " +
  "bad | info | attention";

const RULES = [
  {
    id: "raw-hex",
    tier: "error",
    /* 🔴 NOT PRECEDED BY `&`. `&#160;` is a non-breaking space and `&#8217;` a
       curly apostrophe; both look like a short hex to a naive pattern. Found
       flagging an HTML-entity strip in marketing's blog-post cleaner.

       🔴 8 AND 4 DIGITS FIRST, AND THEY NEED THEIR OWN ALTERNATIVES. #rrggbbaa
       is a colour too, and the original pattern could not see one: against
       `#dc262655` the 6-digit arm matches `#dc2626` and then fails its `\b` on
       the `5`, the 3-digit arm fails the same way, and the whole value passes
       as clean. home carried four alpha tints straight through a sweep that
       was reported as complete. Longest first, or the 6-digit arm eats the
       first six characters of an 8-digit value and reports the wrong colour. */
    re: /(?<!&)#[0-9a-fA-F]{8}\b|(?<!&)#[0-9a-fA-F]{6}\b|(?<!&)#[0-9a-fA-F]{4}\b|(?<!&)#[0-9a-fA-F]{3}\b/g,
    msg: `Raw hex colour. Use a token: ${TOKENS}. If the colour is missing, add it to app-shell brand.css, not to this app.`,
  },
  {
    id: "glued-alpha",
    tier: "error",
    /* 🔴 THE CODEMOD MADE THIS ONE. Swapping `#dc2626` for `var(--color-bad)`
       inside the 8-digit `#dc262655` leaves `var(--color-bad)55` — not a
       transparent red, not a colour at all. The declaration is invalid and the
       browser drops it, so the element silently loses its border or its tint
       and nothing anywhere says so. Four of these shipped in home's globals.css
       in the sweep that closed 137 findings.

       It has to be its own rule. The dangling digits are not hex (no `#`), the
       var() name is a live token, and the only thing wrong is the join — every
       other check reads both halves as legitimate.

       The fix is color-mix, which is the only way to tint a token:
         color-mix(in srgb, var(--color-bad) 33%, transparent)    // 55 ≈ 33%
       Browser support is universal in the estate's targets. */
    re: /var\(\s*--[\w-]+\s*(?:,[^()]*)?\)[0-9a-fA-F]{2,}\b/g,
    msg: "Hex alpha digits glued to a var(). `var(--color-bad)55` is not a colour — the declaration is invalid and the browser drops it, so the tint or border vanishes with no error. A codemod that replaced the 6-digit head of an 8-digit hex leaves exactly this. Tint a token with color-mix(in srgb, var(--token) NN%, transparent).",
  },
  {
    id: "deprecated-discipline",
    tier: "error",
    re: /--color-(?:animation|gamedesign|digitalart|disc-(?:anim|game|art))(?:-soft|-border)?\b/g,
    msg: "DEPRECATED (2027): discipline colours were retired Sept 2026. Disciplines are NAMED, not coloured. Render the discipline name as text.",
  },
  {
    id: "deprecated-category",
    tier: "error",
    re: /--color-cat-[a-z]+(?:-soft|-border)?\b/g,
    msg: "DEPRECATED (2027): event-category colours are retired. The 2027 calendar carries event type as a 3px inside-left rule with the name in paper.",
  },
  {
    id: "deprecated-soft",
    tier: "error",
    re: /--color-(?:accent|good|warn|bad|success|warning|error|attention)-soft\b|--color-surface-(?:success|warning|error)-soft\b/g,
    msg: "DEPRECATED (2027): tinted fills are retired. A status is a glyph plus a word; a notice is a hairline in the status hue. The only surviving accent fill is var(--color-accent-tint), for a selected row or chip.",
  },
  {
    id: "non-brand-font",
    tier: "error",
    /* The optional whitespace lives INSIDE the lookahead. Written as
       `font-family\s*:\s*(?!...)` the trailing `\s*` backtracks to zero width,
       the lookahead then tests the space rather than the value, and every
       declaration matches including the legal ones.

       🔴 `fontFamily` TOO. The hyphen is optional because half this estate sets
       type from a React style object, and `fontFamily: "monospace"` is the same
       declaration as `font-family: monospace` by the time it reaches the DOM.
       Only the CSS spelling was checked, so a font set inline from JSX was
       invisible — found in governance and referrals, both otherwise at zero.
       The value terminator already stops at `}` and the newline, which is what
       closes a style object as surely as `;` closes a declaration.

       The comma is the hard part. It separates the properties of a style
       object AND the faces of a font stack, so it cannot simply end the value:
       stopping there would report `font-family: Arial` and hide the rest of a
       legitimate CSS stack. It ends the value only when what follows looks
       like the next object key — an identifier and a colon — which
       `sans-serif` never does and `fontSize: 12` always does. Without that,
       the finding for a one-line style object dragged the rest of the object
       in with it and read as though the font were four properties long. */
    re: /font-?family\s*:(?!\s*['"]?(?:var\(|inherit|initial|unset|Stack Sans Notch|Stack Sans Text|IBM Plex Mono))[^;}\n]+?(?=,\s*[A-Za-z_$][\w$]*\s*:|[;}\n]|$)/gi,
    msg: "Font not provided by the app layer. Three faces only: Stack Sans Notch (display), Stack Sans Text (body, 400), IBM Plex Mono (labels, 500 caps). Reach them via var(--brand-display) / var(--brand-body).",
  },
  {
    id: "quicksand",
    tier: "error",
    re: /Quicksand/g,
    msg: "Quicksand is replaced in the 2027 brand. It survives only as the fallback inside brand.css --brand-body until the phase 4 flip, and nowhere else.",
  },
  {
    id: "rounded-corners",
    tier: "geometry",
    /* The bare `rounded` alternative needs a class context. Without one it
       matches the IDENTIFIER in `const rounded = Math.round(...)`, which this
       check did — and a blind codemod acting on that flag renamed the variable
       and broke the build. `rounded-lg` and friends are distinctive enough to
       match anywhere; plain `rounded` is an ordinary English word. */
    re: /border-radius\s*:(?!\s*(?:0\b|0px|0%))[^;}\n]+|\brounded-(?:sm|md|lg|xl|2xl|3xl|full)\b|(?:class|className)\s*=[^>]*?\brounded\b(?!-)/g,
    msg: "Square corners. The 2027 brand is radius 0 on everything: buttons, fields, cards, images, radios. A pill or a circular avatar is a 2025 shape and survives a token swap, which is why this is checked separately from colour.",
  },
  {
    id: "drop-shadow",
    tier: "geometry",
    re: /box-shadow\s*:(?!\s*(?:none|inset)(?![a-z0-9-]))[^;}\n\]"\x27]+|\bshadow-(?:sm|md|lg|xl|2xl)\b/g,
    msg: "No shadows. Depth in the 2027 brand is a 1px hairline, not a shadow. (An inset shadow is allowed: it is how the selected-row rule is drawn.)",
  },
  {
    id: "gradient-fill",
    tier: "geometry",
    /* 🔴 A MASK IS NOT A FILL. `mask-image: linear-gradient(...)` paints no
       colour at all — it is how an edge fade is drawn, and the brand asks for
       an edge fade on graded photography by name. Flagging it told people to
       delete the thing the standard requires, and the obvious compliant
       rewrite (a gradient overlay in the ground colour) is an actual gradient
       fill, so the check was pushing the estate from a clean mask toward the
       thing it exists to prevent. */
    re: /(?<!mask-image:\s{0,8})(?<!mask:\s{0,8})\b(?:linear|radial|conic)-gradient\s*\(|\bbg-gradient-to-[a-z]+\b/g,
    msg: "No gradients. Flat colour grounds only. The one exception in the brand is the text-protection scrim over photography, which is a gradient to the ground and belongs on an image, not on a control or a card. A mask-image gradient is not a fill and is not flagged: that is how an edge fade is drawn.",
  },
  {
    id: "off-scale-spacing",
    tier: "advisory",
    re: /(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|block|inline))?\s*:\s*[^;}\n]*?\b(?!(?:0|4|8|12|16|24|40)px)\d+px/g,
    msg: "Off-scale spacing. The app layer has six steps: 4, 8, 12, 16, 24, 40. Row heights (40 / 32) come from the density setting, not a literal.",
  },
];

/* Blank out comment bodies, preserving newlines so reported line numbers stay
   correct. Deliberately simple: it does not parse strings, so a `//` inside a
   URL literal blanks the rest of that line. The cost is a missed finding on
   such a line, which is the right way round for a check that gates CI. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
}

/* `cgsi-adherence-allow: <rule-id>[,<rule-id>] — <reason>`
   Suppresses the named rules on the line carrying the pragma or the line after
   it. The reason is mandatory and is what makes a suppression reviewable: a
   pragma without one does not suppress anything. Use it only for a token the
   package still has to define while apps migrate off it, never for new code.
   `*` suppresses every rule on that line and should be rare enough to argue
   about in review. */
const PRAGMA = /cgsi-adherence-allow:\s*([a-z*,\s-]+?)\s*(?:—|--)\s*\S/i;

/* Build, per line, the set of rules suppressed there. A pragma covers its own
   line and everything down to the next `}` or blank line, capped at 12, so one
   comment above a CSS rule covers that rule's declarations and stops at its
   closing brace instead of leaking into the next selector. */
function buildAllowMap(rawLines) {
  const map = rawLines.map(() => null);
  rawLines.forEach((line, i) => {
    const m = PRAGMA.exec(line);
    if (!m) return;
    const ids = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    for (let j = i; j < Math.min(i + 12, rawLines.length); j++) {
      if (!map[j]) map[j] = new Set();
      for (const id of ids) map[j].add(id);
      const body = rawLines[j].trim();
      /* Ends at a blank line or the close of the block. `endsWith("}")` rather
         than `=== "}"` because a single-line rule (`.x { color: red; }`) never
         puts the brace on its own line, and matching only the bare form let a
         pragma leak into the NEXT selector — caught by adherence.test.ts. */
      if (j > i && (body === "" || body.endsWith("}"))) break;
    }
  });
  return map;
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIR.test(name)) continue;
    const path = join(dir, name);
    let s;
    try {
      s = statSync(path);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(path, out);
    else if (SOURCE_EXT.test(name)) out.push(path);
  }
  return out;
}

const args = process.argv.slice(2);
const advisory = args.includes("--advisory");
/* Geometry is the DESTINATION brand, not the freeze. Square corners, no
   shadows and no gradients are 2027; the estate is still 2025 and its chrome
   is correctly rounded today. Reporting them as errors now would fail every
   repo for being what it is supposed to be, so they report separately and
   become errors at the phase 4 flip (swap tier to "error" then). */
const geometry = args.includes("--geometry");
const roots = args.filter((a) => !a.startsWith("--"));
const targets = roots.length ? roots : ["src"];

/* 🔴 A GENERATED FILE IS NOT WHERE THE FIX GOES. people's
   src/lib/mentor-badges.ts is emitted from @cg-spectrum/catalogue, and its
   test asserts the result matches the package verbatim. Reported as 16
   ordinary findings it reads as sixteen edits to make in people; make them and
   the test fails, which is exactly what happened on 21 Oct — edited, broke,
   reverted. A check that asks for a change the repo forbids trains people to
   stop reading it.

   So they are set aside rather than counted. ⛔ NOT silently: a skip that
   prints nothing would hide real debt behind a generator, which is a better
   hiding place than a pragma because nobody chose it. The count is printed
   with the file and the upstream owner named, so the work stays visible and
   lands where it can actually be done. */
/* `@generated` gets no leading \b: between a space and an `@` there is no word
   boundary, both being non-word characters, so the shared one silently never
   matched the most common marker of the four. */
const GENERATED = /^(?:.*\n){0,5}?.*(?:\b(?:GENERATED FILE|DO NOT EDIT|auto-generated)\b|@generated\b)/i;
const generated = [];

const findings = [];
for (const root of targets) {
  for (const path of walk(root)) {
    if (EXEMPT(path)) continue;
    /* Comments are stripped before matching, blanked rather than removed so
       line numbers and columns still line up. Without this the checker flags
       prose that explains a rule: SubNav.tsx carries the note "#EA27C2 under
       white fails AA at this size" above code that correctly uses the tokens,
       and a checker that reports it teaches people to delete the comment. */
    const raw = readFileSync(path, "utf8");
    const isGenerated = GENERATED.test(raw);
    const rawLines = raw.split("\n");
    const lines = stripComments(raw).split("\n");
    /* Pragmas are read from the RAW lines, since matching runs on the
       comment-stripped copy. A pragma must carry a reason, so a suppression is
       a recorded decision rather than a way to make the check quiet. */
    const allowMap = buildAllowMap(rawLines);
    lines.forEach((line, i) => {
      const allowed = allowMap[i] ?? new Set();
      for (const rule of RULES) {
        if (rule.tier === "advisory" && !advisory) continue;
        if (rule.tier === "geometry" && !geometry) continue;
        if (allowed.has(rule.id) || allowed.has("*")) continue;
        rule.re.lastIndex = 0;
        const hit = rule.re.exec(line);
        if (hit) {
          (isGenerated ? generated : findings).push({
            path: relative(process.cwd(), path),
            line: i + 1,
            rule,
            match: hit[0].trim().slice(0, 60),
          });
        }
      }
    });
  }
}

const errors = findings.filter((f) => f.rule.tier === "error");
const advisories = findings.filter((f) => f.rule.tier === "advisory");
const geometries = findings.filter((f) => f.rule.tier === "geometry");

const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule.id)) byRule.set(f.rule.id, []);
  byRule.get(f.rule.id).push(f);
}

for (const [id, group] of byRule) {
  const { tier, msg } = group[0].rule;
  const banner = tier === "error" ? "ERROR" : tier === "geometry" ? "GEOMETRY" : "ADVISORY";
  console.log(`\n${banner}  ${id}  (${group.length})`);
  console.log(`  ${msg}`);
  for (const f of group.slice(0, 20)) {
    console.log(`    ${f.path}:${f.line}  ${f.match}`);
  }
  if (group.length > 20) console.log(`    ... and ${group.length - 20} more`);
}

if (generated.length) {
  const byFile = new Map();
  for (const f of generated) byFile.set(f.path, (byFile.get(f.path) ?? 0) + 1);
  console.log(`\nUPSTREAM  (${generated.length})`);
  console.log(
    "  In a generated file, so not counted here and not fixable here: an edit" +
      "\n  would be overwritten by the next run and, where a test compares the" +
      "\n  output to its source, fails immediately. Fix it in the generator's" +
      "\n  input, re-run the generator, and the finding goes with it."
  );
  for (const [p, n] of byFile) console.log(`    ${p}  ${n}`);
}

console.log(
  `\n${errors.length} error${errors.length === 1 ? "" : "s"}` +
    (advisory ? `, ${advisories.length} advisory` : "") +
    (geometry ? `, ${geometries.length} geometry (2027 destination, not yet enforced)` : "") +
    ` across ${targets.join(", ")}`
);

if (!advisory && errors.length === 0) {
  console.log("Run with --advisory for spacing, --geometry for the 2027 corner/shadow/gradient debt.");
}

process.exit(errors.length > 0 ? 1 : 0);
