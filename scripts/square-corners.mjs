#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   Remove Tailwind corner-radius classes. Radius is 0 on everything in the 2027
   brand, and Tailwind's default IS square, so the honest expression of "square"
   is the absence of a class rather than `rounded-none` repeated 400 times.

   ── TWO WAYS THIS HAS ALREADY GONE WRONG ─────────────────────────────────────

   1. A word-boundary substitution renamed the variable in
      `const rounded = Math.round(n * 10) / 10` and broke the build. `rounded`
      is an ordinary English word and a reasonable identifier.

   2. Scanning for quoted strings generally is UNSAFE on source. An apostrophe
      in a comment — "cohort hasn't finished converting" — opens a match that
      runs to the next apostrophe, swallowing real code in between. That pass
      deleted a `rounded` identifier out of a return statement and reflowed a
      JSDoc block, in a file containing no JSX at all.

   So this matches ANCHORED on a class attribute, or on a string in which every
   token is a utility. Neither can be opened by a stray apostrophe, and neither
   can reach an identifier.

   Usage: node square-corners.mjs <dir> [--dry]
   ──────────────────────────────────────────────────────────────────────────── */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE_EXT = /\.(tsx?|jsx?|mjs|cjs)$/;
const SKIP_DIR = /^(node_modules|\.next|\.git|dist|build|coverage|out)$/;

/* Radius utilities, including the side- and corner-specific forms. */
const RADIUS_CLASS =
  /(?<=^|\s)rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee))?(?:-(?:sm|md|lg|xl|2xl|3xl|full))?(?=\s|$)/g;

/* `className="..."` / `class="..."`, double-quoted. An apostrophe cannot open
   one of these, and the attribute name anchors it to real markup. */
const CLASS_ATTR = /\b(?:className|class)\s*=\s*"([^"\n]*)"/g;

/* `className={`...`}`, interpolation allowed. Only the STATIC segments between
   ${...} are edited — the interpolated expressions are left untouched, so a
   class computed at runtime is never half-rewritten. Without this the pass
   left 47 radius classes behind in marketing alone, all of them in templates
   that happened to contain a conditional. */
const CLASS_TEMPLATE = /\b(?:className|class)\s*=\s*\{`((?:[^`\\]|\\.)*)`\}/gs;

/* Split a template body into static text and ${...} expressions, strip radius
   from the static parts only, and reassemble. Brace depth is tracked so a
   nested object or template inside the expression does not end it early. */
function stripRadiusInTemplate(body, onHit) {
  let out = "";
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf("${", i);
    if (open === -1) {
      out += stripRadius(body.slice(i), onHit, true);
      break;
    }
    out += stripRadius(body.slice(i, open), onHit, true);
    let depth = 1;
    let j = open + 2;
    while (j < body.length && depth > 0) {
      if (body[j] === "{") depth += 1;
      else if (body[j] === "}") depth -= 1;
      j += 1;
    }
    out += body.slice(open, j);
    i = j;
  }
  return out;
}

/* A double-quoted string in which EVERY token is a utility. Picks up the
   clsx()/cn() argument lists without parsing the call. Prose fails on the first
   ordinary word; swallowed code fails on punctuation. */
const CLASS_ONLY_STRING = /"([^"\n]*)"/g;
/* 🔴 A BARE LOWERCASE WORD IS NOT A UTILITY. An earlier version accepted
   /^[a-z][a-z0-9]*$/, which matches "the", "edges", "are" and "nicely" — so
   the prose string "the edges are rounded nicely" read as a class list and
   lost its adjective. A real utility carries a hyphen, a colon, a bracket or a
   slash, or else is one of the handful of bare ones Tailwind actually ships. */
const BARE_UTILITIES = new Set([
  "flex", "grid", "block", "inline", "hidden", "absolute", "relative", "fixed",
  "sticky", "static", "border", "truncate", "italic", "underline", "uppercase",
  "lowercase", "capitalize", "container", "isolate", "contents", "table",
  "transform", "transition", "visible", "invisible", "resize", "sr-only",
  "antialiased", "group", "peer", "overflow-hidden", "shrink", "grow",
]);

function isUtilityToken(token) {
  if (/^rounded(?:-|$)/.test(token)) return true;
  if (BARE_UTILITIES.has(token)) return true;
  /* Anything with utility punctuation: px-2, md:flex, bg-[var(--x)], w-1/2. */
  return /^[a-z[-]/.test(token) && /[-:[/]/.test(token);
}

function hasRadius(text) {
  RADIUS_CLASS.lastIndex = 0;
  return RADIUS_CLASS.test(text);
}

function isAllUtilities(body) {
  const tokens = body.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (!tokens.some((t) => hasRadius(t))) return false;
  return tokens.every(isUtilityToken);
}

function stripRadius(body, onHit, fragment = false) {
  const next = body.replace(RADIUS_CLASS, () => {
    onHit();
    return "";
  });
  let cleaned = next.replace(/ {2,}/g, " ");
  /* A fragment sits between interpolations, so its leading and trailing spaces
     are separating it from them and must survive. Only a whole attribute value
     gets trimmed. */
  if (!fragment) {
    if (!/^\s/.test(body)) cleaned = cleaned.replace(/^\s+/, "");
    if (!/\s$/.test(body)) cleaned = cleaned.replace(/\s+$/, "");
  }
  return cleaned;
}

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

let files = 0;
let removed = 0;

for (const path of walk(root)) {
  const before = readFileSync(path, "utf8");
  let hits = 0;
  const count = () => {
    hits += 1;
  };

  let after = before
    .replace(CLASS_ATTR, (whole, body) =>
      hasRadius(body) ? whole.replace(`"${body}"`, `"${stripRadius(body, count)}"`) : whole,
    )
    .replace(CLASS_TEMPLATE, (whole, body) =>
      hasRadius(body)
        ? whole.replace("`" + body + "`", "`" + stripRadiusInTemplate(body, count) + "`")
        : whole,
    );

  after = after.replace(CLASS_ONLY_STRING, (whole, body) =>
    isAllUtilities(body) ? `"${stripRadius(body, count)}"` : whole,
  );

  if (hits > 0) {
    removed += hits;
    files += 1;
    if (!dry) writeFileSync(path, after);
    console.log(`${dry ? "would remove" : "removed"} ${String(hits).padStart(3)}  ${relative(process.cwd(), path)}`);
  }
}

console.log(`\n${dry ? "would remove" : "removed"} ${removed} radius classes across ${files} files`);
