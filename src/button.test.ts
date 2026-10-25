import { describe, expect, test } from "vitest";
import { buttonClassName } from "./button-logic";

describe("the button register", () => {
  test("both variants sit in the tab-and-button rung: mono, 11, .14em, caps", () => {
    for (const variant of ["primary", "secondary"] as const) {
      const c = buttonClassName({ variant });
      expect(c).toContain("font-mono");
      expect(c).toContain("text-[11px]");
      expect(c).toContain("tracking-[0.14em]");
      expect(c).toContain("uppercase");
      // Square, like everything in the app layer.
      expect(c).not.toMatch(/\brounded/);
    }
  });

  test("secondary is the default: a 1px edge, no fill, and the accent only on hover", () => {
    const c = buttonClassName({});
    expect(c).toContain("border border-border");
    expect(c).toContain("bg-transparent");
    expect(c).toContain("hover:border-accent");
    expect(c).toContain("hover:text-accent");
    // The resting edge is never the accent: that is paint, not a hover.
    expect(c).not.toMatch(/(^|\s)border-accent(\s|$)/);
  });

  test("🔴 primary is the bright mark with the ink, in both themes — never bg-accent text-bg", () => {
    // --color-bg on --color-accent is 4.28:1 in light, under AA for 11px type.
    // The mark with the ink is 9.2:1 in both themes; the hover is 11.5:1.
    const c = buttonClassName({ variant: "primary" });
    expect(c).toContain("bg-accent-mark");
    expect(c).toContain("text-accent-ink");
    expect(c).toContain("hover:bg-accent-hover");
    expect(c).not.toContain("text-bg");
    expect(c).not.toContain("text-white");
    expect(c).not.toMatch(/(^|\s)bg-accent(\s|$)/);
  });

  test("md follows the density cookie; sm is chrome and does not", () => {
    expect(buttonClassName({ size: "md" })).toContain("[html[data-density='compact']_&]:h-[26px]");
    expect(buttonClassName({ size: "md" })).toContain("h-[30px]");
    const sm = buttonClassName({ size: "sm" });
    expect(sm).toContain("h-[26px]");
    expect(sm).not.toContain("data-density");
  });

  test("disabled is a cursor and the faint text, and the hover does nothing", () => {
    for (const variant of ["primary", "secondary"] as const) {
      const c = buttonClassName({ variant });
      expect(c).toContain("disabled:cursor-default");
      expect(c).toContain("disabled:text-text-3");
      expect(c).toMatch(/disabled:hover:/);
    }
  });

  test("className is appended for layout and cannot be dropped", () => {
    expect(buttonClassName({ className: "ml-auto" })).toMatch(/ ml-auto$/);
  });
});
