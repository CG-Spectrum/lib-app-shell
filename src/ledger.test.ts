import { describe, expect, test } from "vitest";
import { headerGroups, type LedgerColumn } from "./Ledger";

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
