import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { Status } from "./Status";

// A single figure with its label, an optional target bar, and one line of
// context. The tile the leadership and finance boards are made of.
//
// ⚖️ NO FRESHNESS HERE. It belongs in the panel head, once. See Panel.tsx.
//
// 🔴 "NO TARGET" AND "MISSING TARGET" ARE DIFFERENT STATES. A metric that was
// never meant to have a target renders without a bar and says nothing about
// it. A metric that SHOULD have one and does not shows "Not set" in muted text
// with the fix named in the context line ("Seed a row in leadership.targets").
// ⛔ Never amber: amber means the number is bad, and a missing target is a
// gap in configuration, not a bad result. Conflating them trains people to
// ignore amber.

export type KpiState =
  | { kind: "on-target" }
  | { kind: "below-target"; delta: number; suffix?: string }
  | { kind: "no-target" }
  | { kind: "missing-target"; fix: string }
  | { kind: "not-validated"; reason: string };

export interface KpiProps {
  /** Mono caps label. What the number is. */
  label: ReactNode;
  /**
   * The figure, already formatted. Formatting lives with the data, not here:
   * this component cannot know whether 0.42 is 42% or a ratio.
   */
  value: ReactNode;
  /** One line under the value. Context, not methodology. */
  context?: ReactNode;
  /** Actual and target, for the bar. Omit both for a tile with no bar. */
  actual?: number;
  target?: number;
  state?: KpiState;
  className?: string;
  /**
   * ⛔ SET BY `KpiRow as="dl"`, NOT BY HAND. The row clones its tiles with it
   * so there is one switch and no pair of props to keep in sync — a `<dt>`
   * outside a `<dl>` is invalid HTML that no browser and no linter complains
   * about, it simply stops being a term.
   */
  inList?: boolean;
}

export function Kpi({ label, value, context, actual, target, state, className = "", inList = false }: KpiProps) {
  const resolved: KpiState = state ?? (target === undefined ? { kind: "no-target" } : { kind: "on-target" });
  const missing = resolved.kind === "missing-target";
  const showBar = !missing && actual !== undefined && target !== undefined && target > 0;
  // Inside a `<dl>` the label is the TERM and the figure is its DEFINITION, so
  // a screen reader pairs them instead of reading two unrelated strings. The
  // elements change; nothing about the look does.
  const Label = inList ? "dt" : "span";
  const Value = inList ? "dd" : "div";

  return (
    <div className={`min-w-0 p-[var(--density-panel-pad)] ${className}`}>
      <div className="flex items-baseline gap-2">
        <Label className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-3">{label}</Label>
        {resolved.kind === "not-validated" && (
          <Status tone="warning" className="font-mono text-[10px] uppercase tracking-[0.14em]">
            Unvalidated
          </Status>
        )}
      </div>

      <Value
        className={`mt-3 mb-2 font-[family-name:var(--brand-display)] text-[36px] leading-none tracking-[-0.02em] tabular-nums ${
          missing ? "text-text-3" : "text-text"
        }`}
      >
        {missing ? "Not set" : value}
      </Value>

      {showBar && <TargetBar actual={actual} target={target} below={resolved.kind === "below-target"} />}

      {(context || resolved.kind === "below-target" || missing || resolved.kind === "not-validated") && (
        <div className="mt-2 flex flex-wrap items-baseline gap-2 text-[13px] text-text-3">
          {resolved.kind === "below-target" && (
            <span className="tabular-nums text-bad">
              {/* U+2212, not a hyphen: tabular columns stop aligning otherwise. */}
              −{Math.abs(resolved.delta)}
              {resolved.suffix ?? ""} to target
            </span>
          )}
          {missing && <span>{resolved.fix}</span>}
          {resolved.kind === "not-validated" && <span>{resolved.reason}</span>}
          {context && <span className="min-w-0">{context}</span>}
        </div>
      )}
    </div>
  );
}

// Fill to actual, a paper tick at target. Grey fill, because the bar is data;
// the accent is reserved for the one thing a panel singles out, and every tile
// having it would mean none of them do.
function TargetBar({ actual, target, below }: { actual: number; target: number; below: boolean }) {
  // Clamp so an overshoot fills the track rather than overflowing the panel,
  // and so a negative actual does not render a bar growing leftwards.
  const pct = Math.max(0, Math.min(100, (actual / target) * 100));
  // The tick sits at the target, which is 100% of the track by definition.
  // Kept as a named constant so the intent survives someone rescaling the bar.
  const tickPct = 100;

  return (
    <div className="relative h-1 w-full bg-surface-3" role="presentation">
      <div
        className={`absolute inset-y-0 left-0 ${below ? "bg-bad" : "bg-text-3"}`}
        style={{ width: `${pct}%` }}
      />
      <div className="absolute inset-y-[-2px] w-px bg-text" style={{ left: `${tickPct}%` }} />
    </div>
  );
}

// KPIs as their own surfaces on the field, separated by --panel-gap. Same rule
// as PanelGrid since v3.0.0: the AIR is the separator, not a 1px divider.
// Each tile carries the panel tone, so a row of four reads as four objects on
// the near-black rather than one strip cut into quarters.
export function KpiRow({
  children,
  className = "",
  as = "div",
}: {
  children?: ReactNode;
  className?: string;
  /**
   * `"dl"` makes the row a definition list: each tile's label becomes its
   * `<dt>` and its figure the `<dd>`.
   *
   * ⚖️ A ROW OF KPI TILES IS A DEFINITION LIST — a term and the figure that
   * defines it, four times over. Rendered as divs it is four labels and four
   * numbers in reading order and nothing says which belongs to which; a
   * screen reader user counts. It is not the default because the markup only
   * pays for itself when the tiles ARE label-and-figure pairs, and some rows
   * carry a bar and two lines of context as well.
   *
   * ⛔ Nothing about the look changes. This is semantics, not style.
   */
  as?: "div" | "dl";
}) {
  const Tag = as;
  // 🔴 CLONED, NOT CONTEXT. Kpi is a SERVER-SAFE component — no hooks, no
  // "use client" — and `createContext` is a client-only API: a server
  // component importing a module that calls it dies at page-data collection
  // with "createContext is not a function", which is how v3.2.0 broke
  // cgsi-auth's build. Cloning keeps the one-switch property without putting
  // a hook in a component that does not need one.
  const tiles =
    as === "dl"
      ? Children.map(children, (child) =>
          isValidElement<KpiProps>(child) ? cloneElement(child, { inList: true }) : child,
        )
      : children;
  return (
    <Tag
      className={`grid grid-cols-1 gap-[var(--panel-gap)] sm:grid-cols-2 lg:grid-cols-4 [&>*]:bg-surface ${className}`}
    >
      {tiles}
    </Tag>
  );
}
