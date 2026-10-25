"use client";
import { useEffect, useRef, useState } from "react";
import { applyTheme, type Theme } from "./theme";
import {
  applyScale,
  resolveScale,
  scaleLabel,
  scaleStepDisabled,
  stepScale,
  type Scale,
} from "./scale";
import {
  anyLinkIncomplete,
  avatarAriaLabel,
  initialsFor,
  signOutUrl,
  themeToggleAriaLabel,
  themeToggleLabel,
  type ProfileLink,
} from "./usermenu-logic";

export type { ProfileLink };

/**
 * UserMenu: the Header's profile dropdown.
 *
 * Trigger: the viewer's round profile photo (or an initials badge when no
 * photo is available or it fails to load), plus the chevron. The visible
 * email is gone from the trigger, the conventional pattern for this kind of
 * menu, but the trigger keeps an accessible name via aria-label since that
 * was the only thing making the button nameable to assistive tech.
 *
 * Dropdown contents, top to bottom:
 *  1. Signed-in name (if known) and email, non-interactive. This is now the
 *     only place identity is confirmable at a glance, which matters when
 *     someone is signed in as the wrong account.
 *  2. `profileLinks`, in the order given (nothing rendered when absent/empty).
 *     A future "Dashboard" entry slots in above these without restructuring.
 *     A link with `incomplete: true` gets a small attention-coloured dot
 *     beside its label, plus visually-hidden text so the dot has a text
 *     alternative for screen readers.
 *  3. Theme toggle, as a text item labelled with the ACTION it performs.
 *  4. Display size — Smaller / Larger either side of the resolved percentage,
 *     the percentage itself being the way back to automatic.
 *  5. Sign out.
 *
 * When ANY supplied link is incomplete, the avatar trigger ALSO carries a
 * small dot at its top-right corner (see `anyLinkIncomplete` in
 * usermenu-logic.ts), folded into the trigger's own aria-label rather than
 * left as colour alone. This is the indicator that actually matters: without
 * something on the trigger itself, nobody has a reason to open the menu and
 * discover that Profile or Availability needs attention, which is the same
 * discoverability gap that made this component replace the theme icon and
 * the visible email with text in the first place.
 *
 * 🔴 The shell stays dumb about which links a viewer should see. It renders
 * exactly what it's handed and never invents a link itself. This is
 * deliberate: /me is open to all staff but /me/availability is gated to a
 * handful of people, so a link the shell invented would 404 for everyone
 * else. Consumer apps own the gating logic (see e.g. people's
 * src/lib/profile/gates.ts) and decide what goes in `profileLinks`; the
 * shell just obeys.
 */
