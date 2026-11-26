/** @jsxRuntime automatic */
/**
 * Feature highlights, rendered.
 *
 * 🔴 The label is a WORD in a SHAPE, never a hue: these assert the word, the
 * accessible name and the square chip class, not a colour.
 * ⛔ Off means absent: no provider, or an empty list, must leave the app's
 * markup byte-identical.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import {
  FeatureHighlightsProvider,
  FeatureOutline,
  WhatsNew,
  useFeatureNew,
} from "./FeatureHighlights";
import { NewLabel } from "./NewLabel";
import type { Feature } from "./feature-highlights-logic";
import * as entry from "./index";

const NOW = new Date("2026-11-26T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const f = (key: string, anchor: string, over: Partial<Feature> = {}): Feature => ({
  feature_key: key,
  permission: null,
  anchor,
  href: `/${anchor.split(".").pop()}`,
  summary: `About ${key}`,
  live_at: daysAgo(1),
  expires_at: null,
  ...over,
});

const render = (features: Feature[], children: ReactNode, over: { used?: string[]; permissions?: string[]; max?: number } = {}) =>
  renderToStaticMarkup(
    <FeatureHighlightsProvider
      features={features}
      used={over.used ?? []}
      permissions={over.permissions ?? []}
      onUsed={() => {}}
      now={NOW}
      max={over.max}
    >
      {children}
    </FeatureHighlightsProvider>,
  );

const tab = <a href="/roles">Roles</a>;

describe("NewLabel", () => {
  const html = renderToStaticMarkup(<NewLabel />);

  it("shows the word NEW in a square chip", () => {
    expect(html).toContain(">NEW<");
    expect(html).toContain('class="feature-new"');
  });

  it('is named "New feature" for assistive tech', () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="New feature"');
  });

  it("stays server-safe: no hook, no context, no 'use client'", () => {
    const code = readFileSync(new URL("./NewLabel.tsx", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/\buse[A-Z]\w*\s*\(/);
    expect(code).not.toMatch(/\bcreateContext\b/);
    expect(code).not.toContain('"use client"');
  });
});

describe("off means absent", () => {
  it("renders children bare with no provider", () => {
    expect(renderToStaticMarkup(<FeatureOutline anchor="nav.roles">{tab}</FeatureOutline>)).toBe(
      renderToStaticMarkup(tab),
    );
    expect(renderToStaticMarkup(<WhatsNew />)).toBe("");
  });

  it("renders children bare and no list when features is empty", () => {
    const html = render(
      [],
      <>
        <WhatsNew />
        <FeatureOutline anchor="nav.roles">{tab}</FeatureOutline>
      </>,
    );
    expect(html).toBe(renderToStaticMarkup(tab));
  });

  it("renders children bare once the feature is used", () => {
    const html = render([f("console.roles.grid", "nav.roles")], <FeatureOutline anchor="nav.roles">{tab}</FeatureOutline>, {
      used: ["console.roles.grid"],
    });
    expect(html).toBe(renderToStaticMarkup(tab));
  });
});

describe("FeatureOutline", () => {
  const html = render([f("console.roles.grid", "nav.roles")], <FeatureOutline anchor="nav.roles">{tab}</FeatureOutline>);

  it("wraps a new feature in the quiet outline with the NEW label", () => {
    expect(html).toContain('class="feature-outline"');
    expect(html).toContain('data-feature-anchor="nav.roles"');
    expect(html).toContain('aria-label="New feature"');
    expect(html).toContain('<a href="/roles">Roles</a>');
  });

  it("puts the label after the element, so the name reads first", () => {
    expect(html.indexOf("Roles")).toBeLessThan(html.indexOf("New feature"));
  });

  it("can be a block wrapper", () => {
    const div = render([f("console.roles.grid", "nav.roles")], <FeatureOutline anchor="nav.roles" as="div">x</FeatureOutline>);
    expect(div).toMatch(/^<div class="feature-outline"/);
  });

  it("hides a gated feature from someone without the permission", () => {
    const gated = [f("console.roles.grid", "nav.roles", { permission: "access.roles.read" })];
    expect(render(gated, <FeatureOutline anchor="nav.roles">{tab}</FeatureOutline>)).not.toContain("feature-outline");
    expect(
      render(gated, <FeatureOutline anchor="nav.roles">{tab}</FeatureOutline>, { permissions: ["access.roles.read"] }),
    ).toContain("feature-outline");
  });
});

describe("the cap, rendered", () => {
  const four = [
    f("c.one", "nav.one", { live_at: daysAgo(1) }),
    f("c.two", "nav.two", { live_at: daysAgo(2) }),
    f("c.three", "nav.three", { live_at: daysAgo(3) }),
    f("c.four", "nav.four", { live_at: daysAgo(4) }),
  ];
  const html = render(
    four,
    <>
      <WhatsNew />
      {["one", "two", "three", "four"].map((n) => (
        <FeatureOutline key={n} anchor={`nav.${n}`}>
          {n}
        </FeatureOutline>
      ))}
    </>,
  );

  it("outlines only the three newest", () => {
    expect((html.match(/class="feature-outline"/g) ?? []).length).toBe(3);
    expect(html).not.toContain('data-feature-anchor="nav.four"');
  });

  it("still lists the fourth in What's new", () => {
    expect(html).toContain("About c.four");
  });
});

describe("WhatsNew", () => {
  const features = [
    f("c.new", "nav.new", { live_at: daysAgo(1), summary: "Roles grid" }),
    f("c.old", "nav.old", { live_at: daysAgo(5), summary: "Export", href: null }),
    f("c.evil", "nav.evil", { live_at: daysAgo(6), summary: "Offsite", href: "https://evil.example" }),
  ];
  const html = render(features, <WhatsNew />);

  it("is a disclosure button naming the count in words", () => {
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("aria-controls=");
    expect(html).toContain('aria-label="What&#x27;s new: 3 new features"');
  });

  it("starts closed, with the list hidden", () => {
    expect(html).toMatch(/<ul[^>]*hidden=""/);
  });

  it("links each feature by its href, newest first", () => {
    expect(html).toContain('<a class="whats-new-item" href="/new">Roles grid</a>');
    expect(html.indexOf("Roles grid")).toBeLessThan(html.indexOf("Export"));
  });

  it("renders a feature with no href as text, not a dead link", () => {
    expect(html).toContain('<span class="whats-new-item">Export</span>');
  });

  it("never renders a link that leaves the app", () => {
    expect(html).not.toContain("evil.example");
    expect(html).toContain('<span class="whats-new-item">Offsite</span>');
  });

  it("leaves out used and unpermitted features", () => {
    const out = render(
      [...features, f("c.gated", "nav.g", { permission: "p.x", summary: "Gated" })],
      <WhatsNew />,
      { used: ["c.new"] },
    );
    expect(out).not.toContain("Roles grid");
    expect(out).not.toContain("Gated");
  });

  it("renders nothing when every feature is used", () => {
    expect(render(features, <WhatsNew />, { used: ["c.new", "c.old", "c.evil"] })).toBe("");
  });
});

describe("useFeatureNew", () => {
  function Probe({ anchor }: { anchor: string }) {
    const { isNew } = useFeatureNew(anchor);
    return <i>{isNew ? "new" : "old"}</i>;
  }

  it("is new for a highlighted anchor and not for others", () => {
    const html = render(
      [f("c.a", "nav.a")],
      <>
        <Probe anchor="nav.a" />
        <Probe anchor="nav.b" />
      </>,
    );
    expect(html).toBe("<i>new</i><i>old</i>");
  });

  it("is false outside a provider", () => {
    expect(renderToStaticMarkup(<Probe anchor="nav.a" />)).toBe("<i>old</i>");
  });
});

describe("the package entry exports the contract API", () => {
  it("exports every part", () => {
    for (const name of ["FeatureHighlightsProvider", "useFeatureNew", "NewLabel", "FeatureOutline", "WhatsNew"]) {
      expect(typeof (entry as Record<string, unknown>)[name]).toBe("function");
    }
  });
});

describe("no network of its own", () => {
  it("never fetches", () => {
    for (const file of ["./FeatureHighlights.tsx", "./NewLabel.tsx", "./feature-highlights-logic.ts"]) {
      const code = readFileSync(new URL(file, import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      expect(code).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|EventSource|WebSocket/);
    }
  });
});
