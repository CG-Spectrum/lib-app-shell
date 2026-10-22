import type { ReactNode } from "react";

// Status and Notice. The two ways the app layer says something is wrong.
//
// 🔴 COLOUR IS THE THIRD SIGNAL, NEVER THE FIRST. Every status carries a glyph
// AND a word. Not a coloured dot, not a filled pill — a mark and a label, with
// the hue as reinforcement for the people who can read it. Jeremy is colour
// blind; a distinction carried by a CSS variable is one he cannot make, and
// several of these screens are his.
//
// ⚖️ ERROR IS THE ONLY FILLED GLYPH, deliberately, so it reads first on a
// monochrome screen or to a monochrome reader without depending on red.
//
// ⛔ GREEN IS NOT A STATUS. The accent marks selection, the current item, the
// one series that matters. Success is sage (--color-good), which is why that
// token is not the accent and must not be "corrected" to it.
//
// The hue set was chosen by protan/deutan/tritan simulation and every value
// clears 4.5:1 as text on both grounds. ⛔ Do not substitute hues.

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

// Glyphs, not icons. One character each, so a status costs no layout and
// cannot fail to load. Error is filled; nothing else is.
const GLYPH: Record<StatusTone, string> = {
  success: "●",
  warning: "▲",
  error: "✕",
  info: "ℹ",
  neutral: "–",
};

const TONE_TEXT: Record<StatusTone, string> = {
  success: "text-good",
  warning: "text-warn",
  error: "text-bad",
  info: "text-info",
  neutral: "text-text-3",
};

const TONE_BORDER: Record<StatusTone, string> = {
  success: "border-good",
  warning: "border-warn",
  error: "border-bad",
  info: "border-info",
  neutral: "border-border-strong",
};

export interface StatusProps {
  tone: StatusTone;
  /**
   * The word. Required, and there is no default: a status whose label the
   * caller could not be bothered to write is a coloured dot with extra steps.
   */
  children: ReactNode;
  className?: string;
}

export function Status({ tone, children, className = "" }: StatusProps) {
  return (
    <span className={`inline-flex items-baseline gap-1 whitespace-nowrap ${TONE_TEXT[tone]} ${className}`}>
      <span aria-hidden className={tone === "error" ? "font-bold" : undefined}>
        {GLYPH[tone]}
      </span>
      {/* The word takes the mono label rung so a status sits in the same band
          as the tabs and the filter chips — it is a label, not prose. The
          glyph stays in the surrounding face: it is a mark, not a character. */}
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em]">
        {children}
      </span>
    </span>
  );
}

// A delta is a number with a sign, so it takes the mono data rung — the same
// face and size as the numeric cells it almost always sits beside.
const DELTA_FACE = "font-mono text-[length:var(--density-data)] font-medium";

// A delta, with its sign. Deltas always carry + or −, so the direction survives
// without the colour. A zero delta is an em-dash in muted text, not a green 0.
export function Delta({
  value,
  suffix = "",
  className = "",
}: {
  value: number | null | undefined;
  /** "pp" for percentage points, "%" for a percentage. Units, not decoration. */
  suffix?: string;
  className?: string;
}) {
  if (value === null || value === undefined || value === 0) {
    return <span className={`${DELTA_FACE} text-text-3 ${className}`}>—</span>;
  }
  const up = value > 0;
  // 🔴 U+2212 MINUS, not a hyphen. At 10-14px tabular a hyphen is half the
  // width of the plus and the column stops lining up.
  const sign = up ? "+" : "−";
  return (
    <span className={`${DELTA_FACE} ${up ? "text-good" : "text-bad"} ${className}`}>
      {sign}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

export interface NoticeProps {
  tone?: StatusTone;
  /** Mono caps label above the text. Says what KIND of notice this is. */
  label?: ReactNode;
  children: ReactNode;
  className?: string;
}

// A hairline in the status hue with the text in paper. Not a tinted block:
// the -soft fills are retired, and a wash behind body text costs contrast for
// a signal the hairline already carries.
//
// 🔴 ONE NOTICE PER PANEL. A list of flags goes INSIDE one notice, capped at
// two lines with "+ n more". Four stacked notices is how a panel stops being
// read at all.
export function Notice({ tone = "error", label, children, className = "" }: NoticeProps) {
  return (
    <div className={`border p-4 text-text ${TONE_BORDER[tone]} ${className}`} role="note">
      {label && (
        <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-text-3">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
