import type { ReactNode } from "react";

// The container every data surface sits in. Surface tone, 1px hairline, square
// corners, no shadow.
//
// 🔴 NEVER A CARD INSIDE A CARD. Panels sit in a hairline grid with NO gap —
// the 1px border between two panels is the separator, so there is no gap value
// to drift. That is why this component takes no margin and no spacing prop:
// the parent grid owns the arrangement, and a panel that spaced itself would
// break the shared rule the moment two apps chose differently.
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
      className={`min-w-0 border border-border bg-surface ${className}`}
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

// A hairline grid of panels with no gap between them. The shared border IS the
// separator; `-space-x/-y` collapses the doubled 1px so two adjacent panels
// read as one rule rather than two.
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
    <div className={`grid ${cols} [&>*]:-mb-px [&>*]:-mr-px ${className}`}>
      {children}
    </div>
  );
}
