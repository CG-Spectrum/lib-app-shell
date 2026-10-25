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

**The destination** — now also errors, since the phase 4 flip (21 Oct 2026).
Square corners, no shadows, no gradients: the 2027 brand the estate was moving
TO. These reported separately for the whole migration, because the chrome was
correctly rounded at the time and failing a repo for that would have been
failing it for being what it was supposed to be. The flip ended that argument.
Every repo is at zero geometry, the estate now wears the brand it is measured
against, and the only thing a separate tier buys from here is somewhere for
new rounding to accumulate quietly. `--geometry` is still accepted and does
nothing, so existing CI keeps working.

⚠️ **The first version of this check only covered the freeze**, which made the
estate look 4x closer to done than it was. A token swap alone produces a file
that passes and still renders rounded pills, gradients and colour-coded award
bars — visually 2025, mechanically compliant. Geometry was checked separately
because it survives a colour migration untouched, and that separation is what
made it countable; it is one tier again now that the count is zero.

⚠️ **Three of these rules draw a distinction a regex wants to miss**, and each
was found by the rule telling someone to break something:

- a `mask-image` gradient is an **edge fade**, which the brand asks for by name;
- a `repeating-*-gradient` is a **hatch**, a non-hue channel carrying meaning,
  and the only way CSS draws one;
- `box-shadow: 0 0 0 3px` is a **focus ring** — no offset, no blur, casts
  nothing — and WCAG 2.4.7 requires it.

In all three the "compliant" rewrite was worse than the thing flagged. If a
geometry finding looks like it is asking you to delete something the standard
requires, check whether it is one of these before you change the code.

## Rules

| ID | Tier | What it catches |
|---|---|---|
| `raw-hex` | freeze | Any `#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa` outside `brand.css` |
| `glued-alpha` | freeze | Hex alpha digits welded to a `var()`: `var(--color-bad)55` |
| `deprecated-discipline` | freeze | `--color-animation` / `gamedesign` / `digitalart` / `disc-*` |
| `deprecated-category` | freeze | `--color-cat-*` |
| `deprecated-soft` | freeze | Every `-soft` tint except `--color-accent-tint` — as a token AND as a utility. `bg-accent-soft` resolves to nothing |
| `non-brand-font` | freeze | A `font-family` outside the three brand faces |
| `quicksand` | freeze | Quicksand anywhere but the `brand.css` fallback |
| `rounded-corners` | freeze | Any non-zero radius, including `rounded-full` |
| `drop-shadow` | freeze | Any outer `box-shadow`. Inset is allowed (it draws the selected row) and so is a zero-offset zero-blur ring, which is a focus indicator, not elevation |
| `gradient-fill` | freeze | A gradient FILL. Not a `mask-image` gradient (that is an edge fade), not a `repeating-*-gradient` (that is a hatch), and the photographic text scrim is pragma'd |
| `accent-as-paint` | freeze | `--color-accent` used as PAINT — a bar, tick, rule or dot. Marks take `--color-accent-mark`; every `color:` use of the accent is correct and untouched |
| `off-scale-spacing` | freeze | Padding, margin or gap off the nine-step scale (2, 4, 6, 8, 12, 16, 24, 32, 40) |
| `raw-palette` | freeze | A stock Tailwind palette class: `bg-green-100`, `dark:text-amber-400`, `bg-red-900/40`. The hole `raw-hex` left open |
| `raw-rgb` | freeze | A raw `rgba()` / `rgb()` / `hsl()` / `hsla()`. The third spelling. Not an alpha-0 stop, not a computed ramp, not inside `color-mix()` |
| `token-alpha` | freeze | A brand token at an alpha: `bg-accent/10`, `border-warn/40`, `bg-[var(--color-accent)]/20`. The fourth spelling of a tint. Not a surface step (`bg-surface/85` is a glass header) |
| `concatenated-token` | freeze | A token or utility built from a string: `var(--color-${x})`, `"--color-" + x`, `bg-${x}`. Invisible to every other rule; the utility form is never generated |
| `accent-as-paint-class` | advisory | The Tailwind spelling of `accent-as-paint`: `border-accent`, `bg-accent`, `bg-[var(--color-accent)]`. Not `text-accent`, not a `focus:` variant, not `-mark` / `-tint` / `-border` |
| `label-on-accent` | advisory | `text-white` on an accent fill. 1.9:1 on dark, the default theme. The label is `text-bg` |
| `rebuilt-table` | advisory | A raw `<table>` in an app. Import `Ledger`. An email template is exempt by the convention below |
| `rebuilt-part` | advisory | A locally defined `Panel` / `Kpi` / `Status` / `Badge` / `Notice` / `FilterBar` / `RecordCard` / `Breadcrumb` |

