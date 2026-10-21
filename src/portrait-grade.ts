// The mono portrait grade, and the two things it does not say.
//
// Rooms, mentors and staff are graded black and white with an editorial
// hard-flash look. Student and graduate work is NEVER treated — see the
// photography rules; the falloff and scrim belong to the graded frames only.
//
// The chain, from the brand guide:
//   grayscale(1) brightness(k) contrast(1.42) brightness(1.04)
// where k = 169 / (median luminance of LIT SKIN). Signed off for internal
// tools, Jeremy, 8 Oct 2026.
//
// ── CAUTION 1: NO HIGHLIGHT PROTECTION ───────────────────────────────────────
// k, then contrast(1.42), then brightness(1.04) clips any brightly keyed frame,
// hard. CSS filters cannot apply a shoulder, so a browser-side grade has no
// way to roll off. For baked exports (email, PNG, PDF) use scripts/
// grade_portraits.py, which adds a shoulder above a knee with slope 1 at the
// knee so values approach the ceiling asymptotically and it only ever
// compresses, never lifts.
//
// ── CAUTION 2: k IS ONLY AS GOOD AS THE BOX YOU MEASURE ──────────────────────
// The median must come from LIT SKIN ONLY — forehead and cheek. A box round
// the whole head catches hair, beard and shadow, reads low, and inflates k. One
// production frame measured 111 against a true skin value of 158, pushing k to
// 1.52 and burning out 8.7% of the frame.
//
// 🔴 JUDGE THE RESULT ON THE SKIN'S OWN DISTRIBUTION, not a whole-frame
// clipped-pixel count: skin p99 under 235, max under 245. A face can read burnt
// at 0.06% global clipping, which is why a frame-wide check passes it.

/** Target luminance for lit skin after the grade. */
export const SKIN_TARGET = 169;

/** Ceilings the graded skin must stay under. */
export const SKIN_P99_MAX = 235;
export const SKIN_MAX = 245;

/**
 * Default exposure when a portrait has not been measured.
 *
 * ⚖️ 1.0 IS "LEAVE IT ALONE", which is the right default: it cannot burn a
 * frame out, and an unmeasured portrait renders slightly off rather than
 * wrong. The standard pairs this with flagging, so the card says the frame is
 * unmeasured instead of quietly presenting a guess as a grade.
 */
export const DEFAULT_K = 1.0;

/**
 * k that would land lit skin on the target. Clamped: a measurement implying
 * k above 1.5 is almost always a bad box (hair and shadow dragging the median
 * down), and applying it burns the face out. Clamping is not a fix, which is
 * why `isSuspectK` exists to surface it.
 */
export function exposureFor(skinMedian: number): number {
  if (!Number.isFinite(skinMedian) || skinMedian <= 0) return DEFAULT_K;
  return Math.min(1.5, Math.max(0.5, SKIN_TARGET / skinMedian));
}

/**
 * Does this k look like it came from a bad measurement box?
 *
 * The production failure measured 111 for skin that was truly 158, giving
 * k = 1.52. Anything at or above 1.4 is worth a human looking at the frame
 * before it ships.
 */
export function isSuspectK(k: number): boolean {
  return k >= 1.4;
}

/** The CSS filter chain for a given exposure. */
export function gradeFilter(k: number = DEFAULT_K): string {
  return `grayscale(1) brightness(${k}) contrast(1.42) brightness(1.04)`;
}

/** Does a measured graded result clear the skin ceilings? */
export function skinWithinCeilings(p99: number, max: number): boolean {
  return p99 < SKIN_P99_MAX && max < SKIN_MAX;
}
