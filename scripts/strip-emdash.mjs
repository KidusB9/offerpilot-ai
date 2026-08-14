/* Remove em/en dashes from content files with readable replacements.
 * Usage: node scripts/strip-emdash.mjs <path> [<path> ...]
 * A path may be a file or a directory (recursed). Only .html/.json/.js/.css/.md are touched.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const EXT = new Set([".html", ".json", ".js", ".css", ".md", ".txt"]);

function strip(s) {
  return s
    // numeric / price ranges: "$118,750 — $150,000" -> "$118,750 to $150,000"
    .replace(/(\$?\d[\d,.]*)\s*[—–]\s*(\$?\d)/g, "$1 to $2")
    // spaced dash joining clauses -> comma
    .replace(/\s+[—–]\s+/g, ", ")
    // any remaining dash char -> hyphen
    .replace(/[—–]/g, "-")
    // tidy accidental double punctuation / space-before-comma
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",");
}

function walk(p, acc) {
  const st = statSync(p);
  if (st.isDirectory()) { for (const f of readdirSync(p)) walk(join(p, f), acc); }
  else if (EXT.has(extname(p))) acc.push(p);
  return acc;
}

const inputs = process.argv.slice(2);
if (!inputs.length) { console.error("give at least one path"); process.exit(1); }

let files = [];
for (const i of inputs) walk(i, files);

let changed = 0, dashesGone = 0;
for (const f of files) {
  const before = readFileSync(f, "utf8");
  const dcount = (before.match(/[—–]/g) || []).length;
  if (!dcount) continue;
  const after = strip(before);
  writeFileSync(f, after);
  changed++; dashesGone += dcount;
  console.log(`  ${dcount.toString().padStart(3)} dashes  ${f.replace(/.*[\\/]web[\\/]/, "")}`);
}
console.log(`\n✔ ${changed} files cleaned, ${dashesGone} dashes removed`);