`brand.css` is exempt: it is where the tokens are defined. Test and spec files
are exempt: they assert on literals — ⛔ and so does `square-corners.mjs` skip
them, because a codemod that rewrites `rounded-lg` inside `adherence.test.ts`
is not migrating anything, it is deleting two regression tests and leaving
them green. The advisory tier is off unless you pass `--advisory`.

## 🔴 `raw-rgb` — the third spelling

`raw-hex` catches `#dc2626`. `raw-palette` catches `bg-red-600`. **Neither sees
`rgba(251,191,36,.4)`**, which is how `referrals` drew its chip borders through
every sweep. ⛔ A third time: **a colour count is a count of SPELLINGS until the
rule names all of them.**

Surveyed from the filesystem, 23 Oct 2026 — **33 findings across 11 of 17
repos**, plus 15 in a generated file the runner already diverts to `UPSTREAM`:

| `studentportal` 9 | `courseapp` 8 | `people` 5 (+15 upstream) | `marketing` 2 | `referrals` 2 | `salesapp` 2 | `auditapp` 1 | `finance` 1 | `gca-dashboard` 1 | `home` 1 | `partnerships` 1 |
|---|---|---|---|---|---|---|---|---|---|---|

⚠️ **The earlier survey said 38 and 19, and both numbers are also right.** It
counted LITERALS; the checker reports **one finding per line per rule**, as
every other rule here does. Five lines carry two `rgba()` each — three in
`courseapp`'s `globals.css` and the byte-identical `.pill.live` in
`gca-dashboard` and `partnerships` — and the generated file has 19 literals on
15 lines. 33 + 5 = 38, 15 lines = 19 literals. Nothing is missing; the two
numbers measure different things, and the per-line one is what CI will print.

Every live literal in the estate is `rgba()`. The only `rgb(` are three inside
comments, which the checker strips. The rule covers `rgb` / `hsl` / `hsla`
anyway — that is the lesson of the first two spellings.

**What is actually there**: 24 are a one-token swap with an exact equivalent
already in `brand.css` (`--color-warn-border`, `--color-bad-border`,
`--color-surface-2`); 3 are dead `var(--x, rgba(...))` fallbacks; 5 take a
pragma on a decision already recorded.

### Three things the rule deliberately does not flag

- **Alpha 0 is not a colour.** `rgba(0,0,0,0)` is `transparent` with the hue
  carried for readability — how a mask or a gradient writes its invisible stop.
  The comma and the slash form are both covered.
- **A computed colour is not a raw one.** `rgba(${r},${g},${b},${a})` is a chart
  ramp, not a value somebody typed; `marketing`'s `heatColor` builds a per-cell
  Okabe-Ito diverging scale no token expresses. The argument character class is
  digits, `%`, `,`, `/` and space, so a template literal cannot match.
- **Not inside `color-mix()`.** That is the fix this rule asks for, and a rule
  that fires on its own remedy is a rule people route around. 🔴 The exclusion
  has to tolerate one level of nesting: stopped at the first parenthesis it
  flagged `color-mix(in srgb, var(--token) 40%, rgba(...))` — the shape the
  remedy actually takes — while passing the bare form.

A **dead `var()` fallback does** flag. The value is unreachable and disagrees
with the token it backs, and `raw-hex` has no fallback carve-out either.

### 🟢 Advisory on day one, freeze the same afternoon — 23 Oct 2026

**The history, in one line: 33 lines across 11 repos, all cleared the same day,
advisory → freeze the same afternoon. Same as `raw-palette`.** Third time the
playbook has run and the third time the estate closed in one pass.

