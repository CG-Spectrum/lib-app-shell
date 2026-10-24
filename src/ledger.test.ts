import { describe, expect, it, test } from "vitest";
import { createElement as h } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EXPAND_COLUMN_WIDTH,
  Ledger,
  detailPanelId,
  expandLabel,
  headerGroups,
  isMonoColumn,
  isRowHeader,
  type LedgerColumn,
  type LedgerExpand,
  type LedgerProps,
} from "./Ledger";

type Row = { key: string };

function col(key: string, group?: string): LedgerColumn<Row> {
  return { key, header: key, group, cell: () => null };
}

describe("headerGroups", () => {
  test("no column declares a group → no grouped header row at all", () => {
    // Returning [] here would render an empty <tr> of borders. The distinction
    // between "no groups" and "groups that happen to be blank" is the whole
    // reason this returns null.
    expect(headerGroups([col("a"), col("b")])).toBeNull();
  });

  test("adjacent columns sharing a group collapse into one span", () => {
    const groups = headerGroups([
      col("count", "Count"),
      col("rate", "Count"),
      col("cac", "Cost"),
    ]);
    expect(groups).toEqual([
      { label: "Count", span: 2 },
      { label: "Cost", span: 1 },
    ]);
  });

  test("ungrouped columns become unlabelled spacers, keeping the header aligned", () => {
    const groups = headerGroups([col("region"), col("count", "Count"), col("rate", "Count")]);
    expect(groups).toEqual([
      { label: undefined, span: 1 },
      { label: "Count", span: 2 },
    ]);
  });

  test("the spans always total the column count, or the header stops lining up", () => {
    const columns = [
      col("region"),
      col("a", "Count"),
      col("b", "Count"),
      col("c", "Rate from lead"),
      col("d"),
    ];
    const groups = headerGroups(columns);
    const span = groups!.reduce((n, g) => n + g.span, 0);
    expect(span).toBe(columns.length);
  });

  test("a group repeating after an interruption does NOT merge across it", () => {
    // Merging non-adjacent columns would make colSpan claim cells that belong
    // to another group, shifting every header to the right of it.
    const groups = headerGroups([
      col("a", "Count"),
      col("b", "Rate"),
      col("c", "Count"),
    ]);
    expect(groups).toEqual([
      { label: "Count", span: 1 },
      { label: "Rate", span: 1 },
      { label: "Count", span: 1 },
    ]);
  });

  test("a single grouped column among many ungrouped still renders the row", () => {
    const groups = headerGroups([col("a"), col("b"), col("c", "Rate from lead")]);
    expect(groups).toEqual([
      { label: undefined, span: 2 },
      { label: "Rate from lead", span: 1 },
    ]);
  });
});

describe("isMonoColumn", () => {
  const c = (over: Partial<LedgerColumn<Row>>): LedgerColumn<Row> => ({
    key: "k",
    header: "K",
    cell: () => null,
    ...over,
  });

  // Right-alignment already meant "this column holds numbers", so it is the
  // trigger and no existing caller had to change.
  test("a right-aligned column is numbers, so it sets in mono", () => {
    expect(isMonoColumn(c({ align: "right" }))).toBe(true);
  });

  test("a left-aligned column is prose by default", () => {
    expect(isMonoColumn(c({}))).toBe(false);
    expect(isMonoColumn(c({ align: "left" }))).toBe(false);
  });

  // 🔴 "2026-T3" is data that happens to read left.
  test("a left-reading code opts in with mono", () => {
    expect(isMonoColumn(c({ align: "left", mono: true }))).toBe(true);
  });
});

describe("isRowHeader", () => {
  const c = (over: Partial<LedgerColumn<Row>>): LedgerColumn<Row> =>
    ({ key: "k", header: "K", cell: () => null, ...over });

  test("a column opts in and becomes the row's name", () => {
    expect(isRowHeader(c({ rowHeader: true }))).toBe(true);
  });

  test("a column that does not ask is an ordinary cell", () => {
    expect(isRowHeader(c({}))).toBe(false);
  });

  // ⛔ The guard, and the reason this is a function rather than a doc comment.
  // Right-aligned means numbers, and "72%" announced as the header of its own
  // row tells a screen-reader user nothing while displacing the name that
  // would have.
  test("a numeric column is refused even when it asks", () => {
    expect(isRowHeader(c({ rowHeader: true, align: "right" }))).toBe(false);
  });
});

