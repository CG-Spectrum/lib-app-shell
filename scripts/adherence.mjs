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

/* 🔴 EMAIL IS NOT THE APP LAYER. Email clients do not support CSS variables,
   so an email template MUST inline its hex and use a web-safe face — one
   marketing file carries the note "every colour is explicit: an inherited one
   has rendered dark-on-dark". Flagging those teaches people the check is
   wrong rather than the code. The brand treats email as its own surface
   (600 wide) for the same reason.

   ⛔ IT WAS WRITTEN AS `/email/i.test(path)` AND MATCHED ANY SEGMENT OR
   FILENAME, so it exempted 62 source files across six repos from EVERY rule,
   the error tier included. Counted from the filesystem, 23 Oct 2026:
   marketing 41 (`src/app/email-sequences/`, an app SECTION), referrals 8,
   salesapp 6 (`src/app/coaching/email-response/`, a dashboard with a table
   and a local StatusBadge), launchpad-admin 3 (`src/app/mentors/[email]/`, a
   Next DYNAMIC SEGMENT), people 2, studentportal 2. ⛔ Every "0 errors" this
   estate recorded before that date excluded them. Found by renaming
   `[email]` in a scratch copy and getting 11 tables instead of 10.

   ⚖️ WHAT THE EXEMPTION TURNED OUT TO BE FOR: one file. Of the 62, exactly
   ONE emits inline-styled email markup — marketing's
   `src/lib/events/event-email-props.ts`, 13 HTML tags and 12 style
   attributes, the file carrying the note above. Two more are ordinary app
   JSX that happened to be named after the thing they list; the other 59 are
   route handlers, validation helpers, aggregates and their tests. No repo
   ships React Email, mjml or a templates directory — the estate has no email
   naming convention at all, which is why a substring was reached for.

   So the exemption names a convention instead: a directory literally called
   `emails/` or `email-templates/`, or a `*.email.*` suffix. ⛔ NEVER under
   `app/`. In Next's router every segment is a URL, not a claim about
   content — `src/app/api/events/[id]/emails/route.ts` is named after the
   RESOURCE it serves, and three repos have one. `[email]` proves a segment
   name can be an accident outright.

   ⚖️ A segment named `app` anywhere excludes, rather than only `src/app`,
   because the script is also run as `npx cgsi-adherence app`. Any ambiguity
   in an exemption resolves toward CHECKING the file: that is the only
   direction that cannot hide debt, and hiding debt is the whole of what went
   wrong here.

   A genuine template outside this convention takes a pragma naming email as
   the reason — a recorded decision, not a substring. */
const EMAIL_SURFACE = (path) => {
  const segments = path.split(/[\\/]/);
  const file = segments.pop() ?? "";
  if (segments.includes("app")) return false;
  return (
    segments.includes("emails") ||
    segments.includes("email-templates") ||
    /\.email\.(tsx?|jsx?|mjs|cjs|css|scss)$/.test(file)
  );
};

/* brand.css is the one file allowed to hold raw colour: it is where the tokens
   are defined. Tests assert on literals, so they are exempt too. */
