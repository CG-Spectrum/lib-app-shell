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
//
// 🔴 NO "use client", NO HOOK, NO createContext IN THIS FILE, EVER.
//
// `Ledger` is one of the seven parts a server page renders directly. v3.2.0
// put a `createContext` in `Kpi` and every server component importing it died
// at page-data collection with "(0 , f.createContext) is not a function" — and
// it passed this package's CI, because a library never runs a Next build.
// `ledger.test.ts` reads this file's source and asserts all three, the way
// `kpi-definition-list.test.tsx` does, because no behavioural test can catch it.
//
// ⚖️ AN onClick IS NOT A CLIENT BOUNDARY, and it does not need its own file.
// `sort`'s header button has had an inline `onClick={() => onSort(c.key)}` in
// this server-safe file since the part shipped, and it is correct: a function
// prop can only arrive here from a CLIENT caller, which means the module is
// already in the client bundle by the time the handler exists. A server-rendered
// `Ledger` with an `onSort` is impossible to construct in the first place — the
// RSC serialisation boundary refuses the prop. `expand.onToggle` is the same
// prop with a different name, so the toggle button follows the same pattern
// rather than being split into a `"use client"` component of its own. Splitting
// it would have put the package's two interactive affordances in two different
// shapes for no gain, and a reader would have to learn both.

/**
 * A column.
 *
 * `K` is the column-key union. ⚖️ It DEFAULTS TO `string`, so a caller who
 * writes `LedgerColumn<Row>[]` gets exactly what they had before. A caller
 * whose keys are a union — a model built `as const`, or a key type the app
 * already owns — gets `K` inferred from the array and then `sort.key`,
 * `onSort` and `total.cells` are checked against it instead of being three
 * more places to mistype a column name.
 */
