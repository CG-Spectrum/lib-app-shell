import type { AppEntry } from "./apps";

// Estate notifications: an app that has items awaiting human action exposes
//
//   GET /api/notifications  →  { count: number, paths: Record<string, number> }
//
// `count` is the app-level total (drives the launcher tick), `paths` maps the
// app's own nav hrefs to per-surface counts (drives that app's SubNav/section
// badges). The endpoint must be permission-scoped: report only items the
// CALLING user can act on, else staff carry a tick they can never clear.
//
// Cross-app reads work because the estate session cookie lives on
// .cgspectrum.com (same-site, so it rides a credentialed subdomain fetch) —
// but the request is still cross-ORIGIN, so the endpoint must echo the
// sibling origin in Access-Control-Allow-Origin with
// Access-Control-Allow-Credentials: true. An app without the endpoint (404,
// no CORS headers, redirect to the auth host) simply reads as zero here:
// absence of the convention is silent, never an error.

export type AppNotifications = {
  count: number;
  paths: Record<string, number>;
};

/** Defensive parse — a malformed payload reads as zero, never throws. */
export function parseNotificationPayload(json: unknown): AppNotifications {
  const empty: AppNotifications = { count: 0, paths: {} };
  if (typeof json !== "object" || json === null) return empty;
  const raw = json as { count?: unknown; paths?: unknown };
  const count =
    typeof raw.count === "number" && Number.isFinite(raw.count) && raw.count > 0
      ? Math.floor(raw.count)
      : 0;
  const paths: Record<string, number> = {};
  if (typeof raw.paths === "object" && raw.paths !== null) {
    for (const [href, n] of Object.entries(raw.paths as Record<string, unknown>)) {
      if (typeof n === "number" && Number.isFinite(n) && n > 0) paths[href] = Math.floor(n);
    }
  }
  return { count, paths };
}

/** Badge label for a count: null (no badge), "1".."9", or "9+". */
export function badgeText(count: number | undefined): string | null {
  if (count === undefined || !Number.isFinite(count) || count <= 0) return null;
  return count > 9 ? "9+" : String(Math.floor(count));
}

export const NOTIFY_TTL_MS = 60_000;
const CACHE_KEY = "cgsi-app-notifications";

type CountsCache = { at: number; counts: Record<string, number> };

/** Pure staleness rule, shared with the sessionStorage cache below. */
export function isCacheFresh(at: number | undefined, now: number, ttlMs: number = NOTIFY_TTL_MS): boolean {
  return at !== undefined && now - at >= 0 && now - at < ttlMs;
}

function readCache(now: number): Record<string, number> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CountsCache;
    if (!isCacheFresh(parsed?.at, now)) return null;
    return typeof parsed.counts === "object" && parsed.counts !== null ? parsed.counts : null;
  } catch {
    return null;
  }
}

function writeCache(counts: Record<string, number>, now: number): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: now, counts } satisfies CountsCache));
  } catch {
    // Storage unavailable (private window, quota) — counts just refetch next time.
  }
}

async function fetchAppCount(baseUrl: string, timeoutMs: number): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(new URL("/api/notifications", baseUrl).toString(), {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return 0;
    return parseNotificationPayload(await res.json()).count;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Counts for every visible app, keyed by app key. Cached in sessionStorage for
 * NOTIFY_TTL_MS so per-page-load mounts don't fan out a request storm across
 * the estate. Every failure mode is a zero.
 */
export async function loadEstateCounts(
  apps: AppEntry[],
  { now = Date.now(), timeoutMs = 4_000 }: { now?: number; timeoutMs?: number } = {},
): Promise<Record<string, number>> {
  const cached = readCache(now);
  if (cached) return cached;
  const entries = await Promise.all(
    apps.map(async (a) => [a.key, await fetchAppCount(a.url, timeoutMs)] as const),
  );
  const counts = Object.fromEntries(entries);
  writeCache(counts, now);
  return counts;
}
