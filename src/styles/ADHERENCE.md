# Brand adherence · CGSI 2027 app layer

What `npm run adherence` checks, why it is a script rather than a lint config,
and how to deal with a finding.

Standard: `cgsi-2027-design/guidelines/surface-app-layer.md` (v0.1, Oct 2026).
Tokens: `brand.css`. Run `npx cgsi-adherence src` in any consuming app.

## Why not oxlint

The brand skill ships `_adherence.oxlintrc.json`, and it does not run. Checked
against oxlint 1.87.0 in Oct 2026, it fails twice over:

1. oxlint rejects its top-level `x-omelette` key outright.
2. Every rule in it is `no-restricted-syntax`, which oxlint does not implement.

It is also the **website** config, not this one. Its tokens are `--cg-*`, its
spacing scale has eleven steps, and its components are `MentorCard`, `RoomTile`
and `WorkTile`. The app layer uses `--color-*`, six spacing steps, and the data
parts. Linting an app with it flags every legitimate token in the file.

The deciding reason is CSS. oxlint parses JS, TS and JSX only, and most of this
estate's raw hex is in stylesheets rather than components: courseapp's 54 values
and studentportal's 54 sit almost entirely in one `globals.css` each. A JS-only
linter cannot see the majority of the problem. `scripts/adherence.mjs` reads
both, has no dependencies, and is therefore one devDependency bump and one CI
step to adopt rather than a toolchain decision.

## Rules

| ID | Tier | What it catches |
|---|---|---|
| `raw-hex` | error | Any `#rgb` / `#rrggbb` outside `brand.css` |
| `deprecated-discipline` | error | `--color-animation` / `gamedesign` / `digitalart` / `disc-*` |
| `deprecated-category` | error | `--color-cat-*` |
| `deprecated-soft` | error | Every `-soft` tint except `--color-accent-tint` |
| `non-brand-font` | error | A `font-family` outside the three brand faces |
| `quicksand` | error | Quicksand anywhere but the `brand.css` fallback |
| `off-scale-spacing` | advisory | Padding, margin or gap off the six-step scale |

`brand.css` is exempt: it is where the tokens are defined. Test and spec files
are exempt: they assert on literals. The advisory tier is off unless you pass
`--advisory`.

## Fixing a finding

**Raw hex.** Use a token: `--color-bg`, `surface`, `surface-2`, `surface-3`,
`border`, `border-strong`, `text`, `text-2`, `text-3`, `accent`, `accent-mark`,
`accent-tint`, `good`, `warn`, `bad`, `info`, `attention`. If the colour you
need genuinely is not there, add it to `brand.css` in this package. Never to the
app.

**A deprecated token.** These are not a reskin. Discipline and category colour
were retired in Sept 2026 because colour is the third signal and never the
first: name the discipline in text. A status is a glyph plus a word, so a
tinted status fill has nothing to replace it with. The one surviving accent fill
is `--color-accent-tint`, for a selected row or chip.

**A font.** Three faces: Stack Sans Notch (display), Stack Sans Text (body,
weight 400, not 300 — thin strokes break up at 13px on a dark ground), IBM Plex
Mono (labels, 500, caps, tracked .14em, never reading copy). Reach them through
`var(--brand-display)` and `var(--brand-body)`.

## Suppressing a finding

```css
/* cgsi-adherence-allow: deprecated-soft — selected state; moves to
   --color-accent-tint with .filters in phase 2 */
```

The pragma covers its own line and everything down to the next `}` or blank
line, capped at twelve, so one comment above a CSS rule covers that rule's
declarations without leaking into the next selector. Several rule IDs can be
comma-separated, and `*` suppresses everything on the line.

**The reason after the dash is mandatory.** A pragma without one suppresses
nothing. That is deliberate: a suppression should be a decision somebody can
read in review, not a way to make the check quiet. Use it only where the
package still has to define something while apps migrate off it. Never in new
code.

This package currently carries eleven of them, all in `components.css`,
`base.css` and `fonts.ts`, each naming the phase that removes it.

## What the freeze is for

The retired tokens are referenced 328 times across the 17 apps. Deleting their
definitions now would resolve all 328 declarations to the guaranteed-invalid
value in production, which is the pre-1.28 login card bug at sixty times the
blast radius. So they stay defined, unchanged, and frozen.

This check is the freeze. It does not reduce the count; the phase 3 migrations
do that. It stops the count growing in the meantime.

Phase 1 baseline, 21 Oct 2026, errors per app:

```
studentportal 160   courseapp 100   marketing 85   home      73
people         66   scheduling  51   salesapp  49   finance   31
partnerships   18   referrals   16   leadership 9   governance 9
launchpad-admin 9   auditapp     9   mediacms   4   gca-dash   3
cgsi-auth       1   app-shell    0
```

Total 693. An earlier pass reported 787; the difference was 94 false positives
from two bugs in the checker, both fixed before this baseline was taken. Worth
knowing because both are easy to reintroduce:

1. **Comments were matched.** `SubNav.tsx` carries the note "#EA27C2 under
   white fails AA at this size" directly above code that correctly uses the
   tokens. Flagging prose that explains a rule teaches people to delete the
   explanation. Comment bodies are now blanked before matching, with newlines
   preserved so reported line numbers stay correct.
2. **The font rule matched everything, including the legal declarations.**
   Written `font-family\s*:\s*(?!...)`, the trailing `\s*` backtracks to zero
   width, so the lookahead tests the space after the colon rather than the
   value. The optional whitespace now lives inside the lookahead.

app-shell is at zero and stays there: this repo gates, because nothing deploys
from it. The apps report, because a push to main deploys production there before
any workflow finishes. When an app reaches zero, remove `continue-on-error` from
its workflow and it can no longer regress.

## Deployment

`.github/workflows/adherence.yml` is deployed byte-identical to all 17 app
repos from `scripts/adherence-workflow-template.yml`. It fetches the checker
from this repo at the tag in its `ADHERENCE_REF` and runs it with node, rather
than installing it, so the check does not depend on an app's own install
health: most apps route the private `@cg-spectrum` scope to GitHub Packages and
that per-repository grant is incomplete across the estate. It also means every
app is graded against one ruleset rather than whichever rules shipped with its
pinned app-shell, which matters while the estate spans four releases.

⚠️ The workflows are inert until `ADHERENCE_REF` resolves. They point at
`v1.32.0`, which is the phase 1 release and must be tagged in this repo before
any of them does anything. The fetch step fails loudly rather than silently
passing if the tag is missing.
