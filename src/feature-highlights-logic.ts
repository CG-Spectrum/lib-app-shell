// Feature highlights: the selection logic, kept out of the React files so it
// can be tested without a DOM and so the rules live in one place.
//
// ⚖️ WHAT "NEW" MEANS. A feature is new for a person when it is published
// (live_at reached, not expired), went live within the window, has not been
// used by them, and is either ungated (permission null) or gated by a
// permission they hold. Audience is decided by ACCESS and nothing else: there
// is no course, cohort or intake targeting here, by design.
//
// ⛔ NO NETWORK. Nothing in this module or the components fetches anything.
// The app hands in the cached published list and the `fu` claim from its
// session, and records a use through its own `onUsed` callback.

export type Feature = {
  feature_key: string;
  permission: string | null;
  anchor: string;
  href: string | null;
  summary: string;
  live_at: string;
  expires_at: string | null;
};

/** What this person can do: the permission names they hold, or a predicate. */
export type FeaturePermissions = readonly string[] | ((permission: string) => boolean);

export const FEATURE_MAX_DEFAULT = 3;
export const FEATURE_WINDOW_DAYS_DEFAULT = 30;

const DAY_MS = 86_400_000;

export interface FeatureSelectionOptions {
  used: readonly string[] | ReadonlySet<string>;
  permissions: FeaturePermissions;
  now: Date;
  windowDays?: number;
  max?: number;
}

export interface FeatureSelection {
  /** Every unused new feature for this person, newest live_at first. The What's new list. */
  unused: Feature[];
  /** The first `max` of `unused`: the only ones that get an outline and a label. */
  highlighted: Feature[];
}

/** Turns either permission shape into one predicate. */
export function permissionCheck(permissions: FeaturePermissions): (p: string) => boolean {
  if (typeof permissions === "function") {
    return (p) => {
      // A predicate that throws is a predicate that said no. A highlight is
      // never worth breaking the page for.
      try {
        return permissions(p) === true;
      } catch {
        return false;
      }
    };
  }
  const held = new Set(permissions);
  return (p) => held.has(p);
}

function time(value: string | null): number {
  if (value === null) return Number.NaN;
  return Date.parse(value);
}

/** True when the feature is new for this person. See the header for the rule. */
export function isFeatureNew(
  feature: Feature,
  used: ReadonlySet<string>,
  can: (p: string) => boolean,
  now: Date,
  windowDays: number = FEATURE_WINDOW_DAYS_DEFAULT,
): boolean {
  const nowMs = now.getTime();
  const live = time(feature.live_at);
  // An unparseable live_at is not "live since the epoch"; it is not live.
  if (!Number.isFinite(live) || live > nowMs) return false;
  if (nowMs - live > windowDays * DAY_MS) return false;
  if (feature.expires_at !== null) {
    const expires = time(feature.expires_at);
    if (!Number.isFinite(expires) || expires <= nowMs) return false;
  }
  if (used.has(feature.feature_key)) return false;
  if (feature.permission !== null && !can(feature.permission)) return false;
  return true;
}

/**
 * The person's unused new features, newest first, and the capped set that is
 * highlighted. Ties on live_at break on feature_key so the order is stable
 * between server and client renders.
 */
export function selectFeatures(
  features: readonly Feature[],
  options: FeatureSelectionOptions,
): FeatureSelection {
  const used = options.used instanceof Set ? options.used : new Set(options.used as readonly string[]);
  const can = permissionCheck(options.permissions);
  const windowDays = options.windowDays ?? FEATURE_WINDOW_DAYS_DEFAULT;
  const max = Math.max(0, Math.floor(options.max ?? FEATURE_MAX_DEFAULT));

  const seen = new Set<string>();
  const unused = features
    .filter((f) => {
      // A duplicate key in the list would show the same feature twice.
      if (seen.has(f.feature_key)) return false;
      seen.add(f.feature_key);
      return isFeatureNew(f, used, can, options.now, windowDays);
    })
    .sort((a, b) => time(b.live_at) - time(a.live_at) || a.feature_key.localeCompare(b.feature_key));

  return { unused, highlighted: unused.slice(0, max) };
}

/**
 * The link the What's new list may render, or null. Only an app-relative path
 * is allowed (`/roles`), never a protocol-relative `//host`, an absolute URL
 * or a `javascript:` href: the row is staff-written data, and a link in the
 * shell header must not be able to leave the app.
 */
export function safeFeatureHref(href: string | null): string | null {
  if (typeof href !== "string") return null;
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/\\")) return null;
  return href;
}

/**
 * Records a use at most once per key, for the life of the recorder (one per
 * provider mount). The callback is read through `getOnUsed` at call time so a
 * new function identity on re-render does not reset the once-only guard.
 * A throw, or a rejected promise, is swallowed: a failed record only means
 * the mark shows again on the next load.
 */
export function createUsedRecorder(getOnUsed: () => ((featureKey: string) => unknown) | undefined) {
  const recorded = new Set<string>();
  return function record(featureKey: string): boolean {
    if (recorded.has(featureKey)) return false;
    recorded.add(featureKey);
    try {
      const result = getOnUsed()?.(featureKey);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).then(undefined, () => {});
      }
    } catch {
      // Silent by contract.
    }
    return true;
  };
}

/** The What's new trigger's accessible name, with the count as words. */
export function whatsNewLabel(count: number): string {
  return count === 1 ? "What's new: 1 new feature" : `What's new: ${count} new features`;
}