`raw-palette` flipped to freeze the same afternoon because every one of its 123
was plainly wrong. This one arrived advisory for a reason that rule did not
have: **12 of the findings sat under pragmas naming `raw-hex`** — a different
rule — so erroring on day one would have broken `studentportal`, `home` and
`people` over exemptions that were already argued and recorded. Those lines
took their own pragma in the sweep, which is the whole of what the advisory day
bought and why the day was worth having.

⛔ **Letting a `raw-hex` pragma also suppress `raw-rgb` was considered and
rejected.** It is cheap now and un-auditable the moment anyone asks which rule
a given pragma answers.

⚠️ **The gate for the flip was the 17-repo re-run at the error tier**, counted
from the filesystem — every directory carrying
`.github/workflows/adherence.yml` — and not from a list anybody typed. That is
the mistake that undercounted `raw-palette` at 112 across seven and left
`cgsi-auth`'s eleven findings out of a sweep which reported itself complete, in
the app that holds everyone's sign-in. The flip did not land until all 17 came
back at 0.

⚠️ **The ref is pinned per app, so this does not reach anybody yet.** Each
repo's `adherence.yml` names a SHA; a merged rule change is inert until that
pin moves. The bump wave follows this, one PR per repo.

⚠️ **One finding in the sweep is a live defect, not debt.** `studentportal`
draws its focus ring (`globals.css` ~:610) and its stepper-dot ring (~:1022) in
2025 **pink** `rgba(255,62,181,…)` around elements filled with the green token,
under a pragma naming `drop-shadow` and `raw-hex`. Visible today.

🟢 **The rule's first two findings were in this package**, and both are now
cleared — the package is 0 errors and 0 advisory. They are the rule arguing for
itself twice, in the two different ways a finding can be real:

- **`Ledger.tsx`'s hover wash was a live defect, in every app.** It was
  `rgba(233,230,223,0.04)` — `#e9e6df` is `--color-text`'s **dark** value, so
  the wash was the dark theme's ink at 4%, frozen as a literal. On light it
  painted near-white at 4% over the `#ffffff` panel and drew nothing: the
  estate's table had **no row hover for anyone working in light**. The same
  defect `people`'s `globals.css:54` had. → `hover:bg-surface-2`, the next step
  of the ramp, which is up in dark and down in light and visible in both.
- **`components.css`'s drawer scrim needed a token that did not exist.** A
  scrim over content is black at an alpha by nature, and nothing in the palette
  carried that meaning. The choice was a pragma on one line or a token for the
  estate, and ⚖️ **the token, because seventeen apps inherit this package and
  every one of them will eventually write a drawer, a sheet or a confirm
  dialog.** A pragma here leaves all seventeen meeting the same rule with
  nothing to reach for — seventeen pragmas, or seventeen literals. That is the
  argument `--color-scrim-hero` already won in `brand.css`. → `--color-scrim`.

⛔ **`--color-scrim` takes no light override and must not be given one.** A
scrim's job is to darken; derived from the near-white light ground it would
veil the page instead of dimming it. Theme-independent on purpose, like
`--panel-gap`, and pinned by a test — because the file's own "every colour also
appears in the light block" rule points the wrong way here.

## 🔴 The fourth colour pass — 25 Oct 2026

Three spellings were frozen and the estate read 0 errors. Counted from the
filesystem on 25 Oct, the lines none of them saw:

| What | Where | Rule |
|---|---|---|
| `bg-accent-soft` on a chip | `cgsi-auth` ×2, `mediacms` ×1 | `deprecated-soft` (extended) |
| `bg-accent/10`, `hover:bg-[var(--color-accent)]/20` | `cgsi-auth` ×2, this package ×2; the bracket form 43 across 4 repos | `token-alpha` (new) |
| `` var(--color-${bucket}) `` | `scheduling` ×1 | `concatenated-token` (new) |
| `border-accent`, `border-[var(--color-accent)]` | 155 lines across 14 repos, this package ×5 | `accent-as-paint-class` (new, advisory) |
| `bg-accent text-white` | 57 lines across 10 repos | `label-on-accent` (new, advisory) |

