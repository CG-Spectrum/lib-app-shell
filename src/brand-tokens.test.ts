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

/* The original --brand-mono bug had two halves. The fallback sat outside the
   var(), which the tests above now catch — but the reason it mattered is that
   --font-mono was named by brand.css and set by nobody: fonts.ts exported
   display and body only, and had done since phase 2 while the comment beside
   the token said Plex would arrive "at phase 4". A token that reads a variable
   no one defines is the bug; the broken fallback only decided how loudly it
   failed. This is the half that notices. */
describe("brand.css and fonts.ts agree on what is defined", () => {
  const fontsTs = readFileSync(new URL("./fonts.ts", import.meta.url), "utf8");

  const declared = new Set(
    [...fontsTs.matchAll(/variable:\s*"(--font-[\w-]+)"/g)].map(([, v]) => v),
  );
  const referenced = new Set(
    [...brandCss.matchAll(/var\(\s*(--font-[\w-]+)/g)].map(([, v]) => v),
  );

  test("fonts.ts exports all three faces", () => {
    expect([...declared].sort()).toEqual(["--font-body", "--font-display", "--font-mono"]);
  });

  test.each([...referenced])("%s is set by a font export, not just named", (v) => {
    expect(declared).toContain(v);
  });

  test("every exported face is actually reached by a token", () => {
    // The other direction: a face loaded and never referenced is dead weight
    // downloaded on every page.
    for (const v of declared) expect(referenced).toContain(v);
  });

  test("mono ships the weights the standard asks for", () => {
    // Labels, tabs, strips and buttons are all mono 500 caps; 400 carries
    // captions and inline code. A missing 500 silently synthesises a bold.
    const block = fontsTs.slice(fontsTs.indexOf("export const mono"));
    expect(block).toMatch(/weight:\s*"400"/);
    expect(block).toMatch(/weight:\s*"500"/);
  });
});
