"use client";
import { useState } from "react";
import { Panel } from "./Panel";
import { Segmented } from "./Filters";
import { Chart, ChartTable, type ChartProps, type ChartView } from "./Chart";

// A chart, its table, and the control that switches them, in one panel.
//
// ⚖️ WHY THIS IS ONE COMPONENT AND NOT FOUR. Composing Panel + Segmented +
// Chart + ChartTable by hand works, and is four chances to leave the table
// out. The table is not a nicety here: both grey series measure under 3:1
// against the panel surface, and the validator calls that relief-required.
// Taking the whole panel is one chance instead of four.
//
// The view is local state rather than a prop: which representation somebody is
// looking at is not application state, and lifting it would put a useState in
// every board for no gain. An app that genuinely needs it in the URL should
// use useUrlState and compose the pieces itself.

export interface ChartPanelProps extends Omit<ChartProps, "className"> {
  /** Panel title. The chart's own `title` stays the accessible name. */
  heading?: string;
  /** "Updated 11:30 · HubSpot". Name the source. */
  freshness?: string;
  /** Href for "How it's counted". Methodology never sits in the body. */
  howCounted?: string;
  defaultView?: ChartView;
  className?: string;
}

export function ChartPanel({
  heading,
  freshness,
  howCounted,
  defaultView = "chart",
  className = "",
  ...chart
}: ChartPanelProps) {
  const [view, setView] = useState<ChartView>(defaultView);

  return (
    <Panel
      title={heading ?? chart.title}
      freshness={freshness}
      howCounted={howCounted}
      className={className}
      actions={
        <Segmented
          label="Panel view"
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      }
      /* The table draws its own row padding and wants the panel's edges. */
      flush={view === "table"}
    >
      {view === "chart" ? (
        <Chart {...chart} />
      ) : (
        <ChartTable series={chart.series} title={chart.title} format={chart.format} />
      )}
    </Panel>
  );
}
