/** @jsxRuntime automatic */
import {
  band,
  seriesBudgetError,
  seriesColour,
  xScale,
  yDomain,
  yScale,
  yTicks,
  type Series,
} from "./chart-logic";
import { Notice } from "./Status";

// Line and bar charts for the app layer.
//
// ⚖️ CHART FIRST. If a shape answers the question faster than the numbers do —
// a drop-off, a trend, a gap to target — the panel leads with the chart and
// the table sits behind the segmented control. ⛔ No page runs three tables in
// a row. The table is never dropped though: every chart has one, with the same
// numbers in the same order, which is also the relief the contrast measurement
// below requires.
//
// 🔴 SQUARE MARKS. No rounded bar tops, no gradient fills, no glows. This is
// the one place the house chart rules and the general dataviz guidance
// disagree (that guidance asks for 4px rounded data-ends), and CGSI wins.
//
// 🔴 TWO GREY SERIES, MEASURED NOT ASSUMED. The standard gives no categorical
// hue palette — grey is data, green is the point. Validated against the panel
// surface: 3 greys separate at ΔE 9.7 against a floor of 15, 2 at 22.1. So the
// budget is two, enforced in chart-logic.ts, and over budget the component
// renders the reason rather than an unreadable chart.
//
// 🔴 DIRECT LABELS ARE NOT OPTIONAL. Both greys measure under 3:1 against the
// surface (2.01 and 2.36), which obliges visible labels or a table view. This
// ships both. Identity never rests on colour here, which is just as well,
// because the colours are two greys.
//
// ⛔ ONE AXIS. Never two y-scales. Two measures of different scale are two
// charts, small multiples, or both indexed to a common base.

const PAD = { top: 16, right: 56, bottom: 28, left: 44 };

export interface ChartProps {
  kind: "line" | "bar";
  series: Series[];
  /** Height of the plot area in px. Width is fluid. */
  height?: number;
  /** Dashed paper line, labelled at the end. ⛔ Not amber — a target is not a warning. */
  target?: { value: number; label?: string };
  /** Axis units, in the label rather than repeated on every tick. */
  unit?: string;
  /** Names the chart for screen readers and for the table caption. */
  title: string;
  /** Formats a value for ticks, labels and the table. */
  format?: (value: number) => string;
  className?: string;
}

