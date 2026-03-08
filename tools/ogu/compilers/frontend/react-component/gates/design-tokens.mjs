/**
 * Gate: design-tokens
 * Rejects hardcoded hex colors, rgb(), and raw px values in component files.
 * Only CSS custom properties (var(--...)) or token references are allowed.
 */
import { readFileSync, existsSync } from "fs";

// Patterns that indicate hardcoded values
const HEX_RE = /(?<![a-zA-Z0-9"'`])(#[0-9a-fA-F]{3,8})(?![a-zA-Z0-9])/g;
const RGB_RE = /\brgba?\s*\(/g;
const RAW_PX_RE = /(?<![a-zA-Z0-9"'`])(\d+px)(?!["'`])/g;

// Allowlist: test files, storybook, and comments are excluded
const COMMENT_RE = /\/\/.*|\/\*[\s\S]*?\*\//g;

export async function run({ dir, name, files }) {
  const toCheck = files || [`${dir}/${name}.tsx`, `${dir}/${name}.module.css`];
  const violations = [];

  for (const file of toCheck) {
    if (!existsSync(file)) continue;
    const raw = readFileSync(file, "utf8");
    // Strip comments before checking
    const content = raw.replace(COMMENT_RE, "");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if ([...line.matchAll(HEX_RE)].length > 0) {
        violations.push({ file, line: i + 1, type: "hex-color", text: line.trim() });
      }
      if (RGB_RE.test(line)) {
        violations.push({ file, line: i + 1, type: "rgb-color", text: line.trim() });
        RGB_RE.lastIndex = 0;
      }
      if ([...line.matchAll(RAW_PX_RE)].length > 0) {
        violations.push({ file, line: i + 1, type: "raw-px", text: line.trim() });
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: "RC006",
      message: `Hardcoded design values found: ${violations.length} violation(s)`,
      detail: { violations: violations.slice(0, 10) },
    };
  }

  return { pass: true, detail: { checked: toCheck.filter(f => existsSync(f)).length } };
}
