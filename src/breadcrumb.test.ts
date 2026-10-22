import { describe, it, expect } from "vitest";
import { segmentKind, segmentCase, isCurrentPage } from "./breadcrumb-logic";
import { Breadcrumb } from "./Breadcrumb";

describe("segmentKind", () => {
  it("earlier item with href is a link", () => {
    expect(segmentKind({ label: "CGSI Sales", href: "/" }, 0, 2)).toBe("link");
  });

  it("earlier item without href is current-style text", () => {
    expect(segmentKind({ label: "Game Art" }, 1, 4)).toBe("current");
  });

  it("last item is current even when an href was supplied", () => {
    expect(segmentKind({ label: "Funnel", href: "/funnel" }, 1, 2)).toBe(
      "current"
    );
  });

  it("last item without href is current", () => {
    expect(segmentKind({ label: "Funnel" }, 1, 2)).toBe("current");
  });

  it("deep trail: every linked ancestor is a link, leaf is current", () => {
    // Audit / Game Art / TCPCA101 / Finding 42 — the drill-down shape
    const items = [
      { label: "Audit", href: "/" },
      { label: "Game Art", href: "/game-art" },
      { label: "TCPCA101", href: "/game-art/tcpca101" },
      { label: "Finding 42" },
    ];
    const kinds = items.map((item, i) => segmentKind(item, i, items.length));
    expect(kinds).toEqual(["link", "link", "link", "current"]);
  });

  it("single item is current", () => {
    expect(segmentKind({ label: "Home", href: "/" }, 0, 1)).toBe("current");
  });
});

describe("isCurrentPage", () => {
  it("true only on the final segment", () => {
    expect(isCurrentPage(0, 3)).toBe(false);
    expect(isCurrentPage(1, 3)).toBe(false);
    expect(isCurrentPage(2, 3)).toBe(true);
  });

  it("single-item trail: the item is the current page", () => {
    expect(isCurrentPage(0, 1)).toBe(true);
  });
});

describe("segmentCase", () => {
  it("a section crumb is uppercased — the trail is chrome", () => {
    expect(segmentCase({ label: "Conversion", href: "/conversion" })).toBe("upper");
  });

  // 🔴 "JEREMY CHINN" is the mistake the imported-text rule exists to prevent.
  it("a name or code keeps its own case", () => {
    expect(segmentCase({ label: "Jeremy Chinn", verbatim: true })).toBe("verbatim");
    expect(segmentCase({ label: "ACA-04", verbatim: true })).toBe("verbatim");
  });

  it("verbatim is the exception, so sections need no flag", () => {
    expect(segmentCase({ label: "Leadership" })).toBe("upper");
  });
});

describe("Breadcrumb", () => {
  it("renders nothing for an empty items array", () => {
    expect(Breadcrumb({ items: [] })).toBeNull();
  });
});
