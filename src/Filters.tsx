"use client";
import type { ReactNode } from "react";
import {
  ALL,
  FILTER_LABEL_WIDTH,
  filterSummary,
  hasActiveFilters,
  isAllSelected,
  nextSelection,
  shouldCollapse,
  type ActiveDimension,
  type FilterOption,
} from "./filters-logic";

// The filter bar, and the segmented control that shares its box.
//
// ⚖️ THREE CONTROLS, THREE JOBS, NEVER SWAPPED.
//   Tabs (SubNav)  switch pages of a view.
//   Segmented      switches the PRESENTATION of one panel (Chart / Table / CSV).
//   Filters        change the DATA.
// A segmented control used to filter, or a filter row used to switch views,
// teaches people that the controls are interchangeable, and from then on they
// have to read every one before touching it.
//
// 🔴 DATE RANGES ARE NOT CHIPS. A range needs a range picker. Seven chips
// reading "Last 7 days / Last 30 / This term / Last term / YTD / ..." is a
// menu of somebody's guesses about which ranges matter.

export interface FilterDimension {
  key: string;
  /** Row label, in the fixed-width left column. */
  label: string;
  options: FilterOption[];
  selected: string[];
  multi?: boolean;
}

export interface FiltersProps {
  dimensions: FilterDimension[];
  onChange: (key: string, selected: string[]) => void;
  onReset?: () => void;
  className?: string;
}

export function Filters({ dimensions, onChange, onReset, className = "" }: FiltersProps) {
  const active: ActiveDimension[] = dimensions.map((d) => ({
    label: d.label,
    selected: d.options.filter((o) => d.selected.includes(o.value)).map((o) => o.label),
  }));
  const summary = filterSummary(active);

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex flex-col gap-2">
        {dimensions.map((d) => (
          <FilterRow key={d.key} dimension={d} onChange={onChange} />
        ))}
      </div>

      {summary && (
        <div className="mt-3 flex flex-wrap items-baseline gap-3 text-[13px] text-text-3">
          <span className="min-w-0">{summary}</span>
          {onReset && hasActiveFilters(active) && (
            <button type="button" onClick={onReset} className="text-accent hover:underline">
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  dimension,
  onChange,
}: {
  dimension: FilterDimension;
  onChange: (key: string, selected: string[]) => void;
}) {
  const { key, label, options, selected, multi = false } = dimension;
  const collapse = shouldCollapse(options.length);

  return (
    <div className="flex min-w-0 flex-wrap items-start gap-2 sm:flex-nowrap">
      <span
        className="shrink-0 pt-[7px] font-mono text-[10px] uppercase tracking-[0.14em] text-text-3"
        style={{ width: FILTER_LABEL_WIDTH }}
      >
        {label}
      </span>

      {collapse ? (
        <select
          aria-label={label}
          multiple={multi}
          value={multi ? selected : (selected[0] ?? ALL)}
          onChange={(e) => {
            const next = multi
              ? Array.from(e.target.selectedOptions, (o) => o.value).filter((v) => v !== ALL)
              : e.target.value === ALL
                ? []
                : [e.target.value];
            onChange(key, next);
          }}
          className="h-[30px] min-w-0 max-w-full border border-border bg-surface-2 px-2 text-[length:var(--density-body)] text-text"
        >
          <option value={ALL}>All</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.count === 0}>
              {o.label}
              {o.count !== undefined ? ` (${o.count})` : ""}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex min-w-0 flex-wrap gap-1">
          {/* All is always first, and selected when nothing else is. */}
          <FilterChip
            label="All"
            selected={isAllSelected(selected)}
            onClick={() => onChange(key, [])}
          />
          {options.map((o) => (
            <FilterChip
              key={o.value}
              label={o.label}
              count={o.count}
              selected={selected.includes(o.value)}
              /* Zero-count options stay VISIBLE and disabled, so the option
                 set never reshuffles under the cursor. */
              disabled={o.count === 0}
              onClick={() => onChange(key, nextSelection(selected, o.value, multi))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  selected,
  disabled = false,
  onClick,
}: {
  label: string;
  count?: number;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={[
        // Square, 30px (26 compact), the same box as the segmented control.
        "inline-flex h-[30px] items-center gap-1 whitespace-nowrap border px-2 text-[length:var(--density-body)] transition-colors",
        "[html[data-density='compact']_&]:h-[26px]",
        selected
          ? "border-accent bg-[var(--color-accent-tint)] text-text"
          : "border-border bg-surface-2 text-text-2 hover:border-border-strong",
        disabled ? "cursor-not-allowed opacity-40 hover:border-border" : "",
      ].join(" ")}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className="font-mono text-[10px] tabular-nums text-text-3">{count}</span>
      )}
    </button>
  );
}

export interface SegmentedProps<T extends string> {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  /** Names what is being switched, for screen readers: "Panel view". */
  label: string;
  className?: string;
}

// Switches how ONE panel presents itself. Selected is a paper fill with ink
// text — distinct from a selected filter chip (accent hairline plus tint) so
// the two cannot be mistaken for each other at a glance.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={`inline-flex min-w-0 border border-border ${className}`}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={[
              "h-[30px] whitespace-nowrap px-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
              "[html[data-density='compact']_&]:h-[26px]",
              i > 0 ? "border-l border-border" : "",
              selected ? "bg-text text-bg" : "bg-surface-2 text-text-3 hover:text-text",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
