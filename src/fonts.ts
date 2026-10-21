import localFont from "next/font/local";

// CGSI brand fonts, self-hosted from the patched TTFs (cgsi-brand skill assets).
// Stack Sans Notch = display/headings; Quicksand = body.
//
// Shipped from the shell rather than copied into each app so a typeface change
// is one commit here plus a tag bump, not fifteen repos each carrying its own
// copy of the same four TTFs. The consuming layout does:
//
//     import { display, body } from "@cgsi/app-shell/fonts";
//     <html className={`${display.variable} ${body.variable}`}>
//
// which sets --font-display / --font-body; brand.css reads them through
// --brand-display / --brand-body. Requires "@cgsi/app-shell" in the app's
// next.config transpilePackages (already true estate-wide) so Next's font
// loader processes this file.
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
