import type { ReactNode } from "react";
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
}

export function Kpi({ label, value, context, actual, target, state, className = "" }: KpiProps) {
  const resolved: KpiState = state ?? (target === undefined ? { kind: "no-target" } : { kind: "on-target" });
  const missing = resolved.kind === "missing-target";
  const showBar = !missing && actual !== undefined && target !== undefined && target > 0;

  return (
    <div className={`min-w-0 p-[var(--density-panel-pad)] ${className}`}>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-3">{label}</span>
        {resolved.kind === "not-validated" && (
          <Status tone="warning" className="font-mono text-[10px] uppercase tracking-[0.14em]">
            Unvalidated
          </Status>
        )}
      </div>

      <div
        className={`mt-3 mb-2 font-[family-name:var(--brand-display)] text-[36px] leading-none tracking-[-0.02em] tabular-nums ${
          missing ? "text-text-3" : "text-text"
        }`}
      >
        {missing ? "Not set" : value}
      </div>

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
export function KpiRow({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={`grid grid-cols-1 gap-[var(--panel-gap)] sm:grid-cols-2 lg:grid-cols-4 [&>*]:bg-surface ${className}`}
    >
      {children}
    </div>
  );
}
