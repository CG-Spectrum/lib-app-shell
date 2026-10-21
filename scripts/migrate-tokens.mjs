#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   The token half of a 2027 migration, for the transforms that proved out on
   courseapp, marketing and studentportal. Run it, then read the diff and the
   remaining adherence findings — it deliberately does NOT touch anything
   needing judgement.

   ── WHAT IT DOES ─────────────────────────────────────────────────────────────
   - --color-accent-soft      → --color-accent-tint   (the surviving fill)
   - status -soft fills       → --color-surface-2     (a status is a glyph and
                                                        a word; the hue stays on
                                                        the border and the text)
   - var(--token, #hex)       → var(--token)          (dead fallbacks, where the
                                                        token exists in brand.css)
   - border-radius: <n>       → border-radius: 0
   - box-shadow: <outer>      → box-shadow: none      (inset survives: it draws
                                                        the selected-row rule)

   ── WHAT IT DOES NOT DO, ON PURPOSE ──────────────────────────────────────────
   ⛔ Discipline and category colours. Every one so far needed a check that the
      thing was NAMED in text beside the colour before the hue could go, and
      twice the answer changed what to do (charts got a dash ladder and marker
      shapes instead). A script cannot read markup for that.
   ⛔ Chart series palettes. The series budget is two, measured; over that you
      need another channel, and which channel is free differs per chart.
   ⛔ Raw hex generally. Some is a third-party logo, some is email HTML, some is
      an accessibility accommodation, and some is just wrong. Only a reader can
      tell those apart.
   ⛔ Tailwind corner classes — that is square-corners.mjs, which has its own
      hard-won rules about not editing identifiers or prose.

   Usage: node migrate-tokens.mjs <dir> [--dry]
   ──────────────────────────────────────────────────────────────────────────── */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE_EXT = /\.(tsx?|jsx?|mjs|cjs|css|scss)$/;
const SKIP_DIR = /^(node_modules|\.next|\.git|dist|build|coverage|out)$/;
const EXEMPT = (p) => /email/i.test(p) || /\.(test|spec)\.[tj]sx?$/.test(p);

/* Tokens that exist in brand.css, so a hex fallback beside them is dead weight
   freezing a 2025 value into a file nobody will revisit. */
const LIVE_TOKENS =
  "color-(?:bg|surface|surface-2|surface-3|border|border-strong|text|text-2|text-3|accent|accent-border|accent-mark|accent-tint|good|warn|bad|info|attention|success|warning|error|danger|card|card-border|text-dim|series-1|series-2)(?:-border)?";

const EDITS = [
  {
    id: "accent-tint",
    re: /--color-accent-soft\b/g,
    to: "--color-accent-tint",
  },
  {
    id: "status-fill",
    re: /var\(--color-(?:good|warn|bad|success|warning|error)-soft\)/g,
    to: "var(--color-surface-2)",
  },
  {
    id: "dead-fallback",
    re: new RegExp(`var\\((--${LIVE_TOKENS}),\\s*#[0-9a-fA-F]{3,8}\\)`, "g"),
    to: "var($1)",
  },
  {
    id: "square-corners",
    /* The lookahead holds the optional whitespace. Written `:\s*(?!0)` the
       `\s*` backtracks to zero width and the lookahead tests the SPACE, so
       `border-radius: 0` matches itself. That bug shipped twice. */
    re: /border-radius\s*:(?!\s*(?:0\b|0px|0%))[^;}\n]+/g,
    to: "border-radius: 0",
  },
  {
    id: "drop-shadow",
    /* 🔴 `inset\b` FAILS ON TAILWIND'S UNDERSCORE SYNTAX. In
       `[box-shadow:inset_3px_0_0_var(--x)]` the colon is followed by
       `inset_3px`, and `_` is a word character, so there is no boundary after
       `inset` and the lookahead passes. This rule then replaced the very inset
       shadow it exists to protect, and `[^;}\n]+` ate the closing quote with
       it. Broke auditapp's selected-row rule.
       `(?![a-z0-9-])` allows `_` to follow; `[^;}\n\]"']` stops at a bracket
       or quote so an arbitrary-value class can never be truncated. */
    re: /box-shadow\s*:(?!\s*(?:none|inset)(?![a-z0-9-]))[^;}\n\]"']+/g,
    to: "box-shadow: none",
  },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.test(name)) continue;
    const path = join(dir, name);
    const s = statSync(path);
    if (s.isDirectory()) walk(path, out);
    else if (SOURCE_EXT.test(name)) out.push(path);
  }
  return out;
}

const dry = process.argv.includes("--dry");
const root = process.argv[2] ?? "src";
const totals = new Map();
let files = 0;

for (const path of walk(root)) {
  if (EXEMPT(path)) continue;
  const before = readFileSync(path, "utf8");
  let after = before;
  const perFile = [];

  for (const edit of EDITS) {
    /* A pragma'd line is a recorded decision; do not quietly undo it. */
    let hits = 0;
    after = after
      .split("\n")
      .map((line, i, lines) => {
        const prev = lines[i - 1] ?? "";
        if (/cgsi-adherence-allow:/.test(line) || /cgsi-adherence-allow:/.test(prev)) return line;
        return line.replace(edit.re, (...m) => {
          hits += 1;
          return edit.to.replace("$1", m[1] ?? "");
        });
      })
      .join("\n");
    if (hits > 0) {
      perFile.push(`${edit.id}:${hits}`);
      totals.set(edit.id, (totals.get(edit.id) ?? 0) + hits);
    }
  }

  if (after !== before) {
    files += 1;
    if (!dry) writeFileSync(path, after);
    console.log(`${relative(process.cwd(), path)}  ${perFile.join(" ")}`);
  }
}

console.log(`\n${dry ? "would change" : "changed"} ${files} files`);
for (const [id, n] of totals) console.log(`  ${id.padEnd(16)} ${n}`);
