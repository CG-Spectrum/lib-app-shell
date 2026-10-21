// Estate light/dark theming. The dark palette is the default (it's the design
// the estate shipped with); light mode is a token-override block in each app's
// globals.css under html[data-theme="light"]. Preference lives in a cookie
// scoped to .cgspectrum.com so a toggle in one app follows the user across the
// whole estate (localStorage is per-subdomain and would reset on every app
// switch). No cookie → the user's OS preference.

import { CHROME_INIT_SCRIPT } from "./scale";

export const THEME_COOKIE = "cgsi-theme";

export type Theme = "light" | "dark";

// Pure resolution: explicit cookie wins; otherwise the OS preference.
// Junk cookie values fall through to the OS.
export function resolveTheme(cookieValue: string | null | undefined, prefersLight: boolean): Theme {
  if (cookieValue === "light" || cookieValue === "dark") return cookieValue;
  return prefersLight ? "light" : "dark";
}

// Inline pre-paint script for app root layouts: render as the FIRST child of
// <body> (App Router owns <head>) so it runs before anything paints — no theme
// flash. Defaults to dark on any error (the shipped design).
/**
 * @deprecated in name only — still the thing to inject, and still the only
 * one. It now resolves theme, density AND scale, because every app already
 * injects this and asking seventeen layouts to add a second script is how
 * density ended up inert: it shipped its own init script and not one app ever
 * injected it. Prefer importing CHROME_INIT_SCRIPT, which is the same string
 * under the name that tells the truth.
 */
export const THEME_INIT_SCRIPT = CHROME_INIT_SCRIPT;

// Cookie string for a theme choice. Domain-scoped to the estate in production;
// host-only on localhost (a .cgspectrum.com domain attribute would be rejected).
export function themeCookieString(theme: Theme, hostname: string): string {
  const base = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  return hostname.endsWith("cgspectrum.com") ? `${base}; domain=.cgspectrum.com; secure` : base;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.cookie = themeCookieString(theme, location.hostname);
}
