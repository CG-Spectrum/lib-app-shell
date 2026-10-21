import localFont from "next/font/local";

// CGSI brand fonts, self-hosted from the cgsi-brand skill assets. Stack Sans
// Notch = display/headings; Quicksand = body (Stack Sans Text at phase 4);
// IBM Plex Mono = labels, strips, buttons, captions and table headers.
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
export const display = localFont({
  src: [
    { path: "./fonts/StackSansNotch-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/StackSansNotch-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

/* ⚠️ Quicksand is replaced in the 2027 brand by Stack Sans Text at weight 400
   (not 300: thin strokes break up at 13px on a dark ground). Swapping the face
   here changes every app's body type, so it ships with the phase 4 flip, not
   before. Phase 2 adds IBM Plex Mono alongside for labels.
   cgsi-adherence-allow: quicksand — replaced by Stack Sans Text at phase 4 */
export const body = localFont({
  src: [
    { path: "./fonts/Quicksand-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Quicksand-Bold.ttf", weight: "700", style: "normal" },
  ],
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
