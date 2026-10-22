// Display scale. Sits beside the theme and the density: same cookie scope,
// same pre-paint resolution, same estate-wide follow.
//
// ⚖️ WHAT IT IS FOR. A reader on a 27" monitor was zooming the browser to make
// the interface a comfortable size, and then doing it again in the next app,
// because Chrome stores zoom per ORIGIN and every app in this estate is its
// own subdomain. Scale is that zoom, moved into the product and into the
// estate cookie, so it is set once and followed everywhere — the same argument
// density.ts already makes for row height: it is a property of the person and
// their screen, not of the app.
//
// ⛔ SCALE IS NOT DENSITY. Scale asks how big the screen is; density asks how
// much the reader wants on it. A reader on a 27" who wants more rows picks
// compact AND still gets 1.25. Folding either into the other gives you a
// setting that cannot express "big screen, dense table", which is the most
// common request there is.

export const SCALE_COOKIE = "cgsi-scale";

/** `auto` derives from the viewport; the rest pin a rung. */
export type Scale = "auto" | "1" | "1.15" | "1.25" | "1.4";

export const SCALE_CHOICES: readonly Scale[] = ["auto", "1", "1.15", "1.25", "1.4"];

/* The ladder, from surface-app-layer.md "Display scale". Breakpoints are
   classes of monitor rather than round numbers: laptop, 1080p/1440p external,
   27" QHD, 4K and ultrawide — all at 1x, because a HiDPI screen reports
   laptop-class CSS pixels and must NOT be scaled twice.
   ⛔ There is no rung below 1. Body is 13px at compact and the face stops
   being legible under it on the dark ground, so scaling down to fit more on a
   small screen is not on offer. */
export const SCALE_STEPS: readonly { readonly maxWidth: number; readonly scale: number }[] = [
  { maxWidth: 1680, scale: 1 },
  { maxWidth: 2199, scale: 1.15 },
  { maxWidth: 2879, scale: 1.25 },
  { maxWidth: Infinity, scale: 1.4 },
];

/**
 * The automatic rung for a viewport width in CSS pixels.
 *
 * ⚠️ CSS pixels, from `window.innerWidth` — never `screen.width` or
 * `devicePixelRatio`. CSS px already account for HiDPI and for whatever zoom
 * the reader has set themselves, so a Retina 27" reporting 1280 correctly
 * stays at 1: its pixels are already small. Reading the device would scale it
 * a second time.
 */
export function scaleForWidth(cssWidth: number): number {
  if (!Number.isFinite(cssWidth) || cssWidth <= 0) return 1;
  return SCALE_STEPS.find((s) => cssWidth <= s.maxWidth)!.scale;
}

/** An explicit cookie wins; anything else is auto, the shipped default. */
export function resolveScale(cookieValue: string | null | undefined): Scale {
  return (SCALE_CHOICES as readonly string[]).includes(cookieValue ?? "")
    ? (cookieValue as Scale)
    : "auto";
}

/** The number a setting resolves to at a given viewport width. */
export function scaleValue(setting: Scale, cssWidth: number): number {
  return setting === "auto" ? scaleForWidth(cssWidth) : Number(setting);
}

/** The pinned rungs, in order, without `auto`. The stepper walks this. */
export const SCALE_RUNGS: readonly Scale[] = ["1", "1.15", "1.25", "1.4"];

/**
 * One step of the Smaller / Larger control.
 *
 * ⚖️ STEPPING AWAY FROM AUTO PINS. The step is taken from the rung the reader
 * is actually LOOKING AT — auto resolves against the viewport first — and the
 * result is always a pinned rung, never auto. Someone pressing Smaller is
 * stating a preference about their own screen, and leaving the setting on
 * auto would have the next resize silently overrule them. `toAuto` is how
 * they hand the decision back.
 *
 * Clamps at both ends rather than wrapping: a control that jumps from the
 * largest to the smallest on one more press reads as a bug, and the caller
 * disables the button at the end of the ladder anyway.
 *
 * ⛔ There is still no rung below 1 — see SCALE_STEPS. Jeremy, 21 Oct 2026,
 * found the interface better at about 80% of what auto gave him on a 3072px
 * viewport; auto puts that screen on 1.4, and 1.15 is 82% of 1.4, so the
 * ladder already holds what was being asked for. A sub-1 rung would take body
 * under 13px on the dark ground, which is the one thing the type scale will
 * not do.
 */