**`bg-accent-soft` resolves to nothing.** `--color-accent-soft` left
`brand.css` at the phase 4 flip and a test pins its absence, so Tailwind v4 has
no token to build the utility from: the class is in the markup, matches no
rule, and cgsi-auth's grant chips have had a border and no fill since. The
other `-soft` tokens are still declared — as the neutral grey the flip set them
to — so `bg-good-soft` resolves, to a grey wash, which is the retired shape
either way. The rule now reads the utility spelling as well as the token.

**`bg-accent/10` is the fourth spelling of a tint.** Tailwind compiles it to
`color-mix(in oklab, var(--color-accent) 10%, transparent)`: a hand-mixed tint
of a token, which is what `raw-rgb` froze when it was spelled `rgba()`. On
light it mixes from Ink Green and is neither the mark nor the tint. The two
in this package were `hover:bg-accent/10` on the user menu and the search
results — a hover ground, which is `--color-surface-2`, the fix `Ledger` took
in v3.3.0. The accent and status hues only: `bg-surface/85` under a backdrop
blur is a surface step with alpha and is not flagged. 🔴 **The first version
did not read the arbitrary spelling**, `hover:bg-[var(--color-accent)]/20`,
which compiles to the same thing and outnumbers the short form ten to one:
43 across people, salesapp, scheduling and finance. Fixed the same day,
before the ref moved — and the scheduling sweep found it independently,
where four of them had arrived as advisory findings instead of errors.

**`var(--color-${bucket})` is why the discipline dots inverted.** Every rule
here matches a literal, and this one did not exist until runtime. `scheduling`
assembled `--color-animation` / `gamedesign` / `digitalart` — frozen since
September — at 0 errors, and when the flip set those tokens to grey the dots
went with them and nothing reported it. In Tailwind the class form is worse
than unchecked: the compiler scans for complete class names, so `bg-${tone}`
is never generated. The fix is a static map, one literal per token; for a
discipline the fix is no colour, because disciplines are named.

### `accent-as-paint-class` — boundary or decoration

`border-accent` compiles to `border-color: var(--color-accent)`, which is
exactly what `accent-as-paint` flags in CSS and never saw in a class string.
This package's own `SubNav` drew its active-tab underline with it — the home
defect the CSS rule was written on, re-spelled. ⚠️ The first survey said 30
sites across 8 repos; the rule's own count is **155 lines across 14 repos**
(221 literals), because the survey grepped `-accent\b` and the estate writes
`border-[var(--color-accent)]` four times to one. Reading them gave the test
that decides each one:

- **A decoration** — an underline, a bar, a dot, a tick, a progress fill —
  stands beside type and is the bright mark: `border-accent-mark`,
  `bg-accent-mark`. On white, Ink Green makes a dull edge. `SubNav` moved.
- **A boundary** — the 1px border of a chip, a button, a field — must clear
  3:1 as a UI component edge (WCAG 1.4.11), and the bright mark on white is
  1.9:1. There Ink Green is the visible one and `border-accent` is correct;
  the line takes `cgsi-adherence-allow: accent-as-paint-class — boundary,
  <what>`. This package carries four: the Header's Admin button, the user
  menu's avatar and stepper, the selected filter chip.
- **A fill with a label on it** — the one primary button a view may have —
  keeps `bg-accent` for the reason the CSS rule gives: type sits on the paint,
  and Ink Green is what clears on white. It takes the pragma. ⚠️ Its label is
  `text-bg`, not `text-white`: on dark the accent is the bright mark and white
  on it is ~1.9:1. Two apps ship `bg-accent text-white` today.

Focus variants are excluded outright, as `outline` is in the CSS rule: a focus
indicator is an accessibility requirement, and on white Ink Green is the one
you can see. `text-accent` is ink. The alpha form reports once, as
`token-alpha`.

**`label-on-accent`** is the decidable half of what the first sweeps found on
every labelled fill: `text-white` on the accent, ~1.9:1 on dark, the default
theme. 57 lines across 10 repos, marketing 22 and people 16; a one-token swap
to `text-bg` in each, so advisory until the wave has run. The undecidable
half — a fill that sets no text colour at all and inherits `--color-text`,
wrong in both themes — has nothing on the line to read, and is why the
standard's button wants to be a package part.

