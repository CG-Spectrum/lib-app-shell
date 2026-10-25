"use client";
import type { ReactNode } from "react";
import { APPS, adminEntryFor, type ShellUser } from "./apps";
import { AppLauncher } from "./AppLauncher";
import { UserMenu } from "./UserMenu";
import type { ProfileLink } from "./usermenu-logic";
import { SearchBar } from "./SearchBar";

// Canonical CGSI app header. Presentational: identity facts arrive as props the
// consuming app extracts from its own auth() session. Shared via @cgsi/app-shell
// — change here, version-bump, every app updates. Uses only the shared @theme
// tokens (bg-surface, border-border-strong, text*) every app already defines.
export function Header({
  currentApp,
  user,
  authHostUrl,
  subtitle,
  profileLinks,
  children,
}: {
  currentApp: string;
  user: ShellUser;
  authHostUrl: string;
  subtitle?: string;
  /** Passed straight through to UserMenu. See its doc comment for why the
   *  shell never invents these itself. */
  profileLinks?: ProfileLink[];
  children?: ReactNode;
}) {
  const entry = APPS.find((a) => a.key === currentApp);
  if (!entry && (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "development") {
    console.warn(`[@cgsi/app-shell] currentApp "${currentApp}" not found in catalog`);
  }
  const wordmark = entry?.name ?? "CGSI";
  // Far-right Admin shortcut for admin-grant holders — reach the grants/roles
  // page from any app without opening the launcher.
  // ⛔ The header's bottom rule — the line directly above the SubNav tab row —
  // is NEUTRAL. It was border-accent from the first build of this package and
  // nothing in the standard ever asked for it: hard rule 4 reserves the accent
  // for the current item, the selection, the one series that matters and the
  // one primary button per view, and a bar on every screen of every app is
  // none of those.
  //
  // It also competed with the one green that does carry meaning. The active
  // tab's 2px accent rule sits 56px below this, same weight and same colour,
  // so the informative mark was the SECOND green line on the page
  // (Jeremy, 21 Oct 2026: "save the green as much as possible").
  //
  // Written into cgsi-2027-design, surface-app-layer.md, "The chrome is
  // neutral", before this line changed.
  //
  // ⚠️ Still 2px, not a 1px hairline: SubNav pins itself at top-[58px], which
  // is this 56px content row plus this border. The weight is load-bearing;
  // only the colour was wrong.
  const admin = adminEntryFor(user.apps);
  return (
    <header className="sticky top-0 z-50 bg-surface/85 backdrop-blur border-b-2 border-border-strong">
      <div className="w-full px-6 py-3 flex items-center gap-3">
        <AppLauncher catalog={APPS} userApps={user.apps} currentApp={currentApp} />
        <img src="/cgspectrum-icon.png" alt="CG Spectrum" width={32} height={32} className="" />
        {/* ⚖️ The app name is header furniture, so it takes the header's
            voice: mono 500 caps, the same treatment as the numbering strip
            the standard puts up here. It was body 700 at 14px in sentence
            case, which read as a heading and made the name the loudest thing
            in a bar whose job is wayfinding. */}
        <a
          href="/"
          className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-text"
        >
          {wordmark}
        </a>
        {subtitle && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-3">
            {subtitle}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <SearchBar userApps={user.apps} />
          {children}
          {admin && (
            <a
              href={admin.url}
              // cgsi-adherence-allow: accent-as-paint-class — boundary: the button's 1px edge on hover, framing accent ink; must clear 3:1 on white
              className="border border-border px-2 py-1 text-xs text-text-2 hover:border-accent hover:text-accent transition-colors"
            >
              Admin
            </a>
          )}
          <UserMenu
            email={user.email}
            name={user.name}
            image={user.image}
            authHostUrl={authHostUrl}
            profileLinks={profileLinks}
          />
        </div>
      </div>
    </header>
  );
}