// ── Row expansion ──────────────────────────────────────────────────────────
// renderToStaticMarkup, like kpi-definition-list.test.tsx. This file is .ts
// rather than .tsx, so the trees are built with createElement; nothing else
// about the style differs.

type Page = { key: string; name: string; views: number };

const PAGES: Page[] = [
  { key: "home", name: "Home", views: 12 },
  { key: "pricing", name: "Pricing", views: 7 },
];

const PAGE_COLUMNS: LedgerColumn<Page>[] = [
  { key: "name", header: "Page", cell: (r) => r.name, rowHeader: true },
  { key: "views", header: "Views", align: "right", cell: (r) => r.views },
];

/** The key union an app with a typed column model would already own. */
type PageKey = "name" | "views";

function ledger(over: Partial<LedgerExpand<Page>> | null, props: Record<string, unknown> = {}) {
  const expand: LedgerExpand<Page> | undefined = over
    ? {
        expanded: new Set<string>(),
        onToggle: () => {},
        render: (r) => `trend for ${r.name}`,
        ...over,
      }
    : undefined;
  return renderToStaticMarkup(
    h(Ledger<Page>, { columns: PAGE_COLUMNS, rows: PAGES, expand, ...props }),
  );
}

describe("the toggle column only exists when a caller asks for one", () => {
  it("is absent with no expand, so no existing caller changes", () => {
    const html = ledger(null);
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("Details");
    // Two data rows, two cells each, and nothing else in the row.
    expect((html.match(/<tr/g) ?? []).length).toBe(3); // header + 2 rows
  });

  it("adds one narrow column, named for a screen reader", () => {
    const html = ledger({});
    expect(html).toContain("Details");
    expect(html).toContain(`width:${EXPAND_COLUMN_WIDTH}px`);
  });

  // ⛔ The toggle column is NOT part of `columns`: the caller's column count
  // is the caller's, and a model that silently grew a column would break every
  // `total` keyed by column key.
  it("leaves the caller's columns untouched", () => {
    expect(PAGE_COLUMNS).toHaveLength(2);
  });
});

describe("a row with nothing to open shows no toggle", () => {
  // ⚖️ The alternative is a button that opens an empty panel — a control that
  // lies about there being something behind it, once per row, down the column.
  it("renders no button when render returns null", () => {
    const html = ledger({ render: () => null });
    expect(html).not.toContain("aria-expanded");
  });

  it("draws a toggle only for the rows that have one", () => {
    const html = ledger({ render: (r) => (r.key === "home" ? "detail" : null) });
    expect((html.match(/aria-expanded/g) ?? []).length).toBe(1);
  });
});

