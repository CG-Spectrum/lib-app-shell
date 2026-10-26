/** @jsxRuntime automatic */
// Type-level contract, checked by `tsc --noEmit` only. Named .check.tsx, not
// .test.tsx: vitest would open it, find no suite and fail the run.
// an icon button cannot be written without a name.
import { Button } from "./Button";

export const named = <Button size="icon" aria-label="Close">×</Button>; // ts should FAIL if this line is ever un-named
export const namedLink = <Button size="icon-sm" aria-label="Edit" href="/edit">✎</Button>;
export const text = <Button>Save</Button>;

// @ts-expect-error — size="icon" without aria-label must not compile
export const unnamed = <Button size="icon">×</Button>; // keep: proves the contract
// @ts-expect-error — the link form is held to the same contract
export const unnamedLink = <Button size="icon" href="/x">×</Button>;

// v3.7: pressed is a toggle on a BUTTON; a link cannot be pressed.
export const toggled = <Button pressed>Pinned</Button>;
export const untoggled = <Button pressed={false} variant="ghost">Pinned</Button>;
// @ts-expect-error — a link styled as a button has no pressed state
export const pressedLink = <Button href="/x" pressed>Pinned</Button>;
