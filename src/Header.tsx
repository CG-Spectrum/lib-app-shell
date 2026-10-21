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
// tokens (bg-surface, border-accent, text*) every app already defines.
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
  const admin = adminEntryFor(user.apps);
  return (
    <header className="sticky top-0 z-50 bg-surface/85 backdrop-blur border-b-2 border-accent">
      <div className="w-full px-6 py-3 flex items-center gap-3">
        <AppLauncher catalog={APPS} userApps={user.apps} currentApp={currentApp} />
        <img src="/cgspectrum-icon.png" alt="CG Spectrum" width={32} height={32} className="" />
        <a href="/" className="text-base font-bold tracking-tight text-text">
          {wordmark}
        </a>
        {subtitle && <span className="text-text-3 text-xs">{subtitle}</span>}
        <div className="ml-auto flex items-center gap-3">
          <SearchBar userApps={user.apps} />
          {children}
          {admin && (
            <a
              href={admin.url}
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
