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
