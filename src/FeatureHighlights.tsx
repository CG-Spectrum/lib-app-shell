/** @jsxRuntime automatic */
"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NewLabel } from "./NewLabel";
import {
  FEATURE_MAX_DEFAULT,
  FEATURE_WINDOW_DAYS_DEFAULT,
  createUsedRecorder,
  safeFeatureHref,
  selectFeatures,
  whatsNewLabel,
  type Feature,
  type FeaturePermissions,
} from "./feature-highlights-logic";

// Feature highlights: a NEW label and a quiet outline on a newly live app
// feature, and a "What's new" list in the header.
//
// ⛔ NO OVERLAYS, coach marks, dimming, pointers or tours. At most `max`
// (default 3) features are highlighted at once; the rest wait in the list.
// ⛔ NO NETWORK. The app passes the cached published list and the `fu` claim
// in, and records a use through `onUsed`, which posts to its own route.
// Everything is off unless the app renders the provider with features: an
// empty list renders the children untouched and nothing else.

interface FeatureHighlightsValue {
  unused: Feature[];
  /** anchor → the highlighted feature at that anchor (newest wins). */
  byAnchor: Map<string, Feature>;
  isUsedLocally: (featureKey: string) => boolean;
  markUsed: (featureKey: string) => void;
}

const FeatureHighlightsContext = createContext<FeatureHighlightsValue | null>(null);

export interface FeatureHighlightsProviderProps {
  /** The cached published list for this app. */
  features: Feature[];
  /** Feature keys this person has used, from the session's `fu` claim. */
  used: string[];
  /** What this person can do: permission names held, or a predicate. */
  permissions: FeaturePermissions;
  /** Called once per feature key per mount when a highlight is used. Failure is silent. */
  onUsed: (featureKey: string) => void | Promise<unknown>;
  /** Pass the server's time to keep server and client renders identical. */
  now?: Date;
  max?: number;
  windowDays?: number;
  children?: ReactNode;
}

export function FeatureHighlightsProvider({
  features,
  used,
  permissions,
  onUsed,
  now,
  max = FEATURE_MAX_DEFAULT,
  windowDays = FEATURE_WINDOW_DAYS_DEFAULT,
  children,
}: FeatureHighlightsProviderProps) {
  // One clock per mount when the app gives none, so a re-render cannot move
  // a feature across the window edge mid-session.
  const [mountedAt] = useState(() => new Date());
  const at = now ?? mountedAt;

  const onUsedRef = useRef(onUsed);
  onUsedRef.current = onUsed;
  const recorderRef = useRef<ReturnType<typeof createUsedRecorder> | null>(null);
  if (recorderRef.current === null) {
    recorderRef.current = createUsedRecorder(() => onUsedRef.current);
  }

  const [usedHere, setUsedHere] = useState<ReadonlySet<string>>(() => new Set());

  // ⚖️ The highlighted set is computed from the props only, not from what was
  // used in this session. Using a highlighted feature removes its mark but
  // does NOT promote the fourth feature into the freed slot until the next
  // load: a new outline appearing elsewhere on the page mid-task is the kind
  // of movement this feature promises not to make.
  const selection = useMemo(
    () => selectFeatures(features, { used, permissions, now: at, windowDays, max }),
    [features, used, permissions, at, windowDays, max],
  );

  const markUsed = useCallback((featureKey: string) => {
    setUsedHere((prev) => {
      if (prev.has(featureKey)) return prev;
      const next = new Set(prev);
      next.add(featureKey);
      return next;
    });
    recorderRef.current!(featureKey);
  }, []);

  const value = useMemo<FeatureHighlightsValue>(() => {
    const byAnchor = new Map<string, Feature>();
    for (const f of selection.highlighted) {
      if (!byAnchor.has(f.anchor)) byAnchor.set(f.anchor, f);
    }
    return {
      unused: selection.unused.filter((f) => !usedHere.has(f.feature_key)),
      byAnchor,
      isUsedLocally: (key) => usedHere.has(key),
      markUsed,
    };
  }, [selection, usedHere, markUsed]);

  if (features.length === 0) return <>{children}</>;
  return <FeatureHighlightsContext.Provider value={value}>{children}</FeatureHighlightsContext.Provider>;
}

const NOOP = () => {};

/**
 * Whether the element at `anchor` carries a highlight for this person, and the
 * call that records its use. Outside a provider it is always `{ isNew: false }`.
 */
export function useFeatureNew(anchor: string): { isNew: boolean; markUsed(): void } {
  const ctx = useContext(FeatureHighlightsContext);
  const feature = ctx?.byAnchor.get(anchor);
  const key = feature?.feature_key;
  const isNew = !!feature && !ctx!.isUsedLocally(feature.feature_key);
  const mark = ctx?.markUsed;
  const markUsed = useCallback(() => {
    if (key && mark) mark(key);
  }, [key, mark]);
  return { isNew, markUsed: key ? markUsed : NOOP };
}

export interface FeatureOutlineProps {
  anchor: string;
  children?: ReactNode;
  /** Mark used on the first click inside the outline (default true). */
  markOnClick?: boolean;
  /** Block-level wrapper for a block element; inline by default. */
  as?: "span" | "div";
  className?: string;
}

/**
 * A quiet outline and the NEW label around the element at `anchor`, until it
 * is used. When the element is not new the children render bare, with no
 * wrapper, so an anchor tagged in an app changes nothing while the setting
 * is off or the feature has been used.
 */
export function FeatureOutline({
  anchor,
  children,
  markOnClick = true,
  as = "span",
  className = "",
}: FeatureOutlineProps) {
  const { isNew, markUsed } = useFeatureNew(anchor);
  if (!isNew) return <>{children}</>;
  const Tag = as;
  return (
    <Tag
      className={`feature-outline ${className}`.trim()}
      data-feature-anchor={anchor}
      // Capture, so a link or button inside records the use before it
      // navigates. Keyboard activation of a link or button fires click too.
      onClickCapture={markOnClick ? markUsed : undefined}
    >
      {children}
      <NewLabel />
    </Tag>
  );
}

export interface WhatsNewProps {
  /** The trigger's visible text. */
  label?: string;
  className?: string;
}

/**
 * The header's "What's new" control: this person's unused new features, each
 * linking straight to it. Renders nothing when there are none.
 *
 * ⚖️ A disclosure, not a menu. It is a short list of links; role="menu"
 * would take arrow-key handling the list does not need and hide the links
 * from a screen reader's links list.
 */
export function WhatsNew({ label = "What's new", className = "" }: WhatsNewProps) {
  const ctx = useContext(FeatureHighlightsContext);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items = ctx?.unused ?? [];
  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className={`whats-new ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        className="whats-new-trigger"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={whatsNewLabel(items.length)}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">{label}</span>
        <span aria-hidden="true" className="whats-new-count">
          {items.length}
        </span>
      </button>
      <ul id={listId} className="whats-new-list" hidden={!open} aria-label="New features">
        {items.map((f) => {
          const href = safeFeatureHref(f.href);
          return (
            <li key={f.feature_key}>
              {href ? (
                <a className="whats-new-item" href={href} onClick={() => setOpen(false)}>
                  {f.summary}
                </a>
              ) : (
                <span className="whats-new-item">{f.summary}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