describe("the button is wired to the panel it controls", () => {
  const html = ledger({ expanded: new Set(["home"]) });

  it("says which rows are open and which are shut", () => {
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("points at the panel's own id", () => {
    expect(html).toContain(`aria-controls="${detailPanelId("home")}"`);
    expect(html).toContain(`id="${detailPanelId("home")}"`);
  });

  it("names the row rather than repeating 'Show details' down the column", () => {
    expect(html).toContain("Show details for Home");
    expect(html).toContain("Show details for Pricing");
  });

  it("takes the caller's label when given one", () => {
    expect(ledger({ label: (r) => `Open ${r.key}` })).toContain("Open pricing");
  });
});

describe("the panel row is present only for open keys", () => {
  it("renders nothing for a closed row — not hidden in the DOM", () => {
    // A hidden panel is still read by a screen reader walking the table, which
    // on a forty-row ledger is forty panels of detail nobody asked for.
    const html = ledger({ expanded: new Set<string>() });
    expect(html).not.toContain("trend for");
  });

  it("renders the open one, and only the open one", () => {
    const html = ledger({ expanded: new Set(["pricing"]) });
    expect(html).toContain("trend for Pricing");
    expect(html).not.toContain("trend for Home");
  });

  it("sits immediately after its own row", () => {
    const html = ledger({ expanded: new Set(["home"]) });
    expect(html.indexOf("trend for Home")).toBeGreaterThan(html.indexOf("Home"));
    expect(html.indexOf("trend for Home")).toBeLessThan(html.indexOf("Pricing"));
  });

  it("spans every column, the toggle column included", () => {
    const html = ledger({ expanded: new Set(["home"]) });
    expect(html).toMatch(new RegExp(`colspan="${PAGE_COLUMNS.length + 1}"`, "i"));
  });

  it("takes the panel padding, not the row rung", () => {
    const html = ledger({ expanded: new Set(["home"]) });
    const panel = html.slice(html.indexOf(detailPanelId("home")));
    expect(panel).toContain("var(--density-panel-pad)");
    expect(panel.slice(0, panel.indexOf("</td>"))).not.toContain("--density-row");
  });

  // ⛔ "Open" is not a record state. selected/marked/closed are claims about
  // the record; this is a claim about the reader's screen.
  it("does not restyle the data row it belongs to", () => {
    const shut = ledger({ expanded: new Set<string>() });
    const open = ledger({ expanded: new Set(["home"]) });
    // The <tr> itself carries the record states, and the data cells carry the
    // rest. Both are byte-identical open and shut; only the button inside the
    // toggle cell changes, which is the one place the state belongs.
    const rowTag = (s: string) => s.slice(s.indexOf("<tbody>"), s.indexOf("<td style"));
    const dataCells = (s: string) =>
      s.slice(s.indexOf('<th scope="row"'), s.indexOf("</tr>", s.indexOf('<th scope="row"')));
    expect(rowTag(open)).toBe(rowTag(shut));
    expect(dataCells(open)).toBe(dataCells(shut));
  });
});

describe("expansion leaves the rest of the table alone", () => {
  const total = { cells: { views: 19 } };

  it("gives the total row an empty toggle cell, so the figures stay in column", () => {
    const html = ledger({}, { total });
    const foot = html.slice(html.indexOf("<tfoot>"));
    expect(foot).not.toContain("aria-expanded");
    expect(foot).toContain("19");
  });

  it("leaves the skeleton's toggle cell empty", () => {
    const html = ledger({}, { loading: true });
    expect(html).not.toContain("aria-expanded");
    expect(html).toContain("var(--density-row)");
  });

  it("widens the empty state to the full table", () => {
    const html = renderToStaticMarkup(
      h(Ledger<Page>, {
        columns: PAGE_COLUMNS,
        rows: [],
        empty: { what: "No pages.", fix: "Widen the date range." },
        expand: { expanded: new Set<string>(), onToggle: () => {}, render: () => "x" },
      }),
    );
    expect(html).toMatch(new RegExp(`colspan="${PAGE_COLUMNS.length + 1}"`, "i"));
  });

  // 🔴 `wide` pins the row's NAME so it survives horizontal scroll. With a
  // toggle column that means BOTH pin — the toggle at 0 and the name right
  // after it. Pinning only the toggle would pin 32px of chevrons that identify
  // nothing; pinning only the name would scroll the control away from its row.
  it("pins the toggle and the row header together under wide", () => {
    const html = ledger({}, { wide: true });
    expect(html).toContain("left:0");
    expect(html).toContain(`left:${EXPAND_COLUMN_WIDTH}px`);
  });

  it("pins the first data column at 0 when there is no toggle column", () => {
    const html = ledger(null, { wide: true });
    expect(html).toContain("left:0");
    expect(html).not.toContain(`left:${EXPAND_COLUMN_WIDTH}px`);
  });
});

// ── `wide` pins the row header, not column 0 ───────────────────────────────
// 🔴 The defect this closes, twice over: governance's registers pinned a 56px
// ordinal, and scheduling's FindingsTable had its naming column FIFTH and was
// worked around by reordering the model. A pinned column that identifies
// nothing costs the reader the width and the name at once.

type Finding = { key: string; ord: number; category: string; severity: string; finding: string };

const FINDINGS: Finding[] = [
  { key: "f1", ord: 1, category: "Naming", severity: "High", finding: "Row name is column five" },
  { key: "f2", ord: 2, category: "Naming", severity: "Low", finding: "Ordinal pinned instead" },
];

// The shape the gap was reported against: an ordinal first, two columns of
// repeated category words, and the column that actually names the row fourth.
const FINDING_COLUMNS: LedgerColumn<Finding>[] = [
  { key: "ord", header: "Ord", align: "right", width: 56, cell: (r) => r.ord },
  { key: "category", header: "Category", cell: (r) => r.category },
  { key: "severity", header: "Severity", cell: (r) => r.severity },
  { key: "finding", header: "Finding", cell: (r) => r.finding, rowHeader: true },
];

const ROW_HEADER_INDEX = 3;

/** Every `<th>`/`<td>` opening tag in a slice of markup, in document order. */
function cellTags(section: string): string[] {
  return [...section.matchAll(/<t[hd]\b[^>]*>/g)].map((m) => m[0]);
}

const stickiness = (tags: string[]) => tags.map((t) => t.includes("sticky"));
const offsets = (tags: string[]) => tags.map((t) => /left:(\d+)/.exec(t)?.[1]);

function sections(html: string) {
  const head = html.slice(html.indexOf("<thead>"), html.indexOf("</thead>"));
  const bodyStart = html.indexOf("<tbody>");
  const body = html.slice(bodyStart, html.indexOf("</tr>", bodyStart));
  const foot = html.slice(html.indexOf("<tfoot>"));
  return { head: cellTags(head), body: cellTags(body), foot: cellTags(foot) };
}

function findings(props: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    h(Ledger<Finding>, {
      columns: FINDING_COLUMNS,
      rows: FINDINGS,
      wide: true,
      total: { cells: { ord: 2 } },
      ...props,
    }),
  );
}

describe("wide pins the column that names the row", () => {
  const s = sections(findings());

  it("pins the rowHeader column, wherever it sits in the model", () => {
    expect(stickiness(s.head)).toEqual([false, false, false, true]);
    // The sticky cell is the one headed "Finding", not merely the fourth.
    expect(findings()).toMatch(/sticky[^>]*>Finding</);
    expect(findings()).toMatch(/sticky[^>]*>Row name is column five</);
  });

  // ⛔ The whole point: a 56px column of ordinals is not what a reader needs
  // held beside the figures.
  it("does not pin column 0 when column 0 is not the name", () => {
    expect(s.head[0]).not.toContain("sticky");
    expect(s.body[0]).not.toContain("sticky");
    expect(s.foot[0]).not.toContain("sticky");
  });

  // ⚖️ Ord, Category and Severity scroll underneath the name. That is the
  // caller's own declaration read back: they named ONE column as the one that
  // identifies the row, so the three to its left are less identifying than it
  // by their own account.
  it("lets the columns before it scroll underneath", () => {
    expect(stickiness(s.head).slice(0, ROW_HEADER_INDEX)).toEqual([false, false, false]);
  });

  // A pin in the header and not the body is a column that detaches as soon as
  // anyone scrolls, which is worse than no pin at all.
  it("agrees across header, body and total", () => {
    expect(stickiness(s.body)).toEqual(stickiness(s.head));
    expect(stickiness(s.foot)).toEqual(stickiness(s.head));
    expect(offsets(s.body)).toEqual(offsets(s.head));
    expect(offsets(s.foot)).toEqual(offsets(s.head));
  });

  // The label is a word and belongs where the eye starts; the pin is about
  // which column survives a scroll. Two questions, two answers.
  it("leaves the total's label in column 0 while pinning the name", () => {
    const foot = findings().slice(findings().indexOf("<tfoot>"));
    expect(foot).toContain("Total");
    expect(foot.indexOf("Total")).toBeLessThan(foot.indexOf("sticky"));
  });
});

describe("wide with a toggle column and a late row header", () => {
  const s = sections(
    findings({
      expand: { expanded: new Set<string>(), onToggle: () => {}, render: () => "detail" },
    }),
  );

  // Cells are [toggle, ord, category, severity, finding].
  it("pins the toggle at 0 and the row header at 32", () => {
    expect(stickiness(s.head)).toEqual([true, false, false, false, true]);
    expect(offsets(s.head)).toEqual(["0", undefined, undefined, undefined, "32"]);
  });

  it("agrees across header, body and total", () => {
    expect(stickiness(s.body)).toEqual([true, false, false, false, true]);
    expect(offsets(s.body)).toEqual(["0", undefined, undefined, undefined, "32"]);
    expect(stickiness(s.foot)).toEqual([true, false, false, false, true]);
    expect(offsets(s.foot)).toEqual(["0", undefined, undefined, undefined, "32"]);
  });
});

describe("wide with no rowHeader column behaves exactly as before", () => {
  // 🔴 THE NO-CHANGE GUARANTEE. Every `wide` caller in the estate that has not
  // declared a row header must keep the pin it has, or this is a silent layout
  // change in 17 apps rather than a fix.
  const UNNAMED: LedgerColumn<Finding>[] = FINDING_COLUMNS.map(({ rowHeader: _r, ...c }) => c);

  const s = sections(
    renderToStaticMarkup(
      h(Ledger<Finding>, {
        columns: UNNAMED,
        rows: FINDINGS,
        wide: true,
        total: { cells: { ord: 2 } },
      }),
    ),
  );

  it("falls back to index 0", () => {
    expect(stickiness(s.head)).toEqual([true, false, false, false]);
    expect(offsets(s.head)).toEqual(["0", undefined, undefined, undefined]);
    expect(stickiness(s.body)).toEqual([true, false, false, false]);
    expect(stickiness(s.foot)).toEqual([true, false, false, false]);
  });

  // ⛔ A right-aligned column is refused as a row header everywhere else
  // (isRowHeader), so it must be refused as the pin too — or `wide` would pin
  // a quantity that `rowHeader` itself would not accept.
  it("ignores a rowHeader a numeric column asked for, and pins index 0", () => {
    const refused: LedgerColumn<Finding>[] = UNNAMED.map((c) =>
      c.key === "ord" ? { ...c, rowHeader: true } : c,
    );
    const head = sections(
      renderToStaticMarkup(
        h(Ledger<Finding>, { columns: refused, rows: FINDINGS, wide: true }),
      ),
    ).head;
    // Index 0 both because it is the fallback and because it is `ord` — the
    // assertion that matters is that nothing ELSE became the pin.
    expect(stickiness(head)).toEqual([true, false, false, false]);
  });
});

describe("without wide, nothing is pinned at all", () => {
  it("draws no sticky cell wherever the row header sits", () => {
    expect(findings({ wide: false })).not.toContain("sticky");
  });
});

// ── Typed column keys ──────────────────────────────────────────────────────
// ⚖️ These assert at COMPILE time; `npm run typecheck` is where they fail. The
// `expect`s below exist so the runner reports the block rather than silently
// skipping it. There is no type-assertion library in this package and this
// does not earn one.

type Expect<T extends true> = T;
type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

/** Captures whatever `K` a props object infers, so the union can be asserted. */
function inferredKey<K extends string>(props: LedgerProps<Page, K>): K {
  return props.columns[0]!.key;
}

describe("the column key is generic", () => {
  it("infers the union from a column model that declares one", () => {
    const key = inferredKey({
      columns: [
        { key: "name", header: "Page", cell: (r) => r.name, rowHeader: true },
        { key: "views", header: "Views", align: "right", cell: (r) => r.views },
      ],
      rows: PAGES,
    });
    type _Union = Expect<Equals<typeof key, "name" | "views">>;
    expect(key).toBe("name");
  });

  // 🔴 THE NO-CHANGE GUARANTEE for the type. `K` defaults to `string`, so a
  // caller who annotates `LedgerColumn<Page>[]` — which is every caller in the
  // estate today — gets exactly the API they had, and nothing has to cast.
  it("stays string for a model that declares no union", () => {
    const key = inferredKey({ columns: PAGE_COLUMNS, rows: PAGES });
    type _Wide = Expect<Equals<typeof key, string>>;
    expect(key).toBe("name");
  });

  it("threads the union through sort, onSort and total", () => {
    const seen: PageKey[] = [];
    const props: LedgerProps<Page, PageKey> = {
      columns: PAGE_COLUMNS as LedgerColumn<Page, PageKey>[],
      rows: PAGES,
      sort: { key: "views", direction: "desc" },
      // ⚖️ The whole point of the change: `key` arrives as the union, so a
      // caller with a typed key does not cast at the boundary.
      onSort: (key) => {
        type _Narrowed = Expect<Equals<typeof key, PageKey>>;
        seen.push(key);
      },
      total: { cells: { views: 19 } },
    };
    props.onSort!("name");
    expect(seen).toEqual(["name"]);
  });

  it("totals only some columns, so cells is Partial", () => {
    const partial: LedgerProps<Page, PageKey>["total"] = { cells: { views: 19 } };
    expect(partial!.cells.name).toBeUndefined();
  });

  // ⛔ The three places a column name could be mistyped, each now a compile
  // error rather than a figure that renders nowhere.
  it("refuses a key the model does not have", () => {
    // @ts-expect-error — "clicks" is not one of this model's column keys
    const badSort: LedgerProps<Page, PageKey>["sort"] = { key: "clicks", direction: "asc" };
    // @ts-expect-error — a total for a column this table does not have
    const badTotal: LedgerProps<Page, PageKey>["total"] = { cells: { clicks: 1 } };
    // @ts-expect-error — a column whose key is outside the declared union
    const badColumn: LedgerColumn<Page, PageKey> = { key: "clicks", header: "C", cell: () => null };
    expect([badSort, badTotal, badColumn]).toHaveLength(3);
  });

  // ⚖️ `onToggle` takes the ROW key, and `LedgerRow.key` is `string`. Rows are
  // not generic in this part, so narrowing the callback would promise
  // something `expanded: ReadonlySet<string>` beside it cannot keep.
  it("leaves onToggle on the row key, which is string", () => {
    const expand: LedgerExpand<Page> = {
      expanded: new Set<string>(),
      onToggle: (key) => {
        type _RowKey = Expect<Equals<typeof key, string>>;
        void key;
      },
      render: () => null,
    };
    expect(expand.expanded.size).toBe(0);
  });
});

describe("expandLabel", () => {
  it("prefers the row-header column's titleOf", () => {
    const columns: LedgerColumn<Page>[] = [
      { key: "name", header: "Page", cell: (r) => r.name, rowHeader: true, titleOf: () => "Full name" },
    ];
    expect(expandLabel(columns, PAGES[0])).toBe("Show details for Full name");
  });

  it("falls back to the key when no column names the row", () => {
    const columns: LedgerColumn<Page>[] = [
      { key: "views", header: "Views", align: "right", cell: (r) => r.views },
    ];
    expect(expandLabel(columns, PAGES[0])).toBe("Show details for home");
  });
});

describe("detailPanelId", () => {
  it("is safe to put in an id attribute", () => {
    expect(detailPanelId("a/b c")).toBe("ledger-detail-a-b-c");
  });
});

describe("Ledger stays server-safe", () => {
  // 🔴 v3.2.0 SHIPPED A CONTEXT INTO Kpi AND BROKE EVERY SERVER COMPONENT THAT
  // IMPORTED IT, and passed this package's CI doing it — a library never runs a
  // Next build. `Ledger` is one of the same seven parts, and row expansion is
  // exactly the feature that invites a hook. The guard is the same one Kpi
  // carries, for the same reason: no behavioural test can catch this.
  //
  // ⚖️ The toggle's `onClick` is NOT a violation. A function prop can only
  // reach this module from a client caller, so the module is already in the
  // client bundle by the time a handler exists — which is why `onSort` has
  // been inline here since the part shipped.
  const src = readFileSync(new URL("./Ledger.tsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("calls no React hook", () => {
    expect(code).not.toMatch(/\buse[A-Z]\w*\s*\(/);
  });

  it("creates no context", () => {
    expect(code).not.toMatch(/\bcreateContext\b/);
  });

  it("needs no 'use client', so a server page can render a table directly", () => {
    expect(code).not.toContain('"use client"');
  });

  it("has no 'use client' on its first line either", () => {
    // ⚠️ Check the FIRST LINE, not a grep for the string: Kpi.tsx contains the
    // string inside a comment explaining why it must not have one.
    expect(src.split("\n")[0].trim()).not.toContain("use client");
  });
});
