/** @jsxRuntime automatic */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ElementType, ReactNode } from "react";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./button-logic";

// The standard's button, as a part. surface-app-layer.md "Buttons".
//
// 🔴 WHY THIS EXISTS. Until 25 Oct 2026 the standard's button was the Header's
// admin link and nothing else, so ten apps copied its class string by hand —
// sixty-odd times — and every copy carried its own exception pragma for the
// accent edge on hover. A copied register is a rebuilt part: it misses every
// change made here, and it is where `text-white` on the accent fill (1.9:1 on
// dark) and a fill with NO label colour came from. Apps import this and never
// restyle it; `className` is for layout (a margin, a width), not for colour.
//
// ⚖️ TWO VARIANTS, NOT A PALETTE. `secondary` is most buttons. `primary` is the
// ONE filled button a view may have (rule 4): the bright mark as the fill in
// both themes, the ink as the label. A second filled button on a screen is a
// design error, not a prop this part should make easy.
//
// Hover keeps the accent on the secondary edge; that is settled (Jeremy,
// 21 Oct 2026) and the pragma lives in button-logic.ts, once, for the estate.

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Layout only — a margin or a width. Never a colour; the part owns those. */
  className?: string;
  children: ReactNode;
};

type AsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    as?: undefined;
  };

type AsLink = Common &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> & {
    /** Renders an anchor styled as a button. */
    href: string;
    /** The anchor component, so a consumer can pass Next's `Link` without this
     *  package importing `next/link`. Defaults to a plain `<a>`. */
    as?: ElementType;
    disabled?: boolean;
  };

export type ButtonProps = AsButton | AsLink;

export function Button(props: ButtonProps) {
  const { variant, size, className, children } = props;
  const cls = buttonClassName({ variant, size, className });

  if (props.href !== undefined) {
    const { href, as, disabled, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
    const Anchor: ElementType = as ?? "a";
    // A disabled link keeps its text and loses its destination: aria-disabled
    // for readers, no href so it cannot be followed, and the register's
    // disabled colours via the attribute selector in buttonClassName.
    return (
      <Anchor
        {...rest}
        href={disabled ? undefined : href}
        aria-disabled={disabled || undefined}
        className={cls}
      >
        {children}
      </Anchor>
    );
  }

  const { type = "button", variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
  // `type="button"` by default: a button inside a form must not submit the
  // form by accident. Submission is explicit.
  return (
    <button {...rest} type={type} className={cls}>
      {children}
    </button>
  );
}
