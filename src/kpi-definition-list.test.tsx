/**
 * KpiRow as a definition list.
 *
 * ⚖️ A row of KPI tiles IS a definition list — a term and the figure that
 * defines it, four times over. As divs it is four labels and four numbers in
 * reading order, and nothing says which belongs to which.
 *
 * 🔴 The failure these guard is SILENT. A `<dt>` outside a `<dl>` is invalid
 * HTML that no browser and no linter complains about; it simply stops being a
 * term. So the pairing is asserted in both directions.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Kpi, KpiRow } from "./Kpi";

const row = (as?: "div" | "dl") =>
  renderToStaticMarkup(
    <KpiRow as={as}>
      <Kpi label="Registrations" value="1,234" context="Unique people" />
      <Kpi label="Attended" value="412" />
    </KpiRow>,
  );

describe("a div row stays a div row", () => {
  it("is the default, so no existing caller changes", () => {
    const html = row();
    expect(html).toMatch(/^<div/);
    expect(html).not.toContain("<dt");
    expect(html).not.toContain("<dd");
  });

  it("never emits a dt outside a dl", () => {
    // The invalid-HTML case, and the reason the row tells the tiles rather
    // than each tile being told separately.
    expect(row()).not.toMatch(/<dt|<dd/);
  });
});

describe("a dl row pairs each label with its figure", () => {
  const html = row("dl");

  it("is a dl", () => {
    expect(html).toMatch(/^<dl/);
  });

  it("makes every label a term and every figure a definition", () => {
    expect((html.match(/<dt/g) ?? []).length).toBe(2);
    expect((html.match(/<dd/g) ?? []).length).toBe(2);
  });

  it("keeps the term immediately before its own definition", () => {
    const first = html.slice(html.indexOf("<dt"), html.indexOf("</dd>"));
    expect(first).toContain("Registrations");
    expect(first).toContain("1,234");
    expect(first).not.toContain("Attended");
  });

  it("⛔ changes nothing about the look", () => {
    // Semantics, not style. The classes on the label and the figure are the
    // same either way; only the element names differ.
    const strip = (s: string) => s.replace(/<\/?(div|dl|dt|dd|span)/g, "<x");
    expect(strip(html)).toBe(strip(row()));
  });
});

describe("Kpi stays server-safe", () => {
  // 🔴 v3.2.0 SHIPPED A CONTEXT HERE AND BROKE EVERY SERVER COMPONENT THAT
  // IMPORTED IT. `createContext` is a client-only API; a server component
  // importing a module that calls it dies at page-data collection with
  // "(0 , f.createContext) is not a function". It passed this package's CI
  // (a library never runs a Next build) and surfaced only when cgsi-auth
  // bumped to it.
  const src = readFileSync(new URL("./Kpi.tsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("calls no React hook", () => {
    expect(code).not.toMatch(/\buse[A-Z]\w*\s*\(/);
  });

  it("creates no context", () => {
    expect(code).not.toMatch(/\bcreateContext\b/);
  });

  it("needs no 'use client', so a server page can render a tile directly", () => {
    expect(code).not.toContain('"use client"');
  });
});
