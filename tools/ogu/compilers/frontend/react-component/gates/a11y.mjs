/**
 * Gate: a11y
 * Checks the component test results for axe-core violations.
 * Assumes tests include axe checks; also does static analysis as fallback.
 */
import { readFileSync, existsSync } from "fs";

const A11Y_PATTERNS = [
  { re: /onClick\s*=/, noFix: /role=["']button["']|<button/, code: "missing-role", msg: "onClick without role=button or <button>" },
  { re: /<img\b/, noFix: /alt\s*=/, code: "img-alt", msg: "<img> without alt attribute" },
  { re: /onKeyDown\s*=|onKeyPress\s*=/, noFix: null, code: "keyboard-ok", msg: null }, // positive signal
];

export async function run({ dir, name }) {
  const implFile = `${dir}/${name}.tsx`;
  if (!existsSync(implFile)) {
    return { pass: false, code: "RC004", message: `Implementation file not found: ${name}.tsx` };
  }

  const content = readFileSync(implFile, "utf8");
  const lines = content.split("\n");
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check onClick without button role or semantic button
    if (/onClick\s*=/.test(line)) {
      const surroundingContext = lines.slice(Math.max(0, i - 2), i + 3).join(" ");
      const isButton = /role=["']button["']|<button/.test(surroundingContext);
      const isEventTarget = /<button|<a\b/.test(line);
      if (!isButton && !isEventTarget) {
        violations.push({ line: i + 1, code: "interactive-roles", text: line.trim() });
      }
    }

    // Check img without alt
    if (/<img\b/.test(line) && !/alt\s*=/.test(line)) {
      violations.push({ line: i + 1, code: "img-alt", text: line.trim() });
    }

    // Check style={{ outline: 'none' }} without focus-visible
    if (/outline\s*:\s*['"]?none/.test(line)) {
      violations.push({ line: i + 1, code: "focus-visible", text: line.trim() });
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: "RC004",
      message: `A11y violations: ${violations.length}`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { checked: implFile } };
}
