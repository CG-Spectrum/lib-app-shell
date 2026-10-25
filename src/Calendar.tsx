/** @jsxRuntime automatic */
import {
  DAY_END_MIN,
  DAY_START_MIN,
  busiestDay,
  isOutOfHours,
  laneGeometry,
  layoutEvents,
  type CalendarEvent,
} from "./calendar-logic";

// The week view. Overlaps take lanes, out-of-hours is banded, one day may be
// marked busiest.
//
// ⚠️ A CONTRADICTION IN THE v0.1 STANDARD, RESOLVED HERE AND FLAGGED FOR THE
// BRAND OWNER. `surface-app-layer.md` describes the event block as carrying "a
// 3px inside left rule in the event-type hue", and in the same document retires
// every `cat-*` token and states that discipline and category colours are gone
// because colour is the third signal. Those cannot both hold: an event-type
// hue IS a category colour.
//
// Resolved the way the rest of the document points: the rule is NEUTRAL by
// default and the event type is NAMED IN TEXT on the block. The accent rule is
// kept for SELECTION, which is the device's stated job everywhere else in the
// standard (the selected ledger row, the selected filter chip).
//
// ⚖️ DECIDED, Jeremy, 21 Oct 2026: the brand holds for this first pass. No
// event-type hue. Readability is reviewed in the visual audit of each
// dashboard once the migration is complete, and anything that has to change
// then goes back into cgsi-2027-design FIRST — the skill is the source of
// truth, and a fix made only here would silently diverge from it.
//
// 🔴 BOOKED IS PAPER, SO GREEN STAYS FREE. A booked event is not a success
// state; it is the normal state. Painting it green spends the one colour the
// reader is trained to read as "this one" on the most common thing on screen.

export interface CalendarProps {
  /** Day headers, in order. The length sets the day count. */
  days: string[];
  events: CalendarEvent[];
  /** Hour labels down the left. Defaults to the working day. */
  fromHour?: number;
  toHour?: number;
  /** Px per hour. Rows are not density-driven: a half-hour must stay clickable. */
  hourHeight?: number;
  onSelect?: (key: string) => void;
  className?: string;
}

export function Calendar({
  days,
  events,
  fromHour = 6,
  toHour = 22,
  hourHeight = 44,
  onSelect,
  className = "",
}: CalendarProps) {
  const layout = layoutEvents(events);
  const busiest = busiestDay(events, days.length);
  const hours = Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i);
  const totalMin = (toHour - fromHour) * 60;
  const bodyHeight = hours.length * hourHeight;

  const topPct = (minutes: number) => ((minutes - fromHour * 60) / totalMin) * 100;

  return (
    <div className={`min-w-0 overflow-x-auto ${className}`}>
      <div className="min-w-[640px]">
        {/* Day headers. One may take the accent; never two — see busiestDay. */}
        <div
          className="grid border-b border-border-strong"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div />
          {days.map((d, i) => (
            <div
              key={d}
              className={`border-l border-border px-2 py-2 font-mono text-[10px] uppercase tracking-[0.14em] ${
                i === busiest ? "text-accent" : "text-text-3"
              }`}
            >
              {d}
              {i === busiest && <span className="ml-1 normal-case tracking-normal">· busiest</span>}
            </div>
          ))}
        </div>

        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`, height: bodyHeight }}
        >
          {/* Hour gutter */}
          <div className="relative">
            {hours.map((hr, i) => (
              <div
                key={hr}
                className="absolute right-2 font-mono text-[10px] tabular-nums text-text-3"
                style={{ top: i * hourHeight - 5 }}
              >
                {String(hr).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((d, dayIndex) => (
            <div key={d} className="relative border-l border-border">
              {/* Out-of-hours bands, drawn first so events sit above them. */}
              {hours.map((hr, i) =>
                isOutOfHours(hr * 60) ? (
                  <div
                    key={`oh-${hr}`}
                    className="absolute inset-x-0 bg-surface-3"
                    style={{ top: i * hourHeight, height: hourHeight }}
                    aria-hidden
                  />
                ) : null,
              )}

              {/* Hour rules, at the same 8% the chart gridlines use. */}
              {hours.map((hr, i) => (
                <div
                  key={`r-${hr}`}
                  className="absolute inset-x-0 border-t border-text/8"
                  style={{ top: i * hourHeight }}
                  aria-hidden
                />
              ))}

              {events
                .filter((e) => e.day === dayIndex)
                .map((e) => {
                  const a = layout.get(e.key);
                  if (!a) return null;
                  const { left, width } = laneGeometry(a.lane, a.lanes);
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={onSelect ? () => onSelect(e.key) : undefined}
                      aria-pressed={e.selected || undefined}
                      className={[
                        "absolute overflow-hidden border-l-[3px] bg-surface px-2 py-1 text-left text-[length:var(--density-body)]",
                        e.selected ? "border-l-[var(--color-accent-mark)]" : "border-l-border-strong",
                        e.cancelled ? "text-text-3 line-through" : "text-text",
                      ].join(" ")}
                      style={{
                        left,
                        width,
                        top: `${topPct(e.start)}%`,
                        height: `${topPct(e.end) - topPct(e.start)}%`,
                      }}
                    >
                      <span className="block truncate">{e.title}</span>
                      {/* The event type is NAMED, not coloured. */}
                      {e.type && (
                        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-text-3">
                          {e.type}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { DAY_START_MIN, DAY_END_MIN };