export function UserMenu({
  email,
  name,
  image,
  authHostUrl,
  profileLinks = [],
}: {
  email: string;
  name?: string | null;
  image?: string | null;
  authHostUrl: string;
  profileLinks?: ProfileLink[];
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(null);
  // Scale and the width it resolves against. Both null/0 until mount for the
  // same reason as theme: it is settled pre-paint from the cookie by
  // CHROME_INIT_SCRIPT, and the server cannot know it.
  const [scale, setScale] = useState<Scale | null>(null);
  const [width, setWidth] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initials = initialsFor(name, email);
  const showImage = !!image && !imageFailed;
  // Drives BOTH indicators: the avatar's corner dot, and the aria-label that
  // gives it a text alternative. See usermenu-logic.ts for why an absent
  // `incomplete` field on every link (the 13-app case) reads as false here,
  // never as "unknown, assume incomplete".
  const hasIncomplete = anyLinkIncomplete(profileLinks);

  // Google's avatar URLs rotate and expire on session/token refresh: a
  // failed URL must not sour later, valid ones for the rest of this mount.
  // Without this, a stale URL A that 404s once would leave the badge stuck
  // on initials even after the session refreshes with a good URL B for the
  // same person, since imageFailed itself never clears on its own.
  useEffect(() => {
    setImageFailed(false);
  }, [image]);

  // The server can't know the active theme (it's resolved pre-paint from
  // cookie/OS by THEME_INIT_SCRIPT), so the toggle's label renders only
  // after mount, same pattern as the standalone ThemeToggle.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    setScale(resolveScale(document.documentElement.dataset.scale));
    setWidth(window.innerWidth);
  }, []);

  // ⚠️ The label names a resolved percentage, so on `auto` it is only true
  // for the current viewport — follow the resize or the menu shows a stale
  // number after the window moves between monitors. `zoom` does not affect
  // innerWidth (see scale.ts), so this cannot feed back on itself.
  useEffect(() => {
    if (!open) return;
    function onResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  // Close on outside click or Escape while open.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function signOut() {
    if (typeof window === "undefined") return;
    window.location.href = signOutUrl(authHostUrl, window.location.href);
  }

  function toggleTheme() {
    if (!theme) return;
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
    setOpen(false);
  }

  // ⛔ The menu deliberately stays OPEN on a scale step, where the theme
  // toggle closes it. Theme is one press and the result is obvious with the
  // menu shut; size is judged by pressing again, and a control that dismisses
  // itself after every press cannot be used to find the right rung.
  function step(direction: -1 | 1) {
    if (scale === null) return;
    const next = stepScale(scale, width, direction);
    applyScale(next);
    setScale(next);
  }

  function toAuto() {
    applyScale("auto");
    setScale("auto");
  }

  const itemClass =
    "block w-full px-3 py-2 text-left text-sm text-text-2 hover:bg-surface-2 hover:text-accent transition-colors";

  // Square, hairline, mono — the standard's button. Explicit pixel sizing for
  // the same reason as the avatar above: Tailwind's rem scale resolves
  // against the HOST app's root font-size, and people sets 14px.
  // cgsi-adherence-allow: accent-as-paint-class — boundary: the stepper's 1px edge on hover, framing accent ink; must clear 3:1 on white
  const stepClass =
    "flex h-[26px] w-[26px] shrink-0 items-center justify-center border border-border font-mono text-[13px] leading-none text-text-2 transition-colors hover:border-accent hover:text-accent disabled:cursor-default disabled:border-border disabled:text-text-3 disabled:hover:border-border disabled:hover:text-text-3";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={avatarAriaLabel(name, email, hasIncomplete)}
        onClick={() => setOpen((o) => !o)}
        // cgsi-adherence-allow: accent-as-paint-class — boundary: the avatar button's 1px edge on hover, framing accent ink
        className="flex items-center gap-1.5 border border-border px-1.5 py-1 text-xs text-text-2 hover:border-accent hover:text-accent transition-colors"
      >
        {/* relative wrapper exists only to anchor the incomplete dot to
            THIS element's corner, not the whole button (which also
            contains the chevron). */}
        <span className="relative inline-flex shrink-0">
          {showImage ? (
            // 🔴 Plain <img>, deliberately not next/image: the photo lives on
            // lh3.googleusercontent.com, and next/image requires a
            // remotePatterns entry in EVERY consuming app's next.config before
            // it will render an external host. A plain <img> needs no config
            // anywhere. Do not "upgrade" this to next/image; it would break
            // the other 13 apps on this shell version until each one edited
            // its own config. referrerPolicy="no-referrer" because Google's
            // CDN can reject a request carrying a referrer from an
            // unexpected origin, and this menu renders on 14 different
            // hostnames.
            <img
              src={image!}
              alt=""
              width={28}
              height={28}
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              // Arbitrary-pixel size classes, not h-7/w-7: this component
              // renders inside whichever app's DOM hosts the shell, and
              // Tailwind's rem-based scale resolves against THAT app's root
              // font-size, not a fixed 16px. people sets a 14px root font, so
              // h-7 (1.75rem) would render at 24.5px there, not the intended
              // 28px. Arbitrary-value classes compile to literal pixels and
              // stay correct regardless of the host's root size.
              className="h-[28px] w-[28px] shrink-0 object-cover"
            />
          ) : (
            // ⛔ NEUTRAL, not accent. This is the initials badge shown when
            // someone has no profile photo — an identity label, not a current
            // item, a selection or anything awaiting action, so hard rule 4
            // does not cover it. It was a permanent green mark on every screen
            // for every person without a photo, which is the largest remaining
            // decorative use of the accent in the chrome after the header rule
            // went neutral (Jeremy, 21 Oct 2026: save the bright green to draw
            // attention to things).
            <span
              aria-hidden
              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center bg-surface-2 text-[11px] font-semibold text-text-2"
            >
              {initials}
            </span>
          )}
          {hasIncomplete && (
            // Explicit pixel classes throughout, not rem-derived Tailwind
            // sizes (h-1.5/w-1.5 etc): the same host-root-font bug already
            // caught on the avatar image above (people's 14px root would
            // shrink a rem-based dot to 87.5% of the intended size). The
            // text alternative lives on the button's aria-label above, not
            // here: this dot is aria-hidden and decorative only.
            <span
              aria-hidden
              className="absolute -top-[1px] -right-[1px] h-[6px] w-[6px] bg-[var(--color-attention)]"
            />
          )}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 top-full z-50 mt-1 w-56 border border-border-strong bg-surface py-1"
        >
          <div className="truncate border-b border-border px-3 py-2 text-xs text-text-3">
            {name && (
              <div className="truncate text-sm font-medium text-text-2">{name}</div>
            )}
            {email}
          </div>

          {/* A future "Dashboard" entry belongs here, above profileLinks,
              rendered the same way, no restructuring needed. */}
          {profileLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <span className="inline-flex items-center gap-1.5">
                {link.label}
                {link.incomplete && (
                  // Same attention-coloured, explicit-pixel dot as the avatar
                  // trigger. aria-hidden because the sr-only text right
                  // after it is this dot's text alternative, not a repeat of
                  // the label.
                  <span
                    aria-hidden
                    className="inline-block h-[6px] w-[6px] shrink-0 bg-[var(--color-attention)]"
                  />
                )}
              </span>
              {link.incomplete && <span className="sr-only"> incomplete</span>}
            </a>
          ))}

          <button
            type="button"
            role="menuitem"
            onClick={toggleTheme}
            aria-label={themeToggleAriaLabel(theme)}
            className={itemClass}
          >
            {themeToggleLabel(theme)}
          </button>

          {/* Display size. Not a toggle like the theme: there are four rungs
              plus automatic, so Smaller / Larger step the ladder and the
              percentage in the middle hands the decision back to automatic.
              Writes the estate-scoped cookie, so a rung set here is the rung
              every other app opens at — which is the entire point, since
              Chrome's own zoom is stored per origin and every app in this
              estate is its own subdomain. */}
          <div className="border-t border-border px-3 py-2">
            <div
              id="cgsi-scale-label"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-3"
            >
              Display size
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => step(-1)}
                disabled={scale === null || scaleStepDisabled(scale, width, -1)}
                aria-label="Smaller"
                className={stepClass}
              >
                {/* U+2212, a real minus — a hyphen sits too high beside the plus. */}
                −
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={toAuto}
                disabled={scale === null || scale === "auto"}
                aria-describedby="cgsi-scale-label"
                aria-label={
                  scale === "auto"
                    ? `Display size automatic, ${scaleLabel(scale, width)}`
                    : `Display size ${scaleLabel(scale, width)}, back to automatic`
                }
                // min-h so the row keeps its height in the pre-mount window
                // when the label is still "" — no shift when it resolves.
                className="flex min-h-[26px] flex-1 items-center justify-center border border-transparent px-1 font-mono text-[11px] tabular-nums text-text transition-colors hover:border-border hover:text-accent disabled:cursor-default disabled:hover:border-transparent disabled:hover:text-text"
              >
                {scaleLabel(scale, width)}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => step(1)}
                disabled={scale === null || scaleStepDisabled(scale, width, 1)}
                aria-label="Larger"
                className={stepClass}
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className={`${itemClass} border-t border-border`}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
