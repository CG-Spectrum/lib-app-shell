/** @jsxRuntime automatic */

// The NEW label. A square chip carrying the WORD, so it reads on a monochrome
// screen and to a reader who cannot tell the hues apart: the shape and the
// word are the signal, the accent edge is reinforcement only (Status.tsx has
// the long form of this rule).
//
// ⛔ NO HOOK, NO "use client", NO createContext IN THIS FILE. A server page
// may render the label directly; see the Kpi server-safety note for what a
// context in a shared part did to every server component in v3.2.0.
//
// The visible text is NEW; the accessible name is "New feature", because
// "new" read on its own after a tab name ("Roles new") says nothing about
// what is new. role="img" makes screen readers use the label rather than the
// letters inside.

export interface NewLabelProps {
  className?: string;
}

export function NewLabel({ className = "" }: NewLabelProps) {
  return (
    <span role="img" aria-label="New feature" className={`feature-new ${className}`.trim()}>
      <span aria-hidden="true">NEW</span>
    </span>
  );
}
