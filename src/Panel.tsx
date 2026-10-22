import type { ReactNode } from "react";

// The container every data surface sits in. Surface tone, square corners, no
// shadow, and — since v3.0.0 — no outer border: it is separated by AIR on a
// near-black field, not by a hairline.
//
// ⚖️ SPACE, NOT TONE. The gapless hairline grid stood until 22 Oct 2026 and
// this reverses it. It came from a design canvas with a card floating in a
// near-black field: sampled, that pair was #141919 on #0d1110, a separation
// of 1.071:1, against our own 1.088:1. The thing that read better had LESS
// tonal separation than what we had, so the colours were never what was doing
// the work — the margin was. Shifting the tokens without the air was mocked
// and changes almost nothing.
//
// 🔴 NEVER A CARD INSIDE A CARD, still. The panel takes no margin and no
// spacing prop: the parent grid owns the arrangement through --panel-gap, so
// there is still exactly one value and it still cannot drift per app. That
// was the real argument for the gapless grid and it survives intact.
//
// ⚖️ FRESHNESS BELONGS IN THE HEAD, NOT ON EVERY TILE. One "Updated 11:30 ·
// HubSpot" per panel, right-aligned in the head. Repeating it on each KPI
// inside the panel is how a dashboard ends up with eight timestamps saying the
// same thing, and it makes the one that IS stale impossible to spot.
//
// ⚖️ METHODOLOGY GOES BEHIND A LINK. Not paragraphs in the panel body. The
// `howCounted` prop renders "How it's counted" in the head; the body is for
// the numbers.

export interface PanelProps {
  /** Panel title. Stack Sans Notch 22, sentence case, no full stop. */
  title?: ReactNode;
  /**
   * Freshness, in the head, mono caps: "Updated 11:30 · HubSpot".
   * Name the source. "Updated 11:30" alone cannot be checked by anybody.
   */
  freshness?: ReactNode;
  /** Href for the "How it's counted" link. Methodology never sits in the body. */
  howCounted?: string;
  /** Right-hand controls in the head: a segmented control, a filter reset. */
  actions?: ReactNode;
  children?: ReactNode;
  /** Drop the body padding — for a panel whose whole body is a ledger. */
  flush?: boolean;
  className?: string;
  id?: string;
}

export function Panel({
  title,
  freshness,
  howCounted,
  actions,
  children,
  flush = false,
  className = "",
  id,
}: PanelProps) {
  const hasHead = Boolean(title || freshness || howCounted || actions);

  return (
    <section
      id={id}
      className={`min-w-0 bg-surface ${className}`}
    >
      {hasHead && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-strong px-[var(--density-panel-pad)] py-4">
          <div className="flex min-w-0 flex-wrap items-baseline gap-3">
            {title && (
              <h3 className="m-0 min-w-0 font-[family-name:var(--brand-display)] text-[22px] leading-none tracking-[-0.02em] text-text">
                {title}
              </h3>
            )}
            {howCounted && (
              <a
                href={howCounted}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-3 underline underline-offset-2 hover:text-accent"
              >
                How it&apos;s counted
              </a>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline gap-3">
            {freshness && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-3">
                {freshness}
              </span>
            )}
            {actions}
          </div>
        </div>
      )}
      <div className={flush ? "min-w-0" : "min-w-0 p-[var(--density-panel-pad)]"}>{children}</div>
    </section>
  );
}

// A grid of panels separated by --panel-gap of the near-black field. The AIR
// is the separator. Before v3.0.0 this collapsed the doubled 1px border with
// negative margins so two adjacent panels read as one rule; there is no border
// to collapse now, so the negative margins are gone with it.
export function PanelGrid({
  columns = 2,
  children,
  className = "",
}: {
  columns?: 1 | 2 | 3 | 4;
  children?: ReactNode;
  className?: string;
}) {
  // Written out rather than interpolated: Tailwind scans source text, and
  // `grid-cols-${columns}` is invisible to it.
  const cols = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return (
    <div className={`grid gap-[var(--panel-gap)] ${cols} ${className}`}>
      {children}
    </div>
  );
}
