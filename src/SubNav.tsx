"use client";

import { Fragment } from "react";
import { rememberTab } from "./last-tab";
import { badgeText } from "./notifications";

/**
 * SubNav — shared left-justified section tab row.
 *
 * Sits flush under the Header's bottom border. Consumers supply tabs and
 * currentPath (from their own usePathname() or router). No next/link dep —
 * renders plain <a> elements so the component stays framework-agnostic.
 *
 * Last-tab memory: pass `rememberSection` (the app's estate key, e.g.
 * "salesapp") and every tab click is written to the estate last-tab cookie
 * via rememberTab(). The app's root page resolves it with resolveLastTab()
 * to land returning users on the section they were last in. Omit the prop
 * and SubNav behaves exactly as before.
 *
 * Active state: accent-MARK underline + accent text. ⛔ The underline is a
 * decoration, not a boundary: on white `border-accent` is Ink Green and makes
 * a dull edge (the home defect `accent-as-paint` was written on, 23 Oct 2026).
 * Inactive state: muted text, hover → primary text.
 *
 * Visual reference: courseapp viewer-tab row (bg-surface, border-border,
 * border-accent, text-text-2, text-accent). Implemented with shared @theme
 * Tailwind tokens every consuming app already defines.
 */

export interface SubNavTab {
  href: string;
  label: string;
  /** Items awaiting action behind this tab. >0 renders a count badge beside
   *  the label (capped at "9+"); 0/undefined renders nothing. Typically fed
   *  from the app's own /api/notifications `paths` map — see notifications.ts
   *  for the estate convention. */
  badge?: number;
  /** Optional section group. A thin divider renders between two adjacent
   *  tabs whose groups differ; tabs without a group never get one, so apps
   *  that don't pass it render exactly as before. Order is the caller's job:
   *  keep each group's tabs contiguous. */
  group?: string;
  /** Match this tab's href EXACTLY rather than by prefix.
   *
   *  🔴 The reason app-auth forked this whole component. A parent route and
   *  its children ("/admin", "/admin/logs", "/admin/apps") all prefix-match
   *  the parent, so the parent tab stayed lit on every child page — and
   *  rather than extend SubNav, the app copied it. The copy then sat out the
   *  v2.3.0 nav conformance and the v2.6.0 no-wrap fix, which is how it ended
   *  up rendering body 14px sentence case while the estate moved to Mono 11
   *  caps (Jeremy, 22 Oct 2026: "the tabs aren't using the right fonts,
   *  ensure that's all coming from the same place").
   *
   *  ⛔ Defaults to false, so every existing caller is unaffected. */
  exact?: boolean;
}

/**
 * Pure divider helper — exported for direct unit testing. True when a divider
 * belongs BEFORE tabs[i]: both it and its predecessor carry a group, and the
 * groups differ.
 */
export function startsNewGroup(tabs: readonly SubNavTab[], i: number): boolean {
  if (i <= 0) return false;
  const prev = tabs[i - 1].group;
  const cur = tabs[i].group;
  return prev !== undefined && cur !== undefined && prev !== cur;
}

/**
 * Pure active-state helper — exported for direct unit testing.
 *
 * Rules:
 *  - root href "/" → active ONLY on exact "/"
 *  - `exact` → active ONLY on an exact match, for a parent route whose
 *    children are themselves tabs ("/admin" beside "/admin/logs")
 *  - any other href → active on exact match OR when currentPath starts with href
 *    followed by "/" (prevents "/schedule" matching "/scheduling")
 */
export function isActiveTab(href: string, currentPath: string, exact = false): boolean {
  if (href === "/" || exact) {
    return currentPath === href;
  }
  if (currentPath === href) return true;
  // Prefix match — require the next character to be "/" so segments don't bleed
  return currentPath.startsWith(href + "/");
}

