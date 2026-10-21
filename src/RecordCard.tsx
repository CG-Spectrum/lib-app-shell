import type { ReactNode } from "react";
import { Status, type StatusTone } from "./Status";
import { DEFAULT_K, gradeFilter, isSuspectK } from "./portrait-grade";

// A person, a partner, a room — anything compared against its peers in a grid.
//
// 🔴 FIXED SLOT ORDER, SO CARDS COMPARE. Image, name, one line of role or
// studio, meta, status, notice. Always those, always that order. A card that
// reorders its own slots stops being comparable with the one beside it, which
// is the only reason to lay them out in a grid at all.
//
// ⛔ NO PILL ROWS, NO AWARD ICONS. Role and studio are TEXT. A row of pills
// turns six comparable cards into six differently-shaped blocks, and the
// awards are the least load-bearing thing on a hiring card.
//
// ⚖️ PORTRAITS TAKE THE MONO GRADE, and an unmeasured one says so. See
// portrait-grade.ts for the two production failures this chain has already
// caused: it has no highlight protection, and k is only as good as the lit-skin
// box it was measured from.

export interface RecordCardProps {
  /** Portrait or room image. Graded mono; student work is never treated. */
  image?: string;
  /** Per-record exposure. Omit when unmeasured — the card will flag it. */
  ev?: number;
  /** object-position, for a portrait that is not centred. */
  objectPosition?: string;
  name: ReactNode;
  /** ONE line. Role, or studio, or "Rogue One, Strange Magic · ILM". Text. */
  role?: ReactNode;
  /** Secondary facts, in mono caps. Kept short — this is not a biography. */
  meta?: ReactNode;
  status?: { tone: StatusTone; label: ReactNode };
  /** One notice, at most. A list of flags goes inside it. */
  notice?: ReactNode;
  className?: string;
}

export function RecordCard({
  image,
  ev,
  objectPosition,
  name,
  role,
  meta,
  status,
  notice,
  className = "",
}: RecordCardProps) {
  const k = ev ?? DEFAULT_K;
  const unmeasured = ev === undefined;
  const suspect = isSuspectK(k);

  return (
    <article className={`flex min-w-0 flex-col border border-border bg-surface ${className}`}>
      {image && (
        <div className="relative aspect-[4/5] w-full max-w-full overflow-hidden bg-surface-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- the package
              cannot depend on an app's image loader config. */}
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            style={{ filter: gradeFilter(k), objectPosition }}
          />
          {(unmeasured || suspect) && (
            <span
              className="absolute bottom-0 left-0 bg-bg/80 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-warn"
              title={
                suspect
                  ? `Exposure ${k} is high enough to suggest the skin median was measured from a box including hair or shadow. Check skin p99 < 235 before this ships.`
                  : "Exposure not measured: rendering at k = 1.0. Measure lit skin (forehead and cheek) to grade this frame."
              }
            >
              {suspect ? "EV suspect" : "EV unmeasured"}
            </span>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-2 p-[var(--density-panel-pad)]">
        <h4 className="m-0 min-w-0 font-[family-name:var(--brand-display)] text-[22px] leading-none tracking-[-0.02em] text-text">
          {name}
        </h4>

        {/* One line, text, never a pill. */}
        {role && <p className="m-0 min-w-0 text-[length:var(--density-body)] text-text-2">{role}</p>}

        {meta && (
          <p className="m-0 min-w-0 font-mono text-[10px] uppercase tracking-[0.14em] text-text-3">
            {meta}
          </p>
        )}

        {status && <Status tone={status.tone}>{status.label}</Status>}

        {notice && (
          <p className="m-0 min-w-0 border-l-[3px] border-l-warn pl-2 text-[13px] text-text-2">
            {notice}
          </p>
        )}
      </div>
    </article>
  );
}

// Cards in a hairline grid. Same no-gap rule as PanelGrid: the shared 1px
// border is the separator, and fixed slot order is what makes a row of these
// readable as a comparison rather than a collage.
export function RecordGrid({
  columns = 4,
  children,
  className = "",
}: {
  columns?: 2 | 3 | 4;
  children?: ReactNode;
  className?: string;
}) {
  const cols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  }[columns];
  return <div className={`grid ${cols} [&>*]:-mb-px [&>*]:-mr-px ${className}`}>{children}</div>;
}
