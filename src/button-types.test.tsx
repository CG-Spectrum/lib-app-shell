/** @jsxRuntime automatic */
// Type-level contract, checked by `tsc --noEmit` (vitest does not type-check):
// an icon button cannot be written without a name.
import { Button } from "./Button";

export const named = <Button size="icon" aria-label="Close">×</Button>;
export const namedLink = <Button size="icon-sm" aria-label="Edit" href="/edit">✎</Button>;
export const text = <Button>Save</Button>;

// @ts-expect-error — size="icon" without aria-label must not compile
export const unnamed = <Button size="icon">×</Button>;
// @ts-expect-error — the link form is held to the same contract
export const unnamedLink = <Button size="icon" href="/x">×</Button>;