/**
 * Pure tab-class helper — exported for direct unit testing.
 *
 * ⚖️ THE STANDARD'S TAB, not a smaller body label. Mono 500 at 11 with .14em
 * tracking, in caps, with a 2px accent rule under the active one
 * (surface-app-layer.md, "Navigation": "Tabs ... Mono 11 caps, 2px accent rule
 * under the active tab", and the type table's "Tab, button" row).
 *
 * It had been body 600 at 12.25px in sentence case — the face and the case
 * both wrong, which is most of why the top bars looked like a different
 * product in each app.
 *
 * ⛔ Non-active is PAPER, not --color-text-2. A nav item you can go to is not
 * secondary information; dimming the whole bar to make one item stand out
 * spends contrast the brand does not have to spare, and the accent plus the
 * rule already marks the current page twice over.
 *
 * 🔴 `whitespace-nowrap shrink-0` is load-bearing, not tidying. A flex item
 * defaults to `flex-shrink: 1` and `min-width: auto`, so once the row runs out
 * of width every multi-word tab shrinks to its min-content width and BREAKS
 * ACROSS TWO LINES — "Email / Sequences", "Social / Sentiment" — while the row
 * itself stays one row and the active tab's 2px rule detaches from the nav's
 * bottom border. Reported in marketing, 21 Oct 2026.
 *
 * ⚠️ This is a v2.3.0 regression, not a pre-existing limit. Conforming the nav
 * swapped body 600 / 12.25px / sentence case for Mono 11 caps at .14em
 * tracking, which is WIDER per character despite the smaller size: marketing's
 * fifteen labels went from roughly 1,070px of text to roughly 1,390px.
 * Display scale compounds it — `zoom` divides the effective viewport, so the
 * 1.40 rung gives a 2880px screen about 2,060 usable px, and a 1920px screen
 * at 1.15 gets about 1,670.
 *
 * ⛔ Do not "fix" this with flex-wrap. Wrapping the ROW puts every tab but the
 * last row's off the nav's bottom border, and the active underline then floats
 * mid-bar. The row stays one row and scrolls; see SubNav's container.
 */
export function tabClassName(active: boolean): string {
  return [
    "inline-block shrink-0 whitespace-nowrap",
    "px-3 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em]",
    "transition-colors duration-100",
    "border-b-2 -mb-px", // sits on the nav's bottom border
    active
      ? "border-accent-mark text-accent"
      : "border-transparent text-text hover:text-accent hover:border-border",
  ].join(" ");
}

export function SubNav({
  tabs,
  currentPath,
  rememberSection,
}: {
  tabs: SubNavTab[];
  currentPath: string;
  /** Estate last-tab key (usually the app key). When set, tab clicks are
   *  remembered in the cgsi-last-tab cookie for the app root to resolve. */
  rememberSection?: string;
}) {
  return (
    <nav
      // Pinned beneath the sticky Header (its content row is 56px + 2px accent
      // border = 58px). If the Header's height ever changes, update this offset.
      className="sticky top-[58px] z-40 w-full bg-surface border-b border-border"
      aria-label="Section navigation"
    >
      {/* ⛔ No flex-wrap — see tabClassName. The row holds one line and scrolls
          when the tabs outrun it, so the active tab's rule always sits on the
          nav's bottom border and no tab is ever unreachable. A thin scrollbar
          rather than a hidden one: hiding it leaves no affordance that there
          is more, and an edge-fade mask would be a new brand decision for the
          chrome, which belongs in cgsi-2027-design first. */}
      <div className="flex items-end gap-1 overflow-x-auto px-6 [scrollbar-width:thin]">
        {tabs.map((tab, i) => {
          const active = isActiveTab(tab.href, currentPath, tab.exact);
          const badge = badgeText(tab.badge);
          return (
            <Fragment key={tab.href}>
              {startsNewGroup(tabs, i) && (
                // Decorative: a line, not a colour, so it reads for CVD users too.
                <span
                  aria-hidden="true"
                  className="mx-1.5 mb-3 h-4 w-px shrink-0 self-end bg-border"
                />
              )}
              <a
                href={tab.href}
                onClick={
                  rememberSection
                    ? () => rememberTab(rememberSection, tab.href)
                    : undefined
                }
                aria-current={active ? "page" : undefined}
                className={tabClassName(active)}
              >
                {tab.label}
                {badge && (
                  // ⛔ ATTENTION, NOT ACCENT. "Items awaiting action" is a
                  // STATUS, and the standard is explicit: "green marks
                  // selection, never status". This badge was accent-tinted
                  // with accent text, which both broke that rule and spent
                  // green on something that is not the current item — while
                  // app-people had quietly built its own amber marker beside
                  // it, and forked this whole component to hang it on.
                  // One marker language now, and it is the amber one
                  // (Jeremy, 22 Oct 2026).
                  <span
                    className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center bg-[var(--color-attention)] px-[5px] text-[10px] font-bold leading-none text-[var(--color-bg)]"
                    aria-label={`${tab.badge} awaiting action`}
                  >
                    {badge}
                  </span>
                )}
              </a>
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