export function stepScale(setting: Scale, cssWidth: number, direction: -1 | 1): Scale {
  const current = scaleValue(setting, cssWidth);
  // Nearest rung, so an auto value that is not itself on the ladder (it always
  // is today, but SCALE_STEPS and SCALE_RUNGS are free to drift apart) still
  // steps somewhere sensible rather than falling off the end.
  let i = 0;
  for (let k = 1; k < SCALE_RUNGS.length; k++) {
    if (Math.abs(Number(SCALE_RUNGS[k]) - current) < Math.abs(Number(SCALE_RUNGS[i]) - current)) i = k;
  }
  const next = Math.min(SCALE_RUNGS.length - 1, Math.max(0, i + direction));
  return SCALE_RUNGS[next]!;
}

/** True when the control at this end of the ladder can do nothing. */
export function scaleStepDisabled(setting: Scale, cssWidth: number, direction: -1 | 1): boolean {
  return stepScale(setting, cssWidth, direction) === scaleSettingAt(setting, cssWidth);
}

/** The pinned rung a setting currently equates to, for comparing against a step. */
function scaleSettingAt(setting: Scale, cssWidth: number): Scale {
  const current = scaleValue(setting, cssWidth);
  return (SCALE_RUNGS.find((r) => Number(r) === current) ?? "1") as Scale;
}

/**
 * What the menu shows. Names the resolved percentage either way, because the
 * number is the thing the reader is judging; `auto` is a prefix on it, not a
 * replacement for it. Returns "" before mount, when the width is unknown and
 * the caller has nothing true to say yet.
 */
export function scaleLabel(setting: Scale | null, cssWidth: number): string {
  if (setting === null) return "";
  const pct = `${Math.round(scaleValue(setting, cssWidth) * 100)}%`;
  return setting === "auto" ? `Auto · ${pct}` : pct;
}

// Domain-scoped to the estate in production, host-only on localhost. Mirrors
// themeCookieString and densityCookieString deliberately: three cookies that
// behaved differently would be a bug waiting for whoever ships the fourth.
export function scaleCookieString(scale: Scale, hostname: string): string {
  const base = `${SCALE_COOKIE}=${scale}; path=/; max-age=31536000; samesite=lax`;
  return hostname.endsWith("cgspectrum.com") ? `${base}; domain=.cgspectrum.com; secure` : base;
}

export function applyScale(scale: Scale): void {
  document.documentElement.dataset.scale = scale;
  document.documentElement.style.setProperty(
    "--ui-scale",
    String(scaleValue(scale, window.innerWidth)),
  );
  document.cookie = scaleCookieString(scale, location.hostname);
}

/* ─────────────────────────────────────────────────────────────────────────────
   The estate's single pre-paint script: theme, density and scale.

   🔴 DENSITY HAD NEVER RUN. Every one of the 17 apps injects
   THEME_INIT_SCRIPT and not one injected DENSITY_INIT_SCRIPT, so
   `data-density` was never stamped and the compact setting has been inert in
   production since it shipped. Found while wiring scale, which would have
   been the third script nobody injected. One script that does all three is
   the fix for both the bug and its cause.

   Pre-paint matters for all three and most for scale: resolving it after
   paint shows the whole interface at one size and then jumps it to another.

   Scale is read from window.innerWidth, which is NOT affected by the zoom we
   then apply — verified in Chrome against a live app at 1.0 through 2.0.
   Were it affected, an auto scale would oscillate: zoom up, measure a
   narrower viewport, drop a rung, measure wider, climb again.

   The resize listener only recomputes while the setting is auto; a pinned
   rung stays pinned when the window moves between monitors.
   ──────────────────────────────────────────────────────────────────────── */
export const CHROME_INIT_SCRIPT =
  "(function(){var d=document.documentElement;" +
  "function c(n,p){var m=document.cookie.match(new RegExp('(?:^|;\\\\s*)'+n+'=('+p+')'));return m?m[1]:null}" +
  "try{var t=c('cgsi-theme','light|dark')||" +
  "(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');" +
  "d.dataset.theme=t}catch(e){d.dataset.theme='dark'}" +
  "try{d.dataset.density=c('cgsi-density','comfortable|compact')||'comfortable'}" +
  "catch(e){d.dataset.density='comfortable'}" +
  "try{var s=c('cgsi-scale','auto|1\\\\.15|1\\\\.25|1\\\\.4|1')||'auto';d.dataset.scale=s;" +
  "function v(){var w=window.innerWidth;" +
  "return s!=='auto'?s:(w<=1680?'1':w<=2199?'1.15':w<=2879?'1.25':'1.4')}" +
  "function a(){d.style.setProperty('--ui-scale',v())}a();" +
  "if(s==='auto'&&window.addEventListener)addEventListener('resize',a,{passive:true})}" +
  "catch(e){d.style.setProperty('--ui-scale','1')}})()";