Advisory on arrival, for the reason every colour rule here started that way.
Most of the 30 app sites are a hover border on a button that six repos copied
from this package's Header — which is to say, a rebuilt part.

⚠️ **The package's own `hover:bg-accent/10` and `SubNav` underline are fixed
in source but not yet released.** They ride the next release rather than
costing a 17-repo bump of their own.

## 🔴 The email exemption excused 62 files, and was for one

Email clients do not support CSS variables, so an HTML email template must
inline its hex and use a web-safe face. That is a real exemption and it stays.

⛔ **It was written as `/email/i.test(path)` and matched any path segment or
filename.** Counted from the filesystem on 23 Oct 2026, it exempted **62
source files across six repos from every rule, the error tier included**:

| repo | files | what they are |
|---|---|---|
| `marketing` | 41 | `src/app/email-sequences/` — an app SECTION, plus route handlers and lib helpers |
| `referrals` | 8 | `api/admin/referrers/emails` and an export loader |
| `salesapp` | 6 | `src/app/coaching/email-response/` — a dashboard with a table and a local `StatusBadge` |
| `launchpad-admin` | 3 | `src/app/mentors/[email]/` — a Next DYNAMIC SEGMENT |
| `people` | 2 | `email-validation.ts` |
| `studentportal` | 2 | `api/settings/emails` |

⛔ **So every "0 errors" this estate recorded before that date excluded them**,
the same shape of mistake as counting spellings of colour. It was found by the
`launchpad-admin` agent renaming `[email]` in a scratch copy and getting 11
tables instead of 10.

