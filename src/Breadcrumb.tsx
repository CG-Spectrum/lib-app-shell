"use client";
import { Fragment } from "react";
import {
  type BreadcrumbItem,
  segmentKind,
  segmentCase,
  isCurrentPage,
} from "./breadcrumb-logic";

const caseClass = (item: BreadcrumbItem) =>
  segmentCase(item) === "upper" ? "uppercase" : "";

/**
 * Breadcrumb — shared hierarchical page trail.
 *
 * Any number of segments; two-level is just the simple case. Items with an
 * href render as links, the last item (or any item without href) renders as
 * current-page text. Plain <a> elements (framework-agnostic — no next/link dep);
 * a server component may still render this with serializable `items`.
 *
 * `onNavigate` (optional): when provided, link segments intercept ordinary
 * clicks and call it with the segment's href instead of doing a full-page
 * navigation — so a consumer can client-route (e.g. router.replace) for
 * filter-trail breadcrumbs. Modified clicks (cmd/ctrl/shift/alt, middle-button)
 * fall through to the native anchor so "open in new tab" still works. When
 * omitted, segments are plain links exactly as before (back-compatible).
 *
 * Classes use explicit var(--color-*) arbitrary values rather than the @theme
 * shorthands so the trail is pixel-identical to the hand-rolled breadcrumbs
 * it replaces (first consumer: salesapp page headers).
 *
 * ⚖️ MONO CAPS SINCE v2.12.0. The trail was body-14 with a semibold current
 * crumb, which read as content rather than chrome. It now takes the
 * tab-and-button rung — Mono 500 · 11 · .14em · caps, the same face and
 * tracking as the eyebrow — because it is navigation and belongs in the same
 * band as the tabs (Jeremy, 22 Oct 2026). 11 rather than the eyebrow's 10
 * because a crumb is a click target. The current crumb is distinguished by
 * COLOUR, not weight: in mono caps 500 is the spec and bolding it fights the
 * tracking.
 *
 * ⚠️ A crumb with `verbatim` keeps the face and size but drops the uppercase.
 * Section names shout correctly; a person's name does not.
 */
export function Breadcrumb({
  items,
  onNavigate,
}: {
  items: BreadcrumbItem[];
  onNavigate?: (href: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-baseline gap-3 font-mono text-[11px] font-medium tracking-[0.14em]"
    >
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-[var(--color-text-3)]">/</span>}
          {segmentKind(item, i, items.length) === "link" ? (
            <a
              href={item.href}
              onClick={
                onNavigate && item.href
                  ? (e) => {
                      // Let modified clicks (new tab / new window / middle-click)
                      // use the native anchor; intercept only plain left-clicks.
                      if (
                        e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
                        e.button === 1
                      ) {
                        return;
                      }
                      e.preventDefault();
                      onNavigate(item.href!);
                    }
                  : undefined
              }
              className={`text-[var(--color-text-3)] hover:text-[var(--color-text)] ${caseClass(item)}`}
            >
              {item.label}
            </a>
          ) : (
            <span
              aria-current={isCurrentPage(i, items.length) ? "page" : undefined}
              className={`text-[var(--color-text)] ${caseClass(item)}`}
            >
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
