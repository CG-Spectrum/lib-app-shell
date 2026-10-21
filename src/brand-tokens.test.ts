import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const brandCss = readFileSync(new URL("./styles/brand.css", import.meta.url), "utf8");

/* A var() reference with no fallback resolves to the guaranteed-invalid value
   when the referenced property is unset, and that poisons the whole custom
   property it sits in — the rest of the comma list never applies. A font stack
   written `var(--font-mono), "IBM Plex Mono", monospace` therefore has no
   fallback at all: every `font-family: var(--brand-mono)` inherits instead.
   --brand-mono shipped that way and rendered as body type, because nothing in
   the estate defines --font-mono. The quoted name goes inside the var(). */
describe("brand.css font stacks", () => {
  const stacks = [...brandCss.matchAll(/^\s*(--brand-(?:body|display|mono))\s*:\s*([^;]+);/gm)];

  test("all three faces are declared", () => {
    expect(stacks.map(([, name]) => name).sort()).toEqual([
      "--brand-body",
      "--brand-display",
      "--brand-mono",
    ]);
  });

  test.each(stacks.map(([, name, value]) => [name, value] as const))(
    "%s gives every var() a fallback",
    (_name, value) => {
      for (const [, ref] of value.matchAll(/var\(\s*(--[\w-]+)([^)]*)\)/g)) {
        // --brand-display legitimately chains to --brand-body, which is itself
        // always defined here. Only the next/font variables, set by the
        // consuming layout and absent on any app that forgets the className,
        // need a literal to land on.
        if (ref.startsWith("--brand-")) continue;
        expect(value).toMatch(new RegExp(`var\\(\\s*${ref}\\s*,`));
      }
    },
  );

  test("--brand-mono lands on IBM Plex Mono, not the body face", () => {
    const mono = stacks.find(([, name]) => name === "--brand-mono")?.[2] ?? "";
    expect(mono).toMatch(/var\(\s*--font-mono\s*,\s*"IBM Plex Mono"\s*\)/);
    expect(mono).toMatch(/monospace\s*$/);
  });
});
