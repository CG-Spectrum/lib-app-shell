/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Kpi, rulerStep } from "./Kpi";

describe("rulerStep", () => {
  it("is one tick per unit for a count up to 60", () => {
    expect(rulerStep(38)).toBeCloseTo(100 / 38);
    expect(rulerStep(60)).toBeCloseTo(100 / 60);
  });
  it("falls back to tenths above 60", () => expect(rulerStep(61)).toBe(10));
  it("draws nothing for an empty or bad target", () => {
    expect(rulerStep(0)).toBe(0);
    expect(rulerStep(Number.NaN)).toBe(0);
  });
});

describe("Kpi ruler", () => {
  const html = (ruler: boolean, actual = 29) => renderToStaticMarkup(<Kpi label="Logged into Slack" value="29/38" actual={actual} target={38} ruler={ruler} />);
  it("draws unit ticks and the end mark when asked", () => {
    const h = html(true);
    expect(h).toContain("repeating-linear-gradient");
    expect(h).toContain(`calc(${(29 / 38) * 100}% - 1px)`);
  });
  it("leaves the plain target bar unchanged by default", () => {
    const h = html(false);
    expect(h).not.toContain("repeating-linear-gradient");
    expect(h).toContain("bg-surface-3");
  });
  it("draws no end mark at zero", () => expect(html(true, 0)).not.toContain("- 1px)"));
});
