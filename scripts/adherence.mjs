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
import { join, relative, basename, resolve, dirname } from "node:path";

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
    msg: "Quicksand is gone. Stack Sans Text replaced it as the body face in app-shell v1.36.0, and the last fallback naming it came out of brand.css in the same release, so there is no longer anywhere this is correct. Body type reaches the face through var(--brand-body).",
  },
  {
    id: "rounded-corners",
    tier: "error",
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
    tier: "error",
    /* 🔴 A RING IS NOT A SHADOW. `box-shadow: 0 0 0 3px <colour>` has no offset
       and no blur — it draws a solid outline outside the border box, which is
       how a focus indicator is built when `outline` cannot follow the corner.
       It casts nothing. The brand bans shadows because they fake elevation,
       and a focus ring fakes nothing; WCAG 2.4.7 requires it. Flagging it put
       the geometry rule in direct conflict with an accessibility requirement,
       and "accessibility overrides brand" is a standing ruling — so the rule
       was going to lose that argument every time it was raised. Seven in the
       estate, all focus or selection rings. */
    re: /box-shadow\s*:(?!\s*(?:none|inset)(?![a-z0-9-])|\s*0 0 0 [0-9])[^;}\n\]"\x27]+|\bshadow-(?:sm|md|lg|xl|2xl)\b/g,
    msg: "No shadows. Depth in the 2027 brand is a 1px hairline, not a shadow. (An inset shadow is allowed — it draws the selected-row rule — and so is a zero-offset zero-blur ring, which is a focus indicator, not elevation.)",
  },
  {
    id: "gradient-fill",
    tier: "error",
    /* 🔴 A MASK IS NOT A FILL. `mask-image: linear-gradient(...)` paints no
       colour at all — it is how an edge fade is drawn, and the brand asks for
       an edge fade on graded photography by name. Flagging it told people to
       delete the thing the standard requires, and the obvious compliant
       rewrite (a gradient overlay in the ground colour) is an actual gradient
       fill, so the check was pushing the estate from a clean mask toward the
       thing it exists to prevent.

       🔴 A REPEATING GRADIENT IS A HATCH, NOT A FILL.
       `repeating-linear-gradient(135deg, … 0 1px, transparent 1px 5px)` draws
       1px stripes. It is not a wash and it fakes no depth — it is a non-hue
       channel carrying meaning, which is the thing this brand asks for
       everywhere else. marketing hatches a promotion window on the calendar;
       scheduling hatches the over-allocated part of a utilisation bar. CSS
       offers no other way to draw a hatch, so banning it pushes you to an
       image. marketing's test asserts the hatch is PRESENT, which is a fair
       measure of how much of a decoration it is not. */
    re: /(?<!mask-image:\s{0,8})(?<!mask:\s{0,8})(?<!repeating-)\b(?:linear|radial|conic)-gradient\s*\(|\bbg-gradient-to-[a-z]+\b/g,
    msg: "No gradients. Flat colour grounds only. The one exception in the brand is the text-protection scrim over photography, which is a gradient to the ground and belongs on an image, not on a control or a card. A mask-image gradient is not a fill and is not flagged: that is how an edge fade is drawn. Nor is a repeating-*-gradient, which is a hatch — a non-hue channel carrying meaning, and the only way CSS draws one.",
  },
  /* ── Rebuilt parts ────────────────────────────────────────────────────────
     ⚖️ WHY THESE EXIST. Every other rule here checks a VALUE — a hex, a face,
     a radius, a shadow. None of them checks whether a part was rebuilt, and
     that is the gap that let the estate fork while the count read zero.

     Found 22 Oct 2026 by releasing a change to Ledger, Status and Delta and
     then discovering no app imports any of them. Apps take Breadcrumb,
     Header, SubNav, useUrlState, THEME_INIT_SCRIPT, the fonts and the
     stylesheet; the data parts they hand-rolled. 112 raw <table> files across
     14 apps, every adherence run green. It also explains the chart-colour
     sweep needing three passes and still missing two files: a package change
     cannot reach a part the app rebuilt.

     ⚠️ ADVISORY ON PURPOSE, FOR NOW. Erroring would take 14 repos red in one
     commit for debt they did not create this week, which is how a checker
     gets switched off. Advisory makes the number visible and trackable; the
     tier moves to "error" once the estate is near zero, the way geometry did
     at the phase 4 flip.

     ⛔ NOT run against the package itself, which is where these parts are
     SUPPOSED to be defined — see IN_PACKAGE. And HTML email is already exempt
     by path: an email table is a layout requirement, not a rebuilt part. */
  {
    id: "accent-as-paint",
    tier: "advisory",
    /* ── Ink is not paint ─────────────────────────────────────────────────
       brand.css splits the accent in light mode and in light mode ONLY:
       --color-accent becomes Ink Green #1e7d10, which clears 5.2:1 as TEXT on
       white, while --color-accent-mark stays #44d62c for the things that are
       marks. On dark the two resolve to the same value, so choosing wrong is
       invisible until someone flips the theme — which is why this needs a
       checker and not a reviewer. Found live in home 23 Oct 2026: the selected
       subject tab underlined itself with --color-accent and computed
       rgb(30,125,16), a dull edge against the hairline beneath it.

       🔴 "DOES THE SAME RULE SET `color:`?" IS THE WRONG TEST, and it was the
       first one tried. This checker matches a LINE, so it cannot see a block;
       worse, the test is wrong even given the whole block. `.srp-tab.selected`
       sets `color: var(--color-text)` AND underlines itself — the ink is
       beside the mark, not on it. The heuristic would have passed the exact
       defect that prompted the rule.

       ⚖️ So the rule asks something decidable instead: is the accent being used
       as PAINT — background, border colour, fill, stroke — rather than as ink?
       Every such use needs a deliberate answer, because only the author knows
       whether type sits on that paint. A fill with a label on it (a badge, an
       active segmented button) genuinely wants Ink Green, since the bright
       mark under --color-bg is ~1.9:1 and unreadable; those take a pragma with
       a reason, which is a recorded decision rather than an eyeball.

       ⛔ `outline` IS EXCLUDED, both as a property and as any line mentioning
       it. A focus indicator is an accessibility requirement, not a brand mark,
       and on white Ink Green is the VISIBLE one where the bright mark would be
       the regression — so flagging it would push the estate the wrong way, the
       same argument `drop-shadow` already lost over focus rings.

       🔴 THE EXCLUSION IS A VARIABLE-LENGTH LOOKBEHIND, NOT A LOOKAHEAD. The
       estate draws focus as a border under `outline: none`, so the word to
       suppress on sits BEFORE the paint on the line. A lookahead anchors at
       the match and can only see what follows it, which let every one of
       those through on the first draft (3 in home, 2 in the package, all
       reported as real). `[^{}]*` crosses the `;` between the two
       declarations but not a brace, so the next rule of a one-line pair is
       still checked.

       ⚠️ KNOWN AND ACCEPTED: a focus block that puts `outline: none` on its
       OWN line is still flagged, because the runner matches one line at a
       time and no lookbehind reaches the line above. 2 in the package, a
       handful across the estate. They take the pragma. Widening the runner to
       blocks for one rule's false positive is the worse trade.

       ⚠️ ADVISORY, like the rebuilt parts below and for the same reason: the
       estate has hundreds of accent uses and erroring takes 17 repos red for
       debt they did not create this week. Move it to "error" once the count
       is near zero. */
    re: /(?<!\boutline\b[^{}]*)(?:background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|fill|stroke)\s*:[^;}]*var\(\s*--color-accent\s*\)/g,
    msg: "Accent used as paint. In light mode --color-accent is Ink Green #1e7d10 (a TEXT value) while --color-accent-mark stays #44d62c, so a bar, rule, tick or dot written with --color-accent goes dull in light and nobody sees it on dark. Use --color-accent-mark. If type sits ON this paint, --color-accent is correct and the line needs `cgsi-adherence-allow: accent-as-paint — <why>`.",
  },
  {
    id: "rebuilt-table",
    tier: "advisory",
    packageExempt: true,
    re: /<table\b/g,
    msg: "Rebuilt table. Hard rule 2: never rebuild a panel, KPI tile, table, filter bar, status, notice, tabs or segmented control in an app — import Ledger from @cgsi/app-shell. A hand-rolled table misses every package change: the mono data treatment, the density rungs, the sort affordance, the sticky first column and the empty and loading states. If Ledger cannot do the job, extend Ledger.",
  },
  {
    id: "rebuilt-part",
    tier: "advisory",
    packageExempt: true,
    re: /\b(?:function|const)\s+(?:Ledger|Panel|Kpi|KPI|Status|StatusBadge|Badge|Notice|FilterBar|SegmentedControl|Segmented|RecordCard|Breadcrumb)\b/g,
    msg: "Rebuilt part. Hard rule 2: import it from @cgsi/app-shell rather than redefining it locally. A local Badge is usually also a shape the brand does not have — status is a glyph plus a word, never a pill and never a filled badge.",
  },
  {
    id: "off-scale-spacing",
    tier: "advisory",
    /* ⚖️ NINE STEPS SINCE 23 OCT 2026, up from six (4, 8, 12, 16, 24, 40).
       Counted across all 17 apps: 1,631 padding/margin/gap values, 969 of them
       off the six steps. A rule a mature estate breaks 59% of the time is
       describing the estate wrongly; it is not a backlog of 969 mistakes.

       2 and 6 complete the FINE end. 223 values sit on them, almost all nudges
       inside a text block — a name and its sub-line, the inside of a chip. The
       old ladder started at 4, so the only compliant move was rounding up,
       which loosens dense type in 103 places estate-wide and buys nothing.
       32 fills the 24 → 40 jump and was already the compact table row.

       ⛔ 10, 14 and 20 were considered and REJECTED, though adding them would
       have taken the count from 969 to 355. They are where layout values drift
       TO, and legalising them turns the ladder into "any even number" — the
       rhythm the scale exists to create, traded for a better report. 10 → 8/12
       and 14 → 12/16 are the estate's two commonest corrections (338 values)
       and they are the whole point of having a scale.

       ⚠️ Still advisory. 736 values remain, 663 of which move 2px or less and
       are a mechanical sweep; the other 73 are design decisions and want eyes.
       Move to "error" once the estate is near zero, as geometry did at the
       phase 4 flip. @see cgsi-2027-design guidelines/surface-app-layer.md,
       which is the source and was amended FIRST. */
    re: /(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|block|inline))?\s*:\s*[^;}\n]*?\b(?!(?:0|2|4|6|8|12|16|24|32|40)px)\d+px/g,
    msg: "Off-scale spacing. The app layer has nine steps: 2, 4, 6, 8, 12, 16, 24, 32, 40. 10 and 14 are the two commonest drifts and both are deliberately NOT steps — 10 goes to 8 or 12, 14 to 12 or 16, and that choice is the rhythm. Row heights (40 / 32) come from the density setting, not a literal.",
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
/* ⚖️ GEOMETRY IS ENFORCED AS OF THE PHASE 4 FLIP (21 Oct 2026). It used to be
   reported separately, because the estate was still 2025 and its chrome was
   correctly rounded — failing a repo for being what it was supposed to be
   teaches people to switch the check off. That argument expired the moment
   the values flipped: every repo is at zero geometry, the brand it is being
   measured against is the one it now wears, and the only thing a separate
   tier buys from here is somewhere for new rounding to accumulate quietly.

   The --geometry flag is kept so existing CI and muscle memory do not break.
   It is now a no-op: the rules it used to reveal run by default. */
