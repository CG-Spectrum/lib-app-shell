// Estate display density. Sits beside the theme: same cookie scope, same
// pre-paint resolution, same estate-wide follow. A user who runs the timetable
// at compact and the leadership board at comfortable is reading two different
// products; density is a property of the person, not the app.
//
// ⚖️ DENSITY IS SIZE ONLY. It changes row height, body size and panel padding.
// It never changes typeface, weight or colour — those carry meaning, and a
// setting that moved them would make the same screen say different things at
// two densities. The 2027 app layer states this outright and the token set
// below is deliberately narrow enough to make a violation obvious in review.
//
// 🔴 SIX SPACING STEPS, AND NO SEVENTH. 4, 8, 12, 16, 24, 40. Density picks
// between values already in that set (24 → 16 padding, 40 → 32 row); it does
// not introduce a scale of its own. If a part needs a size that is not here,
// the part is wrong, not the scale.

export const DENSITY_COOKIE = "cgsi-density";

export type Density = "comfortable" | "compact";

// Pure resolution. An explicit cookie wins; anything else is comfortable,
// which is the shipped default and the safer of the two to land on by
// accident — compact at 13px on a dark ground is a deliberate choice, not
// somewhere a junk cookie value should put somebody.
export function resolveDensity(cookieValue: string | null | undefined): Density {
  return cookieValue === "compact" ? "compact" : "comfortable";
}

// Inline pre-paint script, rendered as the first child of <body> alongside
// THEME_INIT_SCRIPT. Density changes row heights, so resolving it after paint
// reflows every table on the page; this runs before anything is drawn.
// Defaults to comfortable on any error.
export const DENSITY_INIT_SCRIPT =
  '(function(){try{var m=document.cookie.match(/(?:^|;\\s*)cgsi-density=(comfortable|compact)/);' +
  'document.documentElement.dataset.density=m?m[1]:"comfortable"}' +
  'catch(e){document.documentElement.dataset.density="comfortable"}})()';

// Domain-scoped to the estate in production, host-only on localhost — a
// .cgspectrum.com domain attribute would be rejected there. Mirrors
// themeCookieString deliberately: two cookies that behave differently would be
// a bug waiting to be found by whoever ships the third.
export function densityCookieString(density: Density, hostname: string): string {
  const base = `${DENSITY_COOKIE}=${density}; path=/; max-age=31536000; samesite=lax`;
  return hostname.endsWith("cgspectrum.com") ? `${base}; domain=.cgspectrum.com; secure` : base;
}

export function applyDensity(density: Density): void {
  document.documentElement.dataset.density = density;
  document.cookie = densityCookieString(density, location.hostname);
}

// The measurements each density resolves to. Parts read these rather than
// branching on the density string, so there is one place to change a number
// and one place to read it in a test.
//
// Row heights are the 2027 standard's: 40 comfortable, 32 compact. Body is 14
// and 13 — not 12, because Stack Sans Text at 400 stops being reliably legible
// below 13 on #131919, which is the same reason the body weight is 400 rather
// than the website's 300.
// `data` is the mono rung for numbers and codes: one step under the body,
// because Plex Mono is wider per character than Stack Sans Text. It sets at
// 500, not 400 — see the note beside --density-data in brand.css.
export const DENSITY_METRICS = {
  comfortable: { row: 40, body: 14, data: 13, panelPad: 24 },
  compact: { row: 32, body: 13, data: 12, panelPad: 16 },
} as const satisfies Record<
  Density,
  { row: number; body: number; data: number; panelPad: number }
>;

export function densityMetrics(density: Density) {
  return DENSITY_METRICS[density];
}
