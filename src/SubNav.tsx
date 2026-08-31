"use client";

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
 * Active state: accent underline + accent text.
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
}

/**
 * Pure active-state helper — exported for direct unit testing.
 *
 * Rules:
 *  - root href "/" → active ONLY on exact "/"
 *  - any other href → active on exact match OR when currentPath starts with href
 *    followed by "/" (prevents "/schedule" matching "/scheduling")
 */
export function isActiveTab(href: string, currentPath: string): boolean {
  if (href === "/") {
    return currentPath === "/";
  }
  if (currentPath === href) return true;
  // Prefix match — require the next character to be "/" so segments don't bleed
  return currentPath.startsWith(href + "/");
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
      <div className="flex items-end gap-1 px-6">
        {tabs.map((tab) => {
          const active = isActiveTab(tab.href, currentPath);
          const badge = badgeText(tab.badge);
          return (
            <a
              key={tab.href}
              href={tab.href}
              onClick={rememberSection ? () => rememberTab(rememberSection, tab.href) : undefined}
              aria-current={active ? "page" : undefined}
              className={[
                "inline-block px-3 py-2.5 text-sm font-semibold transition-colors duration-100",
                "border-b-2 -mb-px", // sits on the nav's bottom border
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-text-2 hover:text-text hover:border-border",
              ].join(" ")}
            >
              {tab.label}
              {badge && (
                // Chip colouring (accent on accent-soft), not solid accent with
                // white text — #EA27C2 under white fails AA at this size.
                <span
                  className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full border border-accent-border bg-accent-soft px-1 text-[10px] font-bold leading-4 text-accent"
                  aria-label={`${tab.badge} awaiting action`}
                >
                  {badge}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
