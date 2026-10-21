import type { ReactNode } from "react";

// The estate's table. Replaces 22 hand-built ones.
//
// 🔴 TWO RULE WEIGHTS, AND NO MORE. A strong hairline under the header and
// above the total; a subtle one between rows. ⛔ No zebra striping and no
// vertical lines: both add ink that carries no information, and on a dense
// board they compete with the one row a panel is actually about.
//
// 🔴 ROWS NEVER WRAP. Fixed height from the density setting. A long value
// truncates with its full text in the title attribute. A wrapping row breaks
// the scan down the number column, which is the only reason the table is a
// table.
//
// ⚖️ UNITS LIVE IN THE HEADER. "Revenue (AUD)", not "$1,200" in forty cells.
//
// ⚖️ GREEN IS NOT DATA. Inline bars are grey. The accent marks the one row a
// rule singles out, and which row that is must be written in the panel's spec
// rather than decided per render — see `marked` below.

export interface LedgerColumn<T> {
  key: string;
  /** Mono caps, 10px. Put units here: "Revenue (AUD)". */
  header: ReactNode;
  /**
   * Grouped header above this column: "Count" / "Rate from lead".
   * Columns sharing a group must be adjacent, and the group spans them.
   * Use this instead of arrow-prefixed column names ("→ Rate").
   */
  group?: string;
  cell: (row: T) => ReactNode;
  /** Numbers right, text left. Defaults to left. */
  align?: "left" | "right";
  /** Fixed px width, or omit to let the column size to content. */
  width?: number;
  sortable?: boolean;
  /** Plain text for the title attribute when the cell may truncate. */
  titleOf?: (row: T) => string | undefined;
}

export interface LedgerRow {
  /** Stable identity. Index is not identity once the table can sort. */
  key: string;
  /** Selected: accent tint plus a 3px rule inside the left edge. */
  selected?: boolean;
  /**
   * The one row the panel's written rule singles out. ⚖️ This is a rule, not
   * a judgement call per render — "the current period", "the region we are
   * reporting on". If two rows are marked the accent has stopped meaning
   * anything.
   */
  marked?: boolean;
  /** Closed records dim as a whole, rather than striking through every field. */
  closed?: boolean;
}

export type SortDirection = "asc" | "desc";

export interface LedgerProps<T extends LedgerRow> {
  columns: LedgerColumn<T>[];
  rows: T[];
  caption?: string;
  sort?: { key: string; direction: SortDirection };
  onSort?: (key: string) => void;
  /** Strong rule above, label "Total". Cells keyed by column. */
  total?: { label?: ReactNode; cells: Record<string, ReactNode> };
  /** Skeleton bars in the row slots, at the same row height. */
  loading?: boolean;
  /** Rows to draw while loading. Match the usual page size, not 3. */
  loadingRows?: number;
  /**
   * Empty state. Two lines: what is empty, and what to change. "No results"
   * alone leaves the reader with nowhere to go.
   */
  empty?: { what: string; fix: string };
  /**
   * Sticky first column with horizontal scroll INSIDE the panel.
   * 🔴 Never let the page scroll sideways — the side gutter is the one thing
   * holding a dense board together at phone width.
   */
  wide?: boolean;
  className?: string;
}

const SORT_GLYPH: Record<SortDirection | "none", string> = {
  none: "↕",
  asc: "↑",
  desc: "↓",
};

