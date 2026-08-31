import { describe, it, expect } from "vitest";
import { parseNotificationPayload, badgeText, isCacheFresh, NOTIFY_TTL_MS } from "./notifications";

describe("parseNotificationPayload", () => {
  it("passes a well-formed payload through", () => {
    expect(
      parseNotificationPayload({ count: 3, paths: { "/": 3, "/testimonials/review": 3 } }),
    ).toEqual({ count: 3, paths: { "/": 3, "/testimonials/review": 3 } });
  });

  it("reads any malformed shape as zero rather than throwing", () => {
    expect(parseNotificationPayload(null)).toEqual({ count: 0, paths: {} });
    expect(parseNotificationPayload("nope")).toEqual({ count: 0, paths: {} });
    expect(parseNotificationPayload([])).toEqual({ count: 0, paths: {} });
    expect(parseNotificationPayload({ count: "3" })).toEqual({ count: 0, paths: {} });
    expect(parseNotificationPayload({ count: NaN })).toEqual({ count: 0, paths: {} });
  });

  it("drops non-numeric and non-positive path counts", () => {
    expect(
      parseNotificationPayload({ count: 2, paths: { "/a": 2, "/b": 0, "/c": -1, "/d": "x" } }),
    ).toEqual({ count: 2, paths: { "/a": 2 } });
  });

  it("floors fractional counts and clamps negatives to zero", () => {
    expect(parseNotificationPayload({ count: 2.9, paths: {} }).count).toBe(2);
    expect(parseNotificationPayload({ count: -4, paths: {} }).count).toBe(0);
  });
});

describe("badgeText", () => {
  it("is null for zero, negative, undefined and non-finite", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(-2)).toBeNull();
    expect(badgeText(undefined)).toBeNull();
    expect(badgeText(NaN)).toBeNull();
  });

  it("renders 1-9 literally and caps at 9+", () => {
    expect(badgeText(1)).toBe("1");
    expect(badgeText(9)).toBe("9");
    expect(badgeText(10)).toBe("9+");
    expect(badgeText(140)).toBe("9+");
  });
});

describe("isCacheFresh", () => {
  it("is fresh strictly inside the TTL window", () => {
    expect(isCacheFresh(1_000, 1_000 + NOTIFY_TTL_MS - 1)).toBe(true);
    expect(isCacheFresh(1_000, 1_000 + NOTIFY_TTL_MS)).toBe(false);
  });

  it("is stale when unset or when the clock went backwards", () => {
    expect(isCacheFresh(undefined, 5_000)).toBe(false);
    // A cache stamped in the future (clock skew / restored tab) must not be
    // trusted forever — treat it as stale and refetch.
    expect(isCacheFresh(10_000, 5_000)).toBe(false);
  });
});