export interface LedgerColumn<T, K extends string = string> {
  key: K;
  /** Mono caps, 10px. Put units here: "Revenue (AUD)". */
  header: ReactNode;
  /**
   * Grouped header above this column: "Count" / "Rate from lead".
   * Columns sharing a group must be adjacent, and the group spans them.
   * Use this instead of arrow-prefixed column names ("→ Rate").
   */
  group?: string;
  cell: (row: T) => ReactNode;
  /** Numbers right, text left. Defaults to left. Right ALSO means mono. */
  align?: "left" | "right";
  /**
   * Force the mono data treatment on a LEFT-aligned column: a code, an id, a
   * reference — `2026-T3` is data, not a word. Right-aligned columns get it
   * already, so this is only for the ones that read left.
   * ⛔ Not for a name or a title. Those are prose and stay in the body face.
   */
  mono?: boolean;
  /** Fixed px width, or omit to let the column size to content. */
  width?: number;
  sortable?: boolean;
  /** Plain text for the title attribute when the cell may truncate. */
  titleOf?: (row: T) => string | undefined;
  /**
   * Render this column's cell as `<th scope="row">` rather than `<td>`.
   *
   * ⚖️ AT MOST ONE COLUMN, and it is the one that NAMES the row — the prompt,
   * the campaign, the page. A screen reader then announces that name with
   * every figure in the row, so "72%" is heard as "Mention us, 72%, Does
   * Unreal have a good animation pipeline" instead of "72%" alone. Without it
   * a dense numeric row is unreadable without counting columns.
   *
   * ⛔ Not a style. It changes nothing visually; the header treatment stays
   * with `<thead>`. Setting it on a numeric column is wrong — a quantity does
   * not identify a row.
   *
   * ⚠️ IT IS ALSO WHAT `wide` PINS. This column does not have to be first, and
   * when it is not, the columns BEFORE it scroll underneath it. That is
   * correct and it is the caller's own declaration: a column that is not the
   * one naming the row is, by definition, less identifying than the one that
   * is. If a column to its left must stay visible too, move it to the right of
   * the row header rather than reaching for a second pin.
   */
  rowHeader?: boolean;
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

/**
 * Row expansion: a row OPENS INTO a detail panel spanning the table.
 *
 * ⚖️ WHAT IT IS FOR. One record whose detail does not fit on a line and does
 * not belong in a column — a trend chart for the row, the diff behind an audit
 * entry, the payload of a request. The panel is CONTENT, so it sits outside the
 * density rung: data rows stay one line (the whole reason the table is a
 * table), and the panel takes the panel padding from the density pair.
 *
 * ⛔ WHAT IT IS NOT FOR.
 * - **Child rows sharing the columns.** A parent with children that line up in
 *   the same number columns is a different design and does not exist yet; the
 *   panel is free-form content, not a nested `<tbody>`.
 * - **In-cell disclosure.** A `<details>` inside ONE cell is a separate gap.
 * - **A per-row action menu.** A popover is not a panel; every body cell is
 *   `overflow-hidden`, and a menu that pushes the table open is not a menu.
 *
 * ⚖️ CONTROLLED ONLY, and there is no uncontrolled variant coming. Internal
 * open state would need a hook, and `Ledger` is one of the seven parts a server
 * page renders directly — v3.2.0 shipped a `createContext` into one of them and
 * broke every server component that imported it. It is also the honest shape:
 * which rows are open is a property of the screen, not of the table. The caller
 * already owns it — it survives a sort, it belongs in the URL, and "expand all"
 * is a line of the caller's code rather than an imperative handle on a ref.
 */
export interface LedgerExpand<T> {
  /** The row keys currently open. The caller owns this. */
  expanded: ReadonlySet<string>;
  /**
   * ⚖️ THIS KEY IS THE ROW'S, NOT A COLUMN'S, so it is `string` and stays
   * `string` while `onSort` is generic. `LedgerRow.key` is declared `string`
   * and rows are not generic in this part; narrowing the callback without
   * narrowing `expanded` and `LedgerRow.key` with it would be a type that
   * promises something the set beside it cannot keep.
   */
  onToggle: (key: string) => void;
  /**
   * The panel's contents. ⚖️ Returning `null` means THIS ROW HAS NOTHING TO
   * OPEN: no toggle is drawn for it, rather than a button that opens an empty
   * panel. Called once per row per render to decide that, so keep it cheap —
   * build the data in the caller and read it here.
   */
  render: (row: T) => ReactNode;
  /**
   * The button's sr-only text. Defaults to "Show details for <the row's name>",
   * taken from the row-header column's `titleOf`, else its cell when that cell
   * is plain text, else the row key. ⚖️ It does not change when the row opens:
   * `aria-expanded` carries the state, and a label that flips between "Show"
   * and "Hide" says it twice.
   */
  label?: (row: T) => string;
}

/**
 * `T` is the row. `K` is the column-key union, inferred from `columns` and
 * defaulting to `string` — see `LedgerColumn`.
 */
export interface LedgerProps<T extends LedgerRow, K extends string = string> {
  columns: LedgerColumn<T, K>[];
  rows: T[];
  caption?: string;
  sort?: { key: K; direction: SortDirection };
  onSort?: (key: K) => void;
  /**
   * Strong rule above, label "Total". Cells keyed by column.
   *
   * ⚖️ `Partial`, because most tables total some columns and not others — a
   * name column has no total and a rate rarely has an honest one. It is the
   * KEYS that are checked: a cell keyed to a column this table does not have
   * is a figure that renders nowhere, which is the quiet version of a wrong
   * total.
   */
  total?: { label?: ReactNode; cells: Partial<Record<K, ReactNode>> };
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
   * Horizontal scroll INSIDE the panel, with the row's NAME pinned.
   * 🔴 Never let the page scroll sideways — the side gutter is the one thing
   * holding a dense board together at phone width.
   *
   * ⚖️ WHAT GETS PINNED is the `rowHeader` column, wherever it sits — plus the
   * toggle column at `left: 0` when `expand` is set, with the row header
   * immediately after it. With no `rowHeader` column declared, the first
   * column is pinned, as before.
   *
   * ⚠️ Columns to the LEFT of the row header scroll underneath it. See
   * `LedgerColumn.rowHeader`.
   */
  wide?: boolean;
  /** Row expansion. See LedgerExpand. Controlled only. */
  expand?: LedgerExpand<T>;
  className?: string;
}

const SORT_GLYPH: Record<SortDirection | "none", string> = {
  none: "↕",
  asc: "↑",
  desc: "↓",
};

// The disclosure pair, in the same vocabulary as the sort arrows: text glyphs
// in the surrounding face. ⛔ No icon library, no rounded chevron in a circle.
// The mark rotates between the two states and the two states are the only
// states there are.
const EXPAND_GLYPH = { closed: "▸", open: "▾" } as const;

/**
 * The toggle column's width. 32px from the spacing scale — wide enough for the
 * glyph and its pointer target, narrow enough that it does not read as a
 * column of data. It is NOT part of `columns`: not sortable, not in `total`,
 * never the row header.
 */
export const EXPAND_COLUMN_WIDTH = 32;

/**
 * The id the panel row carries and the button points at with `aria-controls`.
 * ⚠️ Derived from the row key, so two Ledgers on one page whose rows share keys
 * would share ids. Give one of them distinct keys; this is the same constraint
 * `key` already carries.
 */
export function detailPanelId(rowKey: string): string {
  return `ledger-detail-${rowKey.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

/**
 * The toggle's sr-only text when the caller supplies no `label`.
 *
 * ⚖️ A bare "Show details" repeated down a column of forty rows is forty
 * identical buttons to anyone listing the controls on the page. The row's NAME
 * is the thing that tells them apart, and the row-header column is where that
 * name already lives.
 */
export function expandLabel<T extends LedgerRow, K extends string = string>(
  columns: LedgerColumn<T, K>[],
  row: T,
): string {
  const named = columns.find(isRowHeader);
  const fromTitle = named?.titleOf?.(row);
  if (fromTitle) return `Show details for ${fromTitle}`;
  const cell = named?.cell(row);
  if (typeof cell === "string" && cell) return `Show details for ${cell}`;
  return `Show details for ${row.key}`;
}

export function Ledger<T extends LedgerRow, K extends string = string>({
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
  expand,
  className = "",
}: LedgerProps<T, K>) {
  const groups = headerGroups(columns);
  const showEmpty = !loading && rows.length === 0;
  // The toggle column is not in `columns`, so every colSpan and every skeleton
  // row has to count it separately. One name for it, used everywhere.
  const allColumns = columns.length + (expand ? 1 : 0);

  // 🔴 WHICH COLUMN `wide` PINS.
  //
  // `wide` exists so the row's NAME stays beside the figures while the figures
  // scroll. So it pins the column that NAMES the row — the one the caller
  // declared `rowHeader` — wherever that column sits in the model.
  //
  // ⛔ It is NOT index 0. Until v3.4.1 it was, and the two defects that came of
  // it are the same defect: governance's registers pinned a 56px ordinal, and
  // scheduling's FindingsTable would have pinned a column of repeated category
  // words with its naming column fifth (worked around by reordering the model —
  // a layout decision forced by a pinning bug). A pinned column that identifies
  // nothing costs the reader the width AND the name at once.
  //
  // ⚖️ COLUMNS BEFORE THE ROW HEADER SCROLL UNDERNEATH IT. That is the caller's
  // own declaration read back to them: they named one column as the one that
  // identifies the row, so every other column — left or right of it — is less
  // identifying than that one. Pinning the run from 0 to the row header would
  // pin an arbitrary number of columns decided by model order rather than by
  // anybody's intent.
  //
  // With no `rowHeader` column, index 0 is pinned, exactly as before — a test
  // pins that, so no existing caller changes.
  //
  // The toggle column, when there is one, pins at 0 and the row header follows
  // at 32: pinning only the toggle would pin a strip of chevrons, and pinning
  // only the name would scroll the control out from under its own row, so a
  // reader scrolled right could not close the panel they opened.
  const namedIndex = columns.findIndex(isRowHeader);
  const pinnedIndex = namedIndex === -1 ? 0 : namedIndex;
  const stickyLeft = (dataColumn: boolean) =>
    dataColumn && expand ? EXPAND_COLUMN_WIDTH : 0;

  return (
    <div className={wide ? "min-w-0 overflow-x-auto" : "min-w-0"}>
      <table className={`w-full border-collapse tabular-nums ${className}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          {groups && (
            <tr>
              {expand && (
                <th
                  aria-hidden
                  style={{ width: EXPAND_COLUMN_WIDTH }}
                  className="border-b border-border"
                />
              )}
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
            {expand && (
              <th
                scope="col"
                style={{
                  width: EXPAND_COLUMN_WIDTH,
                  ...(wide ? { left: stickyLeft(false) } : null),
                }}
                className={[
                  "border-b border-border-strong py-3",
                  wide ? "sticky z-10 bg-surface" : "",
                ].join(" ")}
              >
                {/* An unnamed column full of buttons is announced as an
                    unnamed column full of buttons. The cell stays in flow so
                    the header hairline runs unbroken; only its text is
                    sr-only. */}
                <span className="sr-only">Details</span>
              </th>
            )}
            {columns.map((c, i) => {
              const active = sort?.key === c.key;
              const glyph = active ? SORT_GLYPH[sort.direction] : SORT_GLYPH.none;
              const sticky = wide && i === pinnedIndex;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                  style={{
                    ...(c.width ? { width: c.width } : null),
                    ...(sticky ? { left: stickyLeft(true) } : null),
                  }}
                  className={[
                    "whitespace-nowrap border-b border-border-strong px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
                    c.align === "right" ? "text-right" : "text-left",
                    active ? "text-text" : "text-text-3",
                    sticky ? "sticky z-10 bg-surface" : "",
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
                {/* No skeleton bar in the toggle cell: a 32px chrome column is
                    not data arriving, and a bar there would promise a control
                    that may never be drawn (a row whose panel is null has no
                    toggle). */}
                {expand && (
                  <td
                    className="border-b border-border"
                    style={{ width: EXPAND_COLUMN_WIDTH }}
                  />
                )}
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
              <td colSpan={allColumns} className="px-4 py-6 text-left">
                <span className="block text-text-2">{empty?.what ?? "Nothing to show."}</span>
                <span className="block text-[13px] text-text-3">
                  {empty?.fix ?? "Change the filters above."}
                </span>
              </td>
            </tr>
          )}

          {!loading &&
            rows.flatMap((row) => {
              // `render` decides whether this row has anything to open, so it
              // is called once and the result is reused by the panel. A row
              // that returns null gets an empty cell, not a dead button.
              const panel = expand ? expand.render(row) : null;
              const hasPanel = panel !== null && panel !== undefined && panel !== false;
              const open = Boolean(expand && expand.expanded.has(row.key));
              const panelId = detailPanelId(row.key);

              // ⛔ THE DATA ROW IS NOT RESTYLED WHEN IT OPENS. `selected`,
              // `marked` and `closed` are claims about the RECORD; "open" is a
              // claim about the reader's screen. Dressing the row would spend
              // the accent — or the one remaining weight — on the one thing
              // `aria-expanded` and the glyph already say twice.
              const dataRow = (
              <tr
                key={row.key}
                aria-selected={row.selected || undefined}
                style={{ height: "var(--density-row)" }}
                className={[
                  "border-b border-border",
                  row.closed ? "opacity-55" : "",
                  // 🔴 THE HOVER WASH DREW NOTHING IN LIGHT MODE. It was
                  // `rgba(233,230,223,0.04)` — #e9e6df is --color-text's DARK
                  // value, so the wash was the dark theme's ink at 4%, frozen
                  // as a literal. On light it painted near-white at 4% over
                  // the #ffffff panel: the estate's table had no row hover at
                  // all for anyone in light, in every app. Same defect as
                  // people's globals.css:54, and the reason raw-rgb exists.
                  //
                  // The row sits on --color-surface (the sticky first column
                  // under `wide` repaints it, below), so the hover is the next
                  // step of the ramp: --color-surface-2, which is a step UP in
                  // dark and a step DOWN in light and visible in both. A token
                  // with the meaning, not a mix with the value.
                  row.selected
                    ? "bg-[var(--color-accent-tint)] shadow-[inset_3px_0_0_var(--color-accent-mark)]"
                    : "hover:bg-surface-2",
                ].join(" ")}
              >
                {expand && (
                  <td
                    style={{
                      width: EXPAND_COLUMN_WIDTH,
                      ...(wide ? { left: stickyLeft(false) } : null),
                    }}
                    className={[
                      "border-b border-border p-0 text-center",
                      wide ? "sticky z-10 bg-surface" : "",
                    ].join(" ")}
                  >
                    {hasPanel && (
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => expand.onToggle(row.key)}
                        className="inline-flex h-full w-full items-center justify-center text-text-3 hover:text-accent"
                      >
                        <span aria-hidden>
                          {open ? EXPAND_GLYPH.open : EXPAND_GLYPH.closed}
                        </span>
                        <span className="sr-only">
                          {expand.label ? expand.label(row) : expandLabel(columns, row)}
                        </span>
                      </button>
                    )}
                  </td>
                )}
                {columns.map((c, i) => {
                  const sticky = wide && i === pinnedIndex;
                  // A row header is a <th>, not a styled <td>: same classes,
                  // different element, so the name travels with every figure
                  // in the row for anyone not reading by eye.
                  const asHeader = isRowHeader(c);
                  const Cell = asHeader ? "th" : "td";
                  return (
                    <Cell
                      key={c.key}
                      scope={asHeader ? "row" : undefined}
                      title={c.titleOf?.(row)}
                      style={sticky ? { left: stickyLeft(true) } : undefined}
                      className={[
                        "overflow-hidden text-ellipsis whitespace-nowrap px-4 font-normal",
                        isMonoColumn(c)
                          ? "font-mono text-[length:var(--density-data)] font-medium"
                          : "text-[length:var(--density-body)]",
                        c.align === "right" ? "text-right" : "text-left",
                        row.marked ? "text-text" : "text-text-2",
                        sticky ? "sticky z-10 bg-surface" : "",
                      ].join(" ")}
                    >
                      {c.cell(row)}
                    </Cell>
                  );
                })}
              </tr>
              );

              if (!open || !hasPanel) return [dataRow];

              // The panel is its own row, immediately after the row it belongs
              // to, and rendered only when open — never hidden in the DOM,
              // because a screen reader walking the table would otherwise read
              // every closed panel in it.
              //
              // ⚖️ IT SITS OUTSIDE THE DENSITY RUNG. No --density-row height:
              // the rung is the promise that DATA rows are one line, and this
              // is not a data row. It takes the panel padding from the same
              // density pair instead, which is what every other block of
              // content in the app layer takes.
              //
              // --color-surface-2 as ground and a hairline each side, so it
              // reads as inset under its row rather than as another record.
              // ⛔ No zebra below it and no tint that says anything: the fill
              // IS the information here — "this block belongs to the row above
              // it" — which is the one thing a fill is allowed to carry.
              return [
                dataRow,
                <tr key={`${row.key}-detail`}>
                  <td
                    id={panelId}
                    colSpan={allColumns}
                    style={{ padding: "var(--density-panel-pad)" }}
                    className="border-b border-t border-border bg-surface-2 text-left text-[length:var(--density-body)] text-text-2"
                  >
                    {panel}
                  </td>
                </tr>,
              ];
            })}
        </tbody>

        {total && !loading && rows.length > 0 && (
          <tfoot>
            <tr style={{ height: "var(--density-row)" }}>
              {/* The total is not a record, so it has no toggle — but it still
                  needs the cell, or every figure in the foot shifts one column
                  left of the column it totals. */}
              {expand && (
                <td
                  style={{
                    width: EXPAND_COLUMN_WIDTH,
                    ...(wide ? { left: stickyLeft(false) } : null),
                  }}
                  className={[
                    "border-t border-border-strong",
                    wide ? "sticky z-10 bg-surface" : "",
                  ].join(" ")}
                />
              )}
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  style={wide && i === pinnedIndex ? { left: stickyLeft(true) } : undefined}
                  className={[
                    "whitespace-nowrap border-t border-border-strong px-4 font-medium text-text",
                    // The total row is the same data as the column above it,
                    // so it takes the same face. The label cell is a word.
                    //
                    // ⚖️ The label stays in column 0 while the PIN follows the
                    // row header. The two are different questions: "Total" is a
                    // word and belongs where the eye starts, and the pin is
                    // about which column must survive a scroll.
                    isMonoColumn(c) && i !== 0
                      ? "font-mono text-[length:var(--density-data)]"
                      : "text-[length:var(--density-body)]",
                    c.align === "right" ? "text-right" : "text-left",
                    wide && i === pinnedIndex ? "sticky z-10 bg-surface" : "",
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

/**
 * Does this column's data set in mono?
 *
 * ⚖️ Numbers and codes in a table are DATA, and data takes Plex Mono — the
 * same line the website draws, written into the app layer on 22 Oct 2026.
 * Right-alignment already means "this column holds numbers", so it is the
 * trigger and no caller had to change. `mono` opts in a left-reading code
 * column. The text columns beside them stay in the body face: the rule is
 * data versus prose, not short versus long.
 */
/**
 * Whether this column renders as `<th scope="row">`.
 *
 * ⛔ A RIGHT-ALIGNED COLUMN IS NEVER A ROW HEADER, whatever it asks for. Right
 * means numbers (see isMonoColumn), and a quantity does not identify a row —
 * "72%" announced as the header of its own row tells a screen-reader user
 * nothing and displaces the name that would have. The guard lives here rather
 * than in a doc comment because the doc comment is what was already there.
 */
export function isRowHeader<T, K extends string = string>(c: LedgerColumn<T, K>): boolean {
  return c.rowHeader === true && c.align !== "right";
}

export function isMonoColumn<T, K extends string = string>(column: LedgerColumn<T, K>): boolean {
  return column.align === "right" || column.mono === true;
}

// Collapse adjacent columns sharing a `group` into header spans. Returns null
// when no column declares one, so the grouped header row is not rendered at
// all rather than rendered empty.
export function headerGroups<T, K extends string = string>(
  columns: LedgerColumn<T, K>[],
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