const EXEMPT = (path) =>
  basename(path) === "brand.css" ||
  /\.(test|spec)\.[tj]sx?$/.test(path) ||
  EMAIL_SURFACE(path);

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
    id: "raw-palette",
    /* 🟢 FLIPPED TO ERROR THE SAME DAY IT ARRIVED, because the estate reached
       zero the same day. It came in advisory on 123 findings across eight
       repos — a rule that fails everything on day one is a rule somebody
       switches off within the week — and the sweep closed all 123 in one
       pass. Every one was an error line, a callout or a filled pill, so
       there was no argument to have about whether the rule described the
       estate wrongly. That argument is what held the spacing ladder up, and
       it was the right argument to have there and a non-argument here.

       ⚠️ THE FIRST COUNT WAS WRONG AND SAID 112 ACROSS SEVEN. It came from a
       hand-written list of repo names and cgsi-auth was not on it. The right
       number came from the filesystem — every directory carrying
       .github/workflows/adherence.yml. ⛔ Never take an estate count from a
       list somebody typed. The alpha-hex undercount was the same mistake
       wearing a different hat.

       🔴 THE HOLE raw-hex LEFT OPEN. `#16a34a` is caught; `bg-green-600` is
       the same colour, the same offence and the same screen, and it passed.
       Found 23 Oct in two StatusBadge components in marketing that had been
       sitting at "0 errors" through four sweeps while written entirely in
       Tailwind's stock palette. ⛔ So "0 errors estate-wide" was never a
       statement about colour; it was a statement about SPELLINGS OF COLOUR.

       What was actually there, in all 112: an error line in red, a warning
       callout, or a filled status pill. None of them a third-party embed, a
       syntax-highlighting theme or anything else with a claim to its own
       palette — the usual reasons to exempt. So unlike the spacing ladder,
       this is not a rule the estate is breaking because the rule is wrong.

       🔴 THE PILLS ARE THE WORST OF THEM, and not because of the hue. A
       filled pill carries its meaning in colour ALONE, which is the thing
       hard rule 5 exists to stop; Status draws a glyph and a word. One of
       these boards belongs to someone who is colour blind.

       ⛔ BRAND TOKEN CLASSES MUST NOT MATCH. `bg-surface-2`, `text-text-3`,
       `border-border-strong` are the package's own and correct. The palette
       names are listed explicitly rather than matched as `\w+` for exactly
       this reason — a generic pattern reports Ledger.tsx against itself.

       The variant prefix needs no handling: `dark:` and `hover:` end in a
       colon, which is a word boundary, so `dark:bg-amber-950` matches on the
       `bg`. The opacity suffix likewise — `/40` starts with a non-word
       character, so `bg-green-900/40` closes its `\b` on the `0`. Both
       spellings are in the estate and both were checked. */
    tier: "error",
    re: /\b(?:bg|text|border|ring|from|to|via|decoration|outline|divide|shadow|fill|stroke|caret|accent|placeholder)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]{2,3}\b/g,
    msg: `Raw Tailwind palette colour. The stock palette is not the brand: use a token (${TOKENS}) via the app layer's classes, or the part that already carries the hue — Status for a state (glyph plus word, never a filled pill) and Notice for a callout (a hairline in the status hue).`,
  },
  {
    id: "raw-rgb",
    /* 🔴 THE THIRD SPELLING. raw-hex catches `#dc2626`, raw-palette catches
       `bg-red-600`, and neither sees `rgba(251,191,36,.4)` — referrals drew its
       chip borders that way through every sweep. ⛔ A third time: a colour count
       is a count of SPELLINGS until the rule names all of them.

       🟢 FLIPPED TO ERROR 23 OCT 2026, THE SAME DAY IT ARRIVED — 33 lines
       across 11 of 17 repos, all cleared the same day, advisory→error the same
       afternoon. The raw-palette playbook, third time it has run and third time
       the estate closed in one pass. The estate-wide count was taken from the
       FILESYSTEM, not a typed list: every directory carrying
       .github/workflows/adherence.yml, 17 of them, re-run at the error tier
       before this line changed. ⛔ Never take an estate count from a list
       somebody typed — that is what undercounted raw-palette at 112 across
       seven and left cgsi-auth's eleven findings out of a sweep that reported
       itself complete.

       ⚖️ IT ARRIVED ADVISORY, and for a reason raw-palette did not have. 12 of
       the 38 literals sat under pragmas naming `raw-hex`, a DIFFERENT rule, so
       erroring on day one would have broken studentportal, home and people over
       exemptions that were already argued and recorded. ⛔ Letting a `raw-hex`
       pragma also suppress `raw-rgb` was considered and REJECTED: cheap now, and
       un-auditable the moment anyone asks which rule a pragma actually answers.
       Those lines took their own pragma in the sweep, which is the whole of what
       the advisory day bought and why the day was worth having.

       🟢 THE FIRST TWO FINDINGS WERE IN THIS PACKAGE and are both cleared (#13).
       Ledger's hover wash was a live defect in all 17 apps — the dark theme's
       ink at 4%, frozen as a literal, drawing NOTHING on light. The drawer scrim
       is why --color-scrim now exists: a scrim is black at an alpha by nature
       and no token carried that meaning, so the honest answer for seventeen
       inheriting apps was a token, not a pragma.

       🔴 ZERO ALPHA IS NOT A COLOUR. `rgba(0,0,0,0)` is `transparent` with the
       hue carried for readability; it is how a mask or gradient writes its
       invisible stop. The lookahead covers the comma AND the slash form.

       🔴 A COMPUTED COLOUR IS NOT A RAW ONE. `rgba(${r},${g},${b},${a})` is a
       chart ramp, not a value someone typed — marketing's heatColor builds a
       per-cell Okabe-Ito diverging scale that no token expresses. The argument
       char class is digits/%/,/ / only, so a template literal cannot match.

       ⛔ NOT INSIDE color-mix(). That is the fix this rule asks for, and a rule
       that fires on its own remedy is a rule people route around. 🔴 The
       lookbehind has to tolerate ONE level of nesting: written `[^()]{0,120}`
       it stops at the first parenthesis, so `color-mix(in srgb, var(--token)
       40%, rgba(0,0,0,.5))` — a tinted token, which is the shape the remedy
       actually takes — was flagged while the bare form was not. The estate has
       no rgb() inside a color-mix() today, so this cost nothing to miss and
       will cost exactly one confused sweep to leave. */
    tier: "error",
    re: /(?<!color-mix\((?:[^()]|\([^()]*\)){0,60})\b(?:rgb|hsl)a?\s*\(\s*(?![\d.]+%?\s*[,\s]\s*[\d.]+%?\s*[,\s]\s*[\d.]+%?\s*[,\/]\s*0*\.?0*\s*\))[\d.%\s,\/]*\)/g,
    msg: `Raw rgb()/hsl() colour. A translucent brand colour is color-mix(in srgb, var(--token) NN%, transparent) — rgba(251,191,36,.4) is var(--color-warn-border) and the estate already ships -border and -tint tokens for the common alphas. Use a token: ${TOKENS}. A fully transparent stop (alpha 0) and a computed ramp are not flagged. If the value is genuinely outside the palette — a colourblind-safe chart scale, a public-website render — the line needs \`cgsi-adherence-allow: raw-rgb — <why>\`.`,
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
    id: "token-alpha",
    tier: "error",
    /* 🔴 THE FOURTH SPELLING OF A TINT. `#16a34a1a` is raw-hex, `bg-green-600/10`
       is raw-palette, `rgba(22,163,74,.1)` is raw-rgb — and `bg-accent/10`,
       which Tailwind v4 compiles to `color-mix(in oklab, var(--color-accent)
       10%, transparent)`, passed all three. It is a hand-mixed tint of a brand
       token: the retired shape (hard rule 5), spelled so that no rule saw it.
       And because the base is `--color-accent`, in light mode it is Ink Green
       at 10% — a grey-green wash that is neither the mark nor the tint.

       The estate has tokens for every tint it is allowed: `--color-accent-tint`
       (the selected row or chip), `--color-accent-border`, and the
       `--color-*-border` family at the alphas the brand chose. A tint with no
       token is a tint the brand does not have. Found 25 Oct 2026: 2 lines in
       cgsi-auth and 2 in the package's own menus (`hover:bg-accent/10`, which
       is a hover ground and wants `--color-surface-2`, as Ledger's did).

       ⛔ Only the accent and status hues. `bg-surface/85` under a backdrop
       blur is a glass header, a surface step with alpha, and not this.

       🔴 THE ARBITRARY-VALUE FORM IS THE SAME TINT AND IS FOUR TIMES AS
       COMMON. `hover:bg-[var(--color-accent)]/20` compiles to the same
       color-mix as `bg-accent/20`, and the first version of this rule did
       not read it: the survey behind it grepped `-accent/` and found 4,
       while the estate carries 43 of the bracket form across 4 repos
       (people 30, salesapp 6, scheduling 6, finance 1), nearly all a chip
       or row hover ground. ⛔ A count of one spelling is not a count. */
    re: /\b(?:bg|text|border|ring|from|to|via|decoration|outline|divide|shadow|fill|stroke|caret|placeholder)-(?:accent|accent-mark|good|warn|bad|info|attention|success|warning|error)\/\d{1,3}\b|\[var\(--color-(?:accent|accent-mark|good|warn|bad|info|attention|success|warning|error)\)\]\/\d{1,3}\b/g,
    msg: "A brand token at an alpha. bg-accent/10 is a hand-mixed tint — the retired tinted-fill shape in its fourth spelling — and on light it mixes from Ink Green, not the mark. A hover or selected ground is --color-surface-2 / --color-accent-tint; an accent or status outline is --color-accent-border / --color-<hue>-border. If no token carries the meaning, color-mix(in srgb, var(--token) NN%, transparent) in CSS with a comment saying why.",
  },
  {
    id: "concatenated-token",
    tier: "error",
    /* 🔴 A TOKEN THE CHECKER CANNOT READ IS A TOKEN NOBODY CHECKED.
       scheduling's `bucketColor()` returned `var(--color-${bucket})` with
       bucket ∈ animation | gamedesign | digitalart — three tokens
       `deprecated-discipline` has frozen since September — and reported 0
       errors throughout, because the literal the rule matches on was
       assembled at runtime. The flip then set those tokens to neutral grey
       and the dots inverted on screen with no finding anywhere.

       Every rule in this file matches a literal. A template literal or a `+`
       that builds a token name or a utility class defeats all of them at
       once, and in Tailwind v4 the class form is worse than unchecked: the
       compiler scans source for COMPLETE class names, so `bg-${tone}` is
       never generated and resolves to nothing. The fix is a static map
       (`{ good: "var(--color-good)", ... }`) so each token is a literal the
       checker, the compiler and the reader can all see — or, for
       disciplines, no colour at all: they are named, not coloured. */
    re: /--color-[\w-]*\$\{|["'`]--color-["'`]\s*\+|\b(?:bg|text|border|ring|fill|stroke|divide|outline|from|to|via)-(?:[\w-]*-)?\$\{/g,
    msg: "A colour token or utility built from a string. var(--color-${x}) and bg-${x} are invisible to every rule here (the literal does not exist until runtime), and Tailwind v4 never generates a class it cannot read, so the utility form resolves to nothing. Spell each token out in a static map; if the variable is a discipline, there is no colour — disciplines are named.",
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
    /* 🔴 THE TAILWIND SPELLING RESOLVES TO NOTHING. `bg-accent-soft` is the
       utility Tailwind v4 would generate from `--color-accent-soft` — and that
       token is gone from brand.css (the phase 4 flip retired it; a test pins
       its absence), so the class is emitted into the markup and matched by no
       rule. cgsi-auth's grant chips and estate badges wore it through every
       sweep at "0 errors": a border with no fill, and nothing anywhere said
       so. The other `-soft` tokens are still declared (as the neutral grey the
       flip set them to) so THEIR utilities resolve — to a grey wash — and are
       the same retired shape. Found 25 Oct 2026: 3 lines in 2 repos. */
    re: /--color-(?:accent|good|warn|bad|success|warning|error|attention)-soft\b|--color-surface-(?:success|warning|error)-soft\b|\b(?:bg|text|border|ring|from|to|via|decoration|outline|divide|shadow|fill|stroke|caret|placeholder)-(?:accent|good|warn|bad|success|warning|error|attention|surface-success|surface-warning|surface-error)-soft\b/g,
    msg: "DEPRECATED (2027): tinted fills are retired. A status is a glyph plus a word; a notice is a hairline in the status hue. The only surviving accent fill is var(--color-accent-tint) / bg-accent-tint, for a selected row or chip. ⛔ As a Tailwind class, bg-accent-soft resolves to NOTHING — the token no longer exists — so the element has silently had no fill since the phase 4 flip.",
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
    /* 🔴 THE ARBITRARY SPELLING, AGAIN. `rounded-[6px]` is a radius the
       named-size arm never saw, found by the people sweep of 25 Oct 2026
       two hours after `token-alpha` was corrected for the identical miss:
       20 lines across people (14), scheduling (5) and marketing (1), in a
       freeze rule that had read 0 estate-wide since the phase 4 flip. A
       zero value (`rounded-[0px]`) is square and passes. */
    re: /border-radius\s*:(?!\s*(?:0\b|0px|0%))[^;}\n]+|\brounded-(?:sm|md|lg|xl|2xl|3xl|full)\b|\brounded(?:-[trblse]{1,2})?-\[(?!0(?:px|%|rem|em)?\])[^\]]+\]|(?:class|className)\s*=[^>]*?\brounded\b(?!-)/g,
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
    tier: "error",
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

       ⚠️ Arrived advisory for the usual reason (hundreds of accent uses, 17
       repos red) and went to error in 8d75016, 23 Oct 2026, once the sweep
       was done. ⛔ It reads CSS DECLARATIONS only. The Tailwind spelling of
       the same thing — `border-accent` on the package's own SubNav underline,
       the exact defect this rule was written on — is `accent-as-paint-class`
       below, and started advisory for the same reason this did. */
    re: /(?<!\boutline\b[^{}]*)(?:background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|fill|stroke)\s*:[^;}]*var\(\s*--color-accent\s*\)/g,
    msg: "Accent used as paint. In light mode --color-accent is Ink Green #1e7d10 (a TEXT value) while --color-accent-mark stays #44d62c, so a bar, rule, tick or dot written with --color-accent goes dull in light and nobody sees it on dark. Use --color-accent-mark. If type sits ON this paint, --color-accent is correct and the line needs `cgsi-adherence-allow: accent-as-paint — <why>`.",
  },
  {
    id: "accent-as-paint-class",
    tier: "error",
    /* ── The Tailwind spelling of accent-as-paint ──────────────────────────
       `border-accent` compiles to `border-color: var(--color-accent)`, which
       is exactly what the rule above flags in CSS, and the rule above never
       saw it. The package's own SubNav drew its active-tab underline with it
       — the defect `accent-as-paint` was written on, in home, re-spelled —
       and so did the apps. 🔴 The first survey said 30 sites across 8 repos
       and was off by five times: it grepped `-accent\b` and never saw the
       arbitrary-value spelling, `border-[var(--color-accent)]`, which the
       estate uses four to one. Counted by the rule itself, 25 Oct 2026:
       155 LINES across 14 of 17 repos (221 literals; marketing 45, people
       36, salesapp 29), plus 5 in the package.

       ⚖️ BOUNDARY OR DECORATION. Reading those 42 gave the test that decides
       each one, and it is not "is it paint":

       · A DECORATION — an underline, a bar, a dot, a tick, a progress fill —
         stands beside type and is the bright mark: `border-accent-mark`,
         `bg-accent-mark`. On white, Ink Green makes a dull edge (home, 23 Oct).
       · A BOUNDARY — the 1px border of a chip, a button, a field — must clear
         3:1 as a UI component edge (WCAG 1.4.11), and the bright mark on
         white is 1.9:1. There Ink Green is the VISIBLE one and `border-accent`
         is correct; the line takes the pragma, naming it a boundary.
       · A FILL WITH A LABEL ON IT — the one primary button a view may have —
         wants Ink Green for the same reason the CSS rule gives: type sits on
         the paint. It keeps `bg-accent` and takes the pragma. ⚠️ And its
         label is not `text-white`: on dark the accent is the bright mark and
         white on it is ~1.9:1. The label is `text-bg`, which is dark on the
         mark and white on Ink Green.

       ⛔ `focus:` / `focus-visible:` / `focus-within:` variants are excluded
       outright, as `outline` is above: a focus indicator is an accessibility
       requirement, not a brand mark, and Ink Green is the one you can see.
       `text-accent` is ink and never matches. The alpha form (`bg-accent/10`)
       is `token-alpha`, an error, and is not reported twice.

       ⚠️ ADVISORY, for the reason every colour rule here started that way:
       155 lines, a great many of them the package Header's button register
       copied by hand — which is why the pragma cannot settle until the
       standard's button is a package part (gap 20). Move to "error" when
       the count is near zero.

       🟢 ERROR since 25 Oct 2026, the same day, once `Button` shipped in
       v3.5.0 and eleven apps adopted it: the count fell from 155 lines to
       19 unexcused, all in marketing — six tab underlines and three
       spinners (decoration → -mark), five filter-chip hover edges and two
       emphasis panels (boundary → pragma), two destructive confirms and one
       selected toggle (pragma, awaiting a danger variant). Cleared in the
       same wave as the ref bump, so the flip changed no count. */
    re: /(?<!focus(?:-visible|-within)?:)(?<![\w-])(?:bg|border(?:-[trblxyse])?|ring|divide|fill|stroke|from|to|via|decoration|shadow)-(?:accent(?![\w-])(?!\/)|\[var\(--color-accent\)\](?!\/))/g,
    msg: "Accent used as paint, Tailwind spelling. border-accent / bg-accent is var(--color-accent) — Ink Green on light. A DECORATION (underline, bar, dot, tick, progress fill) is the mark: border-accent-mark / bg-accent-mark. A BOUNDARY (the 1px edge of a chip, button or field) must clear 3:1 and Ink Green is the visible one — keep border-accent and add `cgsi-adherence-allow: accent-as-paint-class — boundary, <what>`. A FILL WITH A LABEL is the primary button: import Button from @cgsi/app-shell with variant=\"primary\" (the mark as the fill, the ink as the label, 9.2:1 in both themes). ⚠️ bg-accent with text-bg is 4.28:1 on light, under AA at 11px, and is a stopgap, not a fix. Focus variants are never flagged.",
  },
  {
    id: "label-on-accent",
    tier: "error",
    /* 🔴 WHITE ON THE ACCENT IS 1.9:1 IN DARK, WHICH IS THE DEFAULT THEME.
       `bg-accent text-white` reads as the obvious primary button and is
       unreadable where most people run these apps: on dark the accent is
       the bright mark #44d62c, and white on it fails AA by a factor of two.
       It passes on light only because Ink Green happens to be dark. The
       label is `text-bg` — near-black on the mark, white on Ink Green —
       and it is right in both themes for the same reason the token is.

       Found by the first three sweeps of accent-as-paint-class, where every
       labelled fill was wrong and one was worse: mediacms's Search button
       set NO text colour and inherited --color-text, failing in both
       themes with nothing in the class string to read. That case is
       undecidable on a line, so it is not here; this one is. 57 lines
       across 10 repos on 25 Oct 2026, marketing 22 and people 16.

       ⚠️ ADVISORY on arrival: a one-token swap in ten repos, which is a
       wave, not a line. `raw-palette` does not see `white` (it is not a
       palette hue) and should not: `text-white` on a photograph is fine.

       🟢 ERROR since 25 Oct 2026: 57 lines → 3 after the Button adoption
       wave, all in marketing, all awaiting a danger variant (two delete
       confirms and one selected toggle). They carry the pragma and `text-bg`
       until the part has the variant. */
    re: /(?:bg-accent(?![\w-])|bg-\[var\(--color-accent\)\])[^"'`\n]*\btext-white\b|\btext-white\b[^"'`\n]*(?:bg-accent(?![\w-])|bg-\[var\(--color-accent\)\])/g,
    msg: "A white label on the accent fill. On dark — the default theme — the accent is the bright mark and white on it is ~1.9:1, unreadable; it only passes on light because Ink Green is dark. The fix is the part: import Button from @cgsi/app-shell with variant=\"primary\" (bg-accent-mark text-accent-ink, 9.2:1 in both themes). ⚠️ text-bg on bg-accent is 4.28:1 on light, under AA for 11px type: better than white, not a fix.",
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
    re: /\b(?:function|const)\s+(?:Ledger|Panel|Kpi|KPI|Status|StatusBadge|Badge|Notice|FilterBar|SegmentedControl|Segmented|RecordCard|Breadcrumb|Button|PrimaryButton|SecondaryButton)\b/g,
    msg: "Rebuilt part. Hard rule 2: import it from @cgsi/app-shell rather than redefining it locally. A local Badge is usually also a shape the brand does not have — status is a glyph plus a word, never a pill and never a filled badge.",
  },
  {
    id: "rebuilt-button",
    tier: "error",
    packageExempt: true,
    /* ── The Header's button, copied by hand ───────────────────────────────
       Until 25 Oct 2026 the standard's button existed only as the Header's
       admin link, and its class string — `border border-border text-text-2
       hover:border-accent hover:text-accent` — was copied into ten apps,
       sixty-odd times, each copy carrying its own boundary pragma for the
       hover edge. The pragma excuses `accent-as-paint-class`; it does not
       make a copy a part, and a copy misses every change made to the part.
       `Button` is now exported from the package, and the copied register is
       reported as what it is.
       ⚖️ Matched by the PAIR on one line: a hover edge to the accent AND a
       hover label to the accent, in either order and either spelling. A
       card or a calendar cell that hovers only its edge is a boundary, not
       this button, and is not reported here. A pragma for another rule does
       not silence this one — that is the point: the adoption count has to
       stay visible under the exceptions. Advisory on arrival; it moves to
       "error" when the estate has adopted the part.

       🟢 ERROR since 25 Oct 2026, after eleven apps adopted `Button` the
       same day. The hover LABEL now reads the arbitrary spelling too
       (`hover:text-[var(--color-accent)]`): the first regex read it only for
       the edge, and one copy in referrals (ChangeVanityForm) sat invisible.
       What remains and is excused by name: a filter chip's unselected state
       (auth People, the chip register, not a button), an icon-only dashed
       "+" (auth People) and an icon-only vanity edit (referrals) — the part
       has no icon-only register yet, a v3.6 gap. ⚠️ A `rebuilt-button`
       pragma on a site the part CAN serve is a lie the checker cannot see;
       name the gap in the reason. */
    re: /\bhover:border-(?:accent(?![\w-])|\[var\(--color-accent\)\])[^"'`\n]*\bhover:text-(?:accent(?![\w-])|\[var\(--color-accent\)\])|\bhover:text-(?:accent(?![\w-])|\[var\(--color-accent\)\])[^"'`\n]*\bhover:border-(?:accent(?![\w-])|\[var\(--color-accent\)\])/g,
    msg: "The standard's button, copied by hand. Hard rule 2: import Button from @cgsi/app-shell (variant=\"secondary\" is this register; variant=\"primary\" is the one filled button a view may have). A copy misses every change made to the part and carries a pragma the part does not need.",
  },
  {
    id: "off-scale-spacing",
    tier: "error",
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

       🔴 1px IS NOT A STEP AND IS NOT FLAGGED. It is the hairline, and this
       standard is built on hairlines: "Panels sit in a hairline grid with no
       gap (1px border between them)" is the spacing section's own second
       bullet. `gap: 1px` over a border-coloured grid is how the estate draws
       the dividers between the three question panels; `margin-bottom: -1px`
       is how a tab strip sits on its rule; `margin: -1px` is the clip in
       every visually-hidden utility. Rounding those is not tidying, it is
       deleting a divider — which a sweep of home did on 23 Oct 2026 before
       this line existed, removing the panel dividers and un-seating the tab
       strip in one pass. A hairline is a border that happens to be spelled as
       spacing, so it is out of scope, not a tenth step.

       🔴 THE PROPERTY NEEDS A LEFT BOUNDARY. Without `(?<![\w-])` the pattern
       matches the `margin-top` inside `scroll-margin-top`, which is not
       spacing at all: home's is 104px, derived from 58px of sticky Header
       plus ~41px of SubNav plus a buffer, and its own comment says to
       re-derive it when either component's geometry changes. Rounding that to
       40 drops every deep-linked card back under the fixed chrome. Same for
       `scroll-padding-*`. An offset measured from another component is not a
       step on this ladder.

       🔴 THE RUN-UP STOPS AT A COMMA, and this one is dangerous rather than
       merely noisy. A JSX style object separates its properties with commas,
       so `[^;}\n]*?` sails past one and lands on the next property:
       `gap: "8px", maxWidth: "480px"` reported 480px as off-scale SPACING in
       governance, and a sweep acting on that sets maxWidth to 40px and
       collapses the layout. Three of those were queued before the comma was
       excluded. The cost is real but small — a value after a comma inside
       `max(44px, calc(...))` is no longer seen — and under-reporting a
       computed gutter beats telling someone to break a width.

       ⚠️ A NEGATIVE value is a bleed and must cancel the padding it pairs
       with. Sweep the pair together or the cancellation breaks silently.

       ⚠️ Still advisory. 736 values remain, 663 of which move 2px or less and
       are a mechanical sweep; the other 73 are design decisions and want eyes.
       Move to "error" once the estate is near zero, as geometry did at the
       phase 4 flip. @see cgsi-2027-design guidelines/surface-app-layer.md,
       which is the source and was amended FIRST. */
    re: /(?<![\w-])(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|block|inline))?\s*:\s*[^;}\n,]*?\b(?!(?:0|1|2|4|6|8|12|16|24|32|40)px)\d+px/g,
    msg: "Off-scale spacing. The app layer has nine steps: 2, 4, 6, 8, 12, 16, 24, 32, 40. 1px is the hairline, not a step, and is never flagged. 10 and 14 are the two commonest drifts and both are deliberately NOT steps — 10 goes to 8 or 12, 14 to 12 or 16, and that choice is the rhythm. Row heights (40 / 32) come from the density setting, not a literal.",
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
  console.log("Run with --advisory for the rebuilt parts.");
}

process.exit(errors.length > 0 ? 1 : 0);
