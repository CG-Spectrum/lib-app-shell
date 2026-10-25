// The class strings behind Button, kept pure so the register can be tested
// without rendering. See Button.tsx for what each variant is for, and
// surface-app-layer.md "Buttons" for the standard this implements.

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "md" | "sm";

// The tab-and-button rung: Mono 500 · 11 · .14em · caps, the same face and
// tracking as a tab, a breadcrumb and a segmented control. Square, no shadow.
const RUNG = "font-mono text-[11px] font-medium uppercase tracking-[0.14em]";

const BOX: Record<ButtonSize, string> = {
  // The control box the segmented control and the filter chips use: 30 high,
  // 26 compact, so a button beside either sits on the same line.
  md: "h-[30px] px-3 [html[data-density='compact']_&]:h-[26px]",
  // Chrome. The header row is 56px and its user menu is 26, so the admin
  // shortcut is 26 whatever the density says.
  sm: "h-[26px] px-2",
};

const VARIANT: Record<ButtonVariant, string> = {
  // The one primary fill a view may have (rule 4). The fill is the bright mark
  // in both themes and the label is the ink: 9.2:1 at rest, 11.5:1 on hover.
  // Not bg-accent with text-bg — on light that pair is 4.28:1, under AA at
  // this size, which is the stopgap this part retires.
  primary:
    "bg-accent-mark text-accent-ink hover:bg-accent-hover disabled:bg-surface-2 disabled:text-text-3 disabled:hover:bg-surface-2",
  // cgsi-adherence-allow: accent-as-paint-class — boundary: the 1px edge on hover, Ink Green on light so it clears 3:1; hover keeps the accent (Jeremy, 21 Oct 2026)
  secondary:
    "border border-border bg-transparent text-text-2 hover:border-accent hover:text-accent disabled:text-text-3 disabled:hover:border-border disabled:hover:text-text-3",
};

export function buttonClassName({
  variant = "secondary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  return [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "transition-colors disabled:cursor-default aria-disabled:cursor-default",
    RUNG,
    BOX[size],
    VARIANT[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