export function Ledger<T extends LedgerRow>({
  columns,
  rows,
  caption,
  sort,
  onSort,
  total,
  loading = false,
  loadingRows = 8,
  empty,
  wide = false,
  className = "",
}: LedgerProps<T>) {
  const groups = headerGroups(columns);
  const showEmpty = !loading && rows.length === 0;

  return (
    <div className={wide ? "min-w-0 overflow-x-auto" : "min-w-0"}>
      <table className={`w-full border-collapse tabular-nums ${className}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          {groups && (
            <tr>
              {groups.map((g, i) =>
                g.label ? (
                  <th
                    key={`${g.label}-${i}`}
                    colSpan={g.span}
                    scope="colgroup"
                    className="border-b border-border px-4 pb-1 pt-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-text-3"
                  >
                    {g.label}
                  </th>
                ) : (
                  <th key={`spacer-${i}`} colSpan={g.span} className="border-b border-border" />
                ),
              )}
            </tr>
          )}
          <tr>
            {columns.map((c, i) => {
              const active = sort?.key === c.key;
              const glyph = active ? SORT_GLYPH[sort.direction] : SORT_GLYPH.none;
              const sticky = wide && i === 0;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                  style={c.width ? { width: c.width } : undefined}
                  className={[
                    "whitespace-nowrap border-b border-border-strong px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
                    c.align === "right" ? "text-right" : "text-left",
                    active ? "text-text" : "text-text-3",
                    sticky ? "sticky left-0 z-10 bg-surface" : "",
                  ].join(" ")}
                >
                  {c.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.key)}
                      className="inline-flex items-baseline gap-1 uppercase tracking-[0.14em] hover:text-accent"
                    >
                      {c.header}
                      <span aria-hidden>{glyph}</span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading &&
            Array.from({ length: loadingRows }, (_, r) => (
              <tr key={`skeleton-${r}`} style={{ height: "var(--density-row)" }}>
                {columns.map((c) => (
                  <td key={c.key} className="border-b border-border px-4">
                    {/* Same row height as a real row, so nothing jumps when
                        the data lands. */}
                    <span className="block h-2 w-full max-w-[8rem] bg-surface-3" aria-hidden />
                  </td>
                ))}
              </tr>
            ))}

          {showEmpty && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-left">
                <span className="block text-text-2">{empty?.what ?? "Nothing to show."}</span>
                <span className="block text-[13px] text-text-3">
                  {empty?.fix ?? "Change the filters above."}
                </span>
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row) => (
              <tr
                key={row.key}
                aria-selected={row.selected || undefined}
                style={{ height: "var(--density-row)" }}
                className={[
                  "border-b border-border",
                  row.closed ? "opacity-55" : "",
                  row.selected
                    ? "bg-[var(--color-accent-tint)] shadow-[inset_3px_0_0_var(--color-accent-mark)]"
                    : "hover:bg-[rgba(233,230,223,0.04)]",
                ].join(" ")}
              >
                {columns.map((c, i) => {
                  const sticky = wide && i === 0;
                  return (
                    <td
                      key={c.key}
                      title={c.titleOf?.(row)}
                      className={[
                        "overflow-hidden text-ellipsis whitespace-nowrap px-4 text-[length:var(--density-body)]",
                        c.align === "right" ? "text-right" : "text-left",
                        row.marked ? "text-text" : "text-text-2",
                        sticky ? "sticky left-0 z-10 bg-surface" : "",
                      ].join(" ")}
                    >
                      {c.cell(row)}
                    </td>
                  );
                })}
              </tr>
            ))}
        </tbody>

        {total && !loading && rows.length > 0 && (
          <tfoot>
            <tr style={{ height: "var(--density-row)" }}>
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={[
                    "whitespace-nowrap border-t border-border-strong px-4 text-[length:var(--density-body)] font-medium text-text",
                    c.align === "right" ? "text-right" : "text-left",
                    wide && i === 0 ? "sticky left-0 z-10 bg-surface" : "",
                  ].join(" ")}
                >
                  {i === 0 ? (total.label ?? "Total") : total.cells[c.key]}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// An inline bar in a cell. Grey, because a bar in a table is data and the
// accent is spoken for. Width is a share of the column's own maximum, so bars
// in one column compare with each other and not across columns.
export function LedgerBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span className="inline-block h-1 w-full min-w-8 bg-surface-3 align-middle" aria-hidden>
      <span className="block h-full bg-text-3" style={{ width: `${pct}%` }} />
    </span>
  );
}

// Collapse adjacent columns sharing a `group` into header spans. Returns null
// when no column declares one, so the grouped header row is not rendered at
// all rather than rendered empty.
export function headerGroups<T>(
  columns: LedgerColumn<T>[],
): { label: string | undefined; span: number }[] | null {
  if (!columns.some((c) => c.group)) return null;
  const out: { label: string | undefined; span: number }[] = [];
  for (const c of columns) {
    const last = out[out.length - 1];
    if (last && last.label === c.group) last.span += 1;
    else out.push({ label: c.group, span: 1 });
  }
  return out;
}