/* Accepted and ignored. Reading it keeps the flag out of `roots` below, which
   is the only job it still has — without this, `--geometry` would be treated
   as a directory to scan. */
void args.includes("--geometry");
const roots = args.filter((a) => !a.startsWith("--"));
const targets = roots.length ? roots : ["src"];

/* The package is where the shared parts are DEFINED, so the rebuilt-part rules
   must not fire on it.
   🔴 Keyed to the SCANNED ROOT, not to cwd. Keying it to cwd looked right and
   was wrong in the one place it matters: the regression tests run the script
   from the package against a temp directory, so every rebuilt-part case came
   back clean and would have shipped a rule that never fires.
   A missing or unreadable manifest means "not the package", which is the safe
   way round — an app without one still gets checked. */
function inPackage(start) {
  let dir = resolve(start);
  for (;;) {
    try {
      const name = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name;
      if (name) return name === "@cgsi/app-shell";
    } catch {
      /* keep walking up */
    }
    const up = dirname(dir);
    if (up === dir) return false;
    dir = up;
  }
}

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
  const rootInPackage = inPackage(root);
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
        if (rule.packageExempt && rootInPackage) continue;
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

const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule.id)) byRule.set(f.rule.id, []);
  byRule.get(f.rule.id).push(f);
}

for (const [id, group] of byRule) {
  const { tier, msg } = group[0].rule;
  const banner = tier === "error" ? "ERROR" : "ADVISORY";
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
    ` across ${targets.join(", ")}`
);

if (!advisory && errors.length === 0) {
  console.log("Run with --advisory for the spacing scale and rebuilt parts.");
}

process.exit(errors.length > 0 ? 1 : 0);