export function Chart({
  kind,
  series,
  height = 180,
  target,
  unit,
  title,
  format = (v) => String(v),
  className = "",
}: ChartProps) {
  const budgetError = seriesBudgetError(series);
  if (budgetError) {
    // The numbers are still true when the shape is not drawable, so the panel
    // gets a reason it can act on rather than a blank box.
    return (
      <Notice tone="warning" label="Chart not drawn" className={className}>
        {budgetError}
      </Notice>
    );
  }

  const points = series.flatMap((s) => s.points.map((p) => p.value));
  if (points.length === 0) {
    return (
      <div className={`py-6 text-[13px] text-text-3 ${className}`}>
        Nothing to plot for this selection.
      </div>
    );
  }

  const domain = yDomain(points, target?.value);
  const ticks = yTicks(domain);
  const labels = series[0]?.points.map((p) => p.label) ?? [];

  // viewBox leaves room for the outermost labels: the right pad holds the
  // end-of-line series label, the left pad the axis values.
  const vbW = 640;
  const plotW = vbW - PAD.left - PAD.right;
  const vbH = height + PAD.top + PAD.bottom;

  return (
    <figure className={`m-0 min-w-0 ${className}`}>
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="h-auto w-full max-w-full"
        role="img"
        aria-label={title}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Gridlines at 8%, recessive by design. */}
        {ticks.map((t) => {
          const y = PAD.top + yScale(t, domain, height);
          return (
            <g key={`t-${t}`}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y}
                y2={y}
                stroke="var(--color-text)"
                strokeOpacity={0.08}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y + 3}
                textAnchor="end"
                className="font-mono"
                fontSize={10}
                fill="var(--color-text-3)"
              >
                {format(t)}
              </text>
            </g>
          );
        })}

        {/* Target: dashed, in paper, labelled at the end. */}
        {target && (
          <g>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={PAD.top + yScale(target.value, domain, height)}
              y2={PAD.top + yScale(target.value, domain, height)}
              stroke="var(--color-text)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={PAD.left + plotW + 6}
              y={PAD.top + yScale(target.value, domain, height) + 3}
              className="font-mono"
              fontSize={10}
              fill="var(--color-text-2)"
            >
              {target.label ?? "Target"}
            </text>
          </g>
        )}

        {series.map((s, i) => {
          const colour = seriesColour(series, i);
          if (kind === "bar") {
            return (
              <g key={s.key}>
                {s.points.map((p, j) => {
                  const { x, w } = band(j, s.points.length, plotW);
                  const y = PAD.top + yScale(p.value, domain, height);
                  return (
                    <rect
                      key={p.label}
                      x={PAD.left + x}
                      y={y}
                      width={w}
                      height={PAD.top + height - y}
                      fill={colour}
                    />
                  );
                })}
              </g>
            );
          }
          const d = s.points
            .map((p, j) => `${j === 0 ? "M" : "L"}${PAD.left + xScale(j, s.points.length, plotW)},${PAD.top + yScale(p.value, domain, height)}`)
            .join(" ");
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.key}>
              <path
                d={d}
                fill="none"
                stroke={colour}
                strokeWidth={2}
                strokeDasharray={s.previous ? "4 3" : undefined}
              />
              {/* Direct label at the end of the line. Not optional: see header. */}
              {last && (
                <text
                  x={PAD.left + plotW + 6}
                  y={PAD.top + yScale(last.value, domain, height) + 3}
                  className="font-mono"
                  fontSize={10}
                  fill="var(--color-text-2)"
                >
                  {s.label}
                </text>
              )}
            </g>
          );
        })}

        {/* X labels. First and last only when crowded, so they never collide. */}
        {labels.map((l, j) => {
          const many = labels.length > 8;
          if (many && j !== 0 && j !== labels.length - 1) return null;
          const x =
            kind === "bar"
              ? PAD.left + band(j, labels.length, plotW).x + band(j, labels.length, plotW).w / 2
              : PAD.left + xScale(j, labels.length, plotW);
          return (
            <text
              key={l}
              x={x}
              y={vbH - 8}
              textAnchor={j === 0 ? "start" : j === labels.length - 1 ? "end" : "middle"}
              className="font-mono"
              fontSize={10}
              fill="var(--color-text-3)"
            >
              {l}
            </text>
          );
        })}
      </svg>

      {unit && (
        <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-3">
          {unit}
        </figcaption>
      )}
    </figure>
  );
}

// The table every chart has: same numbers, same order. Rendered behind the
// panel's segmented control, and the reason a low-contrast grey series is
// still readable at all.
export function ChartTable({
  series,
  title,
  format = (v) => String(v),
}: {
  series: Series[];
  title: string;
  format?: (value: number) => string;
}) {
  const labels = series[0]?.points.map((p) => p.label) ?? [];
  return (
    <table className="w-full border-collapse tabular-nums">
      <caption className="sr-only">{title}</caption>
      <thead>
        <tr>
          <th
            scope="col"
            className="border-b border-border-strong px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-text-3"
          >
            Period
          </th>
          {series.map((s) => (
            <th
              key={s.key}
              scope="col"
              className="border-b border-border-strong px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-text-3"
            >
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((l, j) => (
          <tr key={l} style={{ height: "var(--density-row)" }} className="border-b border-border">
            <td className="whitespace-nowrap px-4 text-[length:var(--density-body)] text-text-2">{l}</td>
            {series.map((s) => (
              <td
                key={s.key}
                className="whitespace-nowrap px-4 text-right text-[length:var(--density-body)] text-text-2"
              >
                {s.points[j] ? format(s.points[j].value) : "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A chart with its table behind the segmented control, in a panel.
//
// This exists so an app cannot ship the chart and forget the table. Composing
// Panel + Segmented + Chart + ChartTable by hand works and is four chances to
// leave the table out; the low-contrast grey series makes that table the
// accessibility relief, not a nicety. Taking the whole panel is one chance.
//
// Needs `"use client"` at the import site for the view state, which is why it
// lives in ChartPanel.tsx rather than here — this file stays server-renderable
// so a static panel can use Chart directly.
export type ChartView = "chart" | "table";
