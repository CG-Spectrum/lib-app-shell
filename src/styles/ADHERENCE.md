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

## Two tiers, two jobs

The check reports against two different things, and conflating them was a
mistake worth not repeating.

**The freeze** (default, exit 1). Colour, token and type rules. These describe
what must not get WORSE while the estate migrates: no new raw hex, no new usage
of a retired token, no new font. Enforced from phase 1.

**The destination** (`--geometry`, reported only). Square corners, no shadows,
no gradients. These describe the 2027 brand the estate is moving TO. The chrome
is correctly rounded today, so failing a repo for it would be failing it for
being what it is supposed to be. These become errors at the phase 4 flip —
change their `tier` from `"geometry"` to `"error"` then.

⚠️ **The first version of this check only covered the freeze**, which made the
estate look 4x closer to done than it is. A token swap alone produces a file
that passes and still renders rounded pills, gradients and colour-coded award
bars — visually 2025, mechanically compliant. Geometry is checked separately
because it survives a colour migration untouched.

## Rules

| ID | Tier | What it catches |
|---|---|---|
| `raw-hex` | freeze | Any `#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa` outside `brand.css` |
| `glued-alpha` | freeze | Hex alpha digits welded to a `var()`: `var(--color-bad)55` |
| `deprecated-discipline` | freeze | `--color-animation` / `gamedesign` / `digitalart` / `disc-*` |
| `deprecated-category` | freeze | `--color-cat-*` |
| `deprecated-soft` | freeze | Every `-soft` tint except `--color-accent-tint` |
| `non-brand-font` | freeze | A `font-family` outside the three brand faces |
| `quicksand` | freeze | Quicksand anywhere but the `brand.css` fallback |
| `rounded-corners` | geometry | Any non-zero radius, including `rounded-full` |
| `drop-shadow` | geometry | Any outer `box-shadow` (inset is allowed — it draws the selected row) |
| `gradient-fill` | geometry | Any gradient (the photographic text scrim is the brand's one exception) |
| `off-scale-spacing` | advisory | Padding, margin or gap off the six-step scale |

`brand.css` is exempt: it is where the tokens are defined. Test and spec files
are exempt: they assert on literals. Advisory and geometry tiers are off unless
you pass `--advisory` / `--geometry`.

⚠️ **`raw-hex` could not see an alpha hex until 21 Oct.** `#dc262655` slipped
both arms of the old pattern — the 6-digit one matched `#dc2626` and then
failed its word boundary on the `5`. Any count taken before that date
undercounts by however many tints the repo carries, and the phase 3 sweep that
closed 137 findings reported itself complete over four of them in `home`.
Re-measure rather than trusting a recorded number.

`glued-alpha` exists because of what that sweep then did to them: the codemod
replaced the 6-digit head and left `var(--color-bad)55`. That is not a colour,
the browser drops the declaration, and the border or tint disappears with no
error anywhere. Tint a token with `color-mix(in srgb, var(--token) NN%,
transparent)` — never by appending digits.

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

Baseline, 21 Oct 2026, measured on current `main`. Freeze first, then the
2027 geometry debt:

```
                 freeze  geometry   total          freeze  geometry   total
marketing            93       430     523   finance    31        65      96
scheduling           52       208     260   launchpad   9        72      81
people               70       196     266   leadership  9        55      64
salesapp             52       203     255   referrals  16        45      61
courseapp           100       125     225   partnersh  18        40      58
studentportal       160        53     213   cgsi-auth   1        50      51
home                 81       114     195   mediacms    4        36      40
                                            app-shell   0        29      29
                                            auditapp    9        18      27
                                            gca-dash    3        10      13
                                            governance  9         0       9
```

**Freeze 717 · geometry 1,749 · total 2,466.**

Three earlier passes reported 787, 693 and 716. Every one was wrong, and the
reasons are worth keeping because each is easy to repeat:

1. **787 counted false positives.** Comment bodies were matched, so the check
   flagged the note in `SubNav.tsx` explaining why `#EA27C2` is *not* used,
   above code that correctly uses tokens. And the font rule matched every
   declaration including the legal ones, because in
   `font-family\s*:\s*(?!...)` the trailing `\s*` backtracks to zero width and
   the lookahead tests the space after the colon rather than the value.
2. **693 counted stale code.** Measured against local `main` in each repo
   without fetching. Those refs were behind by up to 75 commits (marketing), 34
   (home) and 24 (mediacms). **Fetch before you measure.** The same stale refs
   produced a phantom finding that the estate spanned four releases of this
   package; 15 of 17 apps were already on v1.31.0.
3. **716 counted only half the brand.** The check had no geometry rules, so
   1,749 violations of square corners, no shadows and no gradients were
   invisible. The estate looked 4x closer to done than it is. courseapp's
   stylesheet is the clearest case: a pure token swap leaves it passing the
   check while still rendering rounded pills, gradients and sixteen
   colour-coded award bars.

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

`ADHERENCE_REF` is a **commit SHA, not a tag**. A SHA is immutable where a tag
can be force-moved, and the thing being pinned is what every app in the estate
is graded against. It also decouples the brand rules from the package release
cycle: changing a rule should not require cutting a package version, and a CI
check should not be blocked on a release decision. The first pass used
`v1.32.0` and every run failed on a 404 until it was repinned.

Current ruleset: `97edff8` (2027 phase 1). Bump deliberately, and expect every
app's count to move when you do. If the ref ever stops resolving, the fetch
step fails loudly rather than passing silently.

## Changing a rule

⚖️ **The skill is the source of truth, not this package.** `cgsi-2027-design`
defines the brand; `@cgsi/app-shell` implements it. A readability fix made only
here diverges from the skill silently, and the next person reading the standard
builds against the old rule.

So when a rule has to change:

1. Amend `cgsi-2027-design` (`guidelines/surface-app-layer.md` for the app
   layer) and say what changed and why.
2. Then change the package to match, citing the amendment.
3. Then let the per-app counts move.

Doing it in that order means the standard and the code never disagree about
what the brand is, which is the failure the 2027 rebrand exists to fix.

### Open, deferred to the visual audit

**Brand holds for the first pass** (Jeremy, 21 Oct 2026). The migration lands
the brand as written; readability is reviewed per dashboard afterwards, and
anything that must change then goes back into the skill first.

| Question | Where | Status |
|---|---|---|
| Event-type hue in the calendar: the standard both asks for it and retires `cat-*` | `Calendar.tsx` | Neutral rule, type named in text. Revisit at audit. |
| Mono is IBM Plex Mono in the standard, but the face is not loaded | `base.css`, `fonts.ts` | System mono stack, pragma'd. Loads with the phase 4 flip. |
| Focus ring is a tinted glow, 2027 wants a 2px accent outline | `base.css` | Pragma'd, changes at the flip. |
| Per-mentor `k` is unmeasured estate-wide | `RecordCard.tsx` | Renders at 1.0 and flags the frame. Needs measuring, not a code change. |

### What the audit cannot change

Three things are measurements, not preferences, and a readability complaint
about them is answered by re-measuring rather than by loosening the rule:

- **Two grey chart series.** 3 greys separate at ΔE 9.7 against a floor of 15.
  A third is unreadable for everyone, not a matter of taste.
- **Body at 13px minimum.** Stack Sans Text 400 stops being reliably legible
  below it on `#131919`.
- **The status hue set.** Chosen by protan/deutan/tritan simulation, every
  value clearing 4.5:1 on both grounds. Substituting a hue breaks that.
