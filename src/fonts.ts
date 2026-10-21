import localFont from "next/font/local";

// CGSI brand fonts, self-hosted from the cgsi-brand skill assets. Stack Sans
// Notch = display/headings; Stack Sans Text = body; IBM Plex Mono = labels,
// strips, buttons, captions and table headers. The three faces the 2027 brand
// has, and no others.
//
// Licence confirmed 2 Oct 2026 (Jeremy): both families are Google-licensed, so
// self-hosting is permitted.
//
// Shipped from the shell rather than copied into each app so a typeface change
// is one commit here plus a tag bump, not fifteen repos each carrying its own
// copy of the same files. The consuming layout does:
//
//     import { display, body, mono } from "@cgsi/app-shell/fonts";
//     <html className={`${display.variable} ${body.variable} ${mono.variable}`}>
//
// which sets --font-display / --font-body / --font-mono; brand.css reads them
// through --brand-display / --brand-body / --brand-mono. Requires
// "@cgsi/app-shell" in the app's next.config transpilePackages (already true
// estate-wide) so Next's font loader processes this file.
//
// An app that omits one of the three degrades to that token's quoted fallback
// rather than breaking — but only since the fallbacks were moved inside the
// var() (v1.32.1). Before that a missing variable silently poisoned the whole
// stack and the text inherited its parent's face.
/* ⚠️ THE RANGE IS NOT DECORATION. Both Stack faces default to 200 — their
   fvar default instance is ExtraLight, not Regular — so a declaration that
   omits or narrows `weight` does not fall back to something reasonable, it
   falls back to hairlines. The supplied axis is 200–700 on both; keep this
   string in sync with the file. Out of range the browser synthesises, and on
   Notch a synthesised bold smears the notch into a strikethrough. */

/* Display is weight 700 and ALWAYS uppercase: a lowercase run chains the notch
   into a strikethrough by design. */
export const display = localFont({
  src: [{ path: "./fonts/stack-sans-notch-variable.woff2", weight: "200 700", style: "normal" }],
  variable: "--font-display",
  display: "swap",
});

/* Body is Stack Sans Text at 400 — not 300, whose thin strokes break up at
   13px on the dark ground.

   ⚠️ THIS IS A WEIGHT CHANGE AS WELL AS A TYPEFACE CHANGE, and the weight is
   the part nobody expects. Quicksand shipped as two static files, 500 and 700.
   base.css sets no font-weight on body, so every page asked for 400; CSS font
   matching, for a desired weight in 400–500, takes the nearest available at or
   above the target, which was 500. Body copy has therefore been rendering at
   500 for the whole 2025 estate. A variable 200–700 face honours the request,
   so the same markup now renders a true 400 and reads lighter — correctly, and
   for the first time. Anything that looked right only because it was secretly
   half a weight heavy will show it. */
export const body = localFont({
  src: [{ path: "./fonts/stack-sans-text-variable.woff2", weight: "200 700", style: "normal" }],
  variable: "--font-body",
  display: "swap",
});

/* The app layer's third face. 500 is the working weight — labels, tabs, strips
   and buttons are all mono 500 caps in the standard — and 400 ships with it so
   a caption or an inline code span has something to sit on that is not the
   label weight.

   ⛔ Mono is never reading copy. It is 9–11px, caps, tracked .14em.

   Two static weights rather than the variable file the Stack faces use: IBM
   Plex Mono has no variable release on Google Fonts, and at 10 KB each the
   pair costs less than one of the TTFs above.

   ⚠️ This is the face --brand-mono has been NAMING since phase 2 while
   resolving to the system monospace stack, because nothing defined
   --font-mono. Adding it here is what makes every `font-family:
   var(--brand-mono)` across the estate actually render as Plex. Expect mono
   text to change appearance in any app that picks this up — that is the fix
   landing, not a regression. */
export const mono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});
