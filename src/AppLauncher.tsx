"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { visibleApps, type AppEntry } from "./apps";
import { pickAppsToWarm } from "./warm";
import { badgeText, loadEstateCounts } from "./notifications";

export function AppLauncher({
  catalog,
  userApps,
  currentApp,
}: {
  catalog: AppEntry[];
  userApps: string[];
  currentApp: string;
}) {
  const [open, setOpen] = useState(false);
  const lastWarm = useRef<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const apps = useMemo(
    () => visibleApps(catalog, userApps, currentApp),
    [catalog, userApps, currentApp],
  );

  // Estate notification ticks: each app that has items awaiting the user's
  // action reports a count from its /api/notifications (see notifications.ts
  // for the convention). Loaded once per mount, sessionStorage-cached for a
  // minute, and every failure mode reads as zero — an app without the
  // endpoint costs nothing and shows nothing.
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    void loadEstateCounts(apps).then((c) => {
      if (!cancelled) setCounts(c);
    });
    return () => {
      cancelled = true;
    };
  }, [apps]);
  const anyNotifications = apps.some((a) => (counts[a.key] ?? 0) > 0);

  // Close on outside click or Escape while open — same document-listener
  // pattern as UserMenu, deliberately NOT the fixed-inset-0 backdrop this
  // component used to carry.
  //
  // 🔴 A `fixed inset-0` overlay cannot work inside this Header. The header
  // sets `backdrop-blur`, and an element with a backdrop-filter becomes the
  // containing block for its fixed-position descendants, so the overlay's
  // inset-0 resolved to the 58px header strip instead of the viewport. Every
  // click in the page BELOW the header missed it and the launcher stayed open.
  // Do not reintroduce a backdrop here; it would silently break again.
  //
  // Escape also has to be a document listener: the trigger button keeps focus
  // when the menu opens, so a keydown handler on the menu element itself never
  // fires until someone tabs into it.
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

  // Opening the launcher = intent to switch: pre-fetch the other apps so the
  // click lands on a warm instance (same-site credentialed fetch warms the
  // authenticated render; throttled per app in pickAppsToWarm).
  const warm = () => {
    for (const a of pickAppsToWarm(apps, currentApp, lastWarm.current, Date.now())) {
      fetch(a.url, { mode: "no-cors", credentials: "include", cache: "no-store" }).catch(() => {});
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Switch app"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (!open) warm();
          setOpen((o) => !o);
        }}
        className="flex items-center rounded px-2 py-1 text-text-3 hover:text-accent transition-colors"
      >
        <span className="relative grid grid-cols-3 gap-0.5">
          {/* 3×3 dot grid — waffle/launcher icon */}
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="h-1 w-1 rounded-full bg-current" />
          ))}
          {anyNotifications && (
            <span
              className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-accent"
              aria-label="An app has items awaiting action"
            />
          )}
        </span>
      </button>
      {open && (
        <div
          className="absolute left-0 z-50 mt-2 w-72 rounded-lg border border-border bg-surface-2 p-2 shadow-xl"
          role="menu"
          aria-label="Switch app"
        >
          {apps.map((a) => {
            const isCurrent = a.key === currentApp;
            const badge = badgeText(counts[a.key]);
            return (
              <a
                key={a.key}
                href={a.url}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`block rounded px-3 py-2 transition-colors ${
                  isCurrent
                    ? "bg-accent-soft text-text"
                    : "text-text-2 hover:bg-surface hover:text-text"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  {a.name}
                  {badge && (
                    <span
                      className="inline-flex min-w-4 items-center justify-center rounded-full border border-accent-border bg-accent-soft px-1 text-[10px] font-bold leading-4 text-accent"
                      aria-label={`${counts[a.key]} awaiting action`}
                    >
                      {badge}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-text-3">{a.description}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