⚖️ **What the exemption was actually for: one file.** Of the 62, exactly one
emits inline-styled email markup — `marketing`'s
`src/lib/events/event-email-props.ts`, 13 HTML tags and 12 `style` attributes,
and the file carrying the note the checker quotes ("every colour is explicit:
an inherited one has rendered dark-on-dark"). Two more are ordinary app JSX
that happen to be named after the thing they list. The other 59 are route
handlers, validation helpers, aggregates and their tests. No repo in the estate
ships React Email, mjml or a templates directory — **there was no email naming
convention at all**, which is why a substring got reached for.

So the exemption now **names a convention** instead:

- a directory literally called `emails/` or `email-templates/`, or
- a `*.email.*` suffix (`confirmation.email.tsx`, `receipt.email.css`),
- ⛔ **and never under `app/`.**

The `app/` exclusion is not tidiness. In Next's router every segment is a URL,
not a claim about content: three repos serve an `emails` RESOURCE from
`app/api/.../emails/route.ts`, and without the exclusion the convention would
re-open the hole it closed. `[email]` shows a segment name can be an accident
outright. ⚖️ A segment named `app` anywhere excludes, rather than only
`src/app`, because the script is also run as `npx cgsi-adherence app`, and
**any ambiguity in an exemption resolves toward checking the file** — the one
direction that cannot hide debt.

A genuine template outside the convention takes a pragma naming email as the
reason. That is a decision somebody can read in review; a substring is not.

⚠️ **One repo goes red at the error tier when the ref is bumped.** `marketing`
moves 0 → **17 errors** and 8 → 15 advisory, all 17 in
`event-email-props.ts`: 8 `raw-hex`, 5 `off-scale-spacing`, 3
`rounded-corners`, 1 `non-brand-font`. Every one of them is correct for an
email and wrong for the app layer, so the fix there is to put the file inside
the convention — `src/lib/events/emails/` or `event-email-props.email.ts` —
not to change a colour. The other sixteen repos are unmoved. ⛔ That sweep
happens **before** the ref bump, not after.

⚠️ **`raw-hex` never saw a Tailwind palette class, and nothing did until
23 Oct.** `#16a34a` was a freeze finding; `bg-green-600` is the same colour on
the same screen and passed every run. 112 occurrences across seven repos were
sitting behind "0 errors" when `raw-palette` was written — `salesapp` 59,
`marketing` 42, and a red error line each in five more. ⛔ **So any colour
count taken before that date is a count of SPELLINGS, not of colour.**

All 112 were one of three things: an error line in red, a warning callout, or
a filled status pill. None was a third-party embed or a syntax-highlighting
theme — the usual reasons to exempt — so unlike the spacing ladder this is not
a rule the estate breaks because the rule is wrong. 🔴 The pills are the worst
of them, and not for the hue: a filled pill carries its meaning in colour
ALONE, which is what hard rule 5 exists to stop, and one of these boards
belongs to someone who is colour blind.

🟢 It arrived **advisory** and was flipped to **freeze the same day**, because
the sweep closed all 123 in one pass and every repo reached zero together.
There was no argument to have about whether the rule described the estate
wrongly — which is the argument that held the spacing ladder up for a day, and
was the right argument to have there.

⚠️ **The first count said 112 across seven repos and was wrong.** It came from
a hand-written list of repo names, and `cgsi-auth` was not on it. The right
number came from the filesystem — every directory carrying
`.github/workflows/adherence.yml`. ⛔ Never take an estate count from a list
somebody typed; the alpha-hex undercount above is the same mistake.

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

## 🔴 The gap these two rules close

Every other rule here checks a **value** — a hex, a face, a radius, a shadow,
a spacing step. Until 22 Oct 2026 none of them checked whether a **part** had
been rebuilt, and that is how the estate forked while the count read zero.

It was found by releasing a change to `Ledger`, `Status` and `Delta` and then
discovering that **no app imports any of them**. Apps take `Breadcrumb`,
`Header`, `SubNav`, `useUrlState`, `THEME_INIT_SCRIPT`, the fonts and the
stylesheet. The data parts they hand-rolled. First measurement:

| | Count |
|---|---|
| `rebuilt-table` | **169** across 14 apps |
| `rebuilt-part` | **9** across 5 apps |
| `raw-palette` | **123** across 8 apps (`salesapp` 59, `marketing` 42, `cgsi-auth` 11, five more with a red error line each) — **cleared 23 Oct** |

It also explains older trouble. The chart-colour sweep needed three passes and
still missed two files; the funnel and the feedback charts had to be found by
hand. A package change cannot reach a part the app rebuilt, so every fix was
a manual hunt through 17 repos.

⚠️ **Advisory on purpose, for now.** Erroring would take 14 repos red in one
commit for debt they did not create this week, which is how a checker gets
switched off — the same argument that kept geometry on its own tier until the
phase 4 flip. The tier moves to `error` when the estate is near zero, and not
before.

⛔ The rules do not run against the package itself, which is where these parts
are supposed to be defined. The exemption follows the **scanned root**, not
the working directory: keyed to cwd it looked right and silently never fired
under the test harness, which runs the script from the package against a temp
directory.

### `Ledger.expand` — the row that opens, and the four things it is not

Most surviving `rebuilt-table` findings are not ports somebody has not got to.
They are tables `Ledger` could not hold, and the single commonest reason was a
row that opens into detail — 7 of `scheduling`'s 9, the `courseapp` audit log,
`cgsi-auth`'s AppsTable, and the two biggest tables in `marketing`. `expand`
closes that, so **a disclosure arrow is no longer a reason to leave a table
hand-built**. Re-read a table you classified as blocked on it.

**What it is.** A dedicated 32px first column of toggles, and a row that opens
into a DETAIL PANEL spanning the table — one `<tr>` immediately after its row,
on `--color-surface-2` with a hairline each side so it reads as inset. The
panel is free-form content and ⚖️ **sits outside the density rung**: the rung
is the promise that DATA rows are one line, which is the only reason the number
column scans, so the panel takes the panel padding from the density pair
instead and the row above it is untouched.

⛔ **It is not these, and reaching for it anyway is how the part forks:**

| Not for | What it actually is |
|---|---|
| Child rows sharing the parent's columns | A different design, and not built. The panel is content, not a nested `<tbody>`; children that line up in the number columns want section rows and subtotals, which is the next gap |
| A `<details>` inside ONE cell | In-cell disclosure. Separate gap, separate shape — this opens the whole row |
| A per-row action menu | A popover, not a panel. Every body cell is `overflow-hidden`, and a menu that shoves the table open is not a menu |
| Somewhere to put the fields that would not fit | ⚖️ If every row has one and the reader needs it to read the row, the columns are wrong. A panel is for detail that is genuinely secondary — a trend, a diff, a payload |

⚖️ **Controlled only, and there is no uncontrolled variant coming.** Two
reasons, and the first is not negotiable: internal open state needs a hook, and
`Ledger` is one of the seven parts a server page renders directly — **v3.2.0
put a `createContext` in `Kpi` and killed every server component that imported
it**, through a CI that could never have caught it. The second is that the
caller already owns this honestly: which rows are open survives a sort, belongs
in the URL on a deep-linkable board, and "expand all" is then a line of the
caller's code rather than an imperative handle on a ref.

⚖️ **A row whose `render` returns `null` gets no toggle at all**, rather than a
button that opens an empty panel. A control that lies about there being
something behind it, once per row down a column of forty, is worse than no
control.

### `wide` pins the column that NAMES the row

🔴 **`wide` pins the `rowHeader` column, wherever it sits in the model** — plus
the toggle column at `0` when `expand` is set, with the row header immediately
after it at `32`. With no `rowHeader` column declared, the first column is
pinned, exactly as it always was, so no existing caller changes; a test pins
that.

⛔ **It is not column index 0.** Until v3.4.1 it was, and the same defect
surfaced twice: `governance`'s registers pinned a **56px ordinal**, and
`scheduling`'s `FindingsTable` had its naming column **fifth** and was worked
around by reordering the model — a layout decision forced by a pinning bug. A
pinned column that identifies nothing costs the reader the width and the name
at once, and `wide` exists for exactly one reason: so the row's NAME stays
beside the figures while the figures scroll.

⚖️ **Columns BEFORE the row header scroll underneath it, and that is correct.**
It is the caller's own declaration read back to them: they named one column as
the one that identifies the row, so every other column — left of it or right of
it — is less identifying than that one by their own account. Pinning the whole
run from 0 to the row header would pin an arbitrary number of columns decided
by model order rather than by anybody's intent. ⚠️ If a column to the left must
stay visible too, **move it to the right of the row header**; do not reach for a
second pin.

⚠️ A right-aligned column is refused as the pin, the same way `isRowHeader`
refuses it as a row header. A quantity does not identify a row, and `wide` must
not pin what `rowHeader` would not accept.

⚠️ With a toggle column, pinning only the toggle would pin 32px of chevrons;
pinning only the name would scroll the control out from under its own row, so a
reader scrolled right could not close the panel they opened. Both pin.

### Column keys can be typed

`LedgerColumn<T, K extends string = string>`. ⚖️ **`K` defaults to `string`, so
nothing an app has written changes.** An app whose column keys are already a
union gets `K` inferred from its `columns` array, and `sort.key`, `onSort(key)`
and `total.cells` are then checked against it — the three places a column name
could be mistyped, and the three places a mistake is silent (a `total` keyed to
a column that does not exist is a figure that renders nowhere). ⛔ **Do not cast
at the boundary any more.** A cast there was the signal that the part's type was
too loose, not that the app's was too tight.

⚠️ `expand.onToggle` takes the **ROW** key, which is `LedgerRow.key: string`,
and stays `string`. Rows are not generic in this part, and narrowing the
callback without narrowing `expanded: ReadonlySet<string>` with it would be a
type promising something the set beside it cannot keep.

⛔ **An open row is not restyled.** `selected`, `marked` and `closed` are claims
about the RECORD; "open" is a claim about the reader's screen. `aria-expanded`
and the glyph say it twice already, and a third signal would spend the accent
— or the one remaining weight — on nothing.

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

**A package part that looks wrong.** Fix it in the package, or report the API
gap — never nudge it from the app. `components.css` is imported unlayered, so
its declarations beat any Tailwind utility (which lives in `@layer utilities`)
on the same element: a `className="bg-surface-3"` on `Ledger`, `Panel` or
`Status` is dead CSS, and nothing in the build or the browser says so. Three
ports in the Oct 2026 table sweep reached for exactly this before reading the
cascade.

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

Current ruleset: `8a11185` (narrowed email exemption, `raw-rgb` enforced).
Bump deliberately, and expect every app's count to move when you do. If the
ref ever stops resolving, the fetch step fails loudly rather than passing
silently.

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
