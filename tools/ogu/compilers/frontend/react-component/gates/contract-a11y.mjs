/**
 * Gate: contract-a11y
 * Validates component against a11y.contract.json rules via static analysis.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir, name }) {
  const implPath = `${dir}/${name}.tsx`;
  if (!existsSync(implPath)) {
    return { pass: false, code: "RC009", message: `${name}.tsx not found` };
  }

  const content = readFileSync(implPath, "utf8");
  const lines = content.split("\n");
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Rule: img-alt
    if (/<img\b/.test(line) && !/alt\s*=/.test(line)) {
      violations.push({ rule: "img-alt", line: lineNum, text: line.trim() });
    }

    // Rule: interactive-roles — div/span with onClick needs role
    if (/<(div|span)\b[^>]*onClick/.test(line)) {
      const ctx = lines.slice(Math.max(0, i - 1), i + 2).join(" ");
      if (!/role=["']button["']/.test(ctx)) {
        violations.push({ rule: "interactive-roles", line: lineNum, text: line.trim() });
      }
    }

    // Rule: keyboard-handler — if onClick without onKeyDown check
    if (/onClick\s*=/.test(line)) {
      const ctx = lines.slice(Math.max(0, i - 3), i + 4).join(" ");
      const isNativeButton = /<button|<a\b/.test(ctx);
      const hasKeyHandler = /onKeyDown|onKeyPress|onKeyUp/.test(ctx);
      if (!isNativeButton && !hasKeyHandler) {
        violations.push({ rule: "keyboard-handler", line: lineNum, text: line.trim() });
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: "RC009",
      message: `A11y contract: ${violations.length} violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { checked: implPath } };
}
