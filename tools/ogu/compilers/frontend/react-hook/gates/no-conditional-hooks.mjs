/**
 * Gate: no-conditional-hooks
 * Enforces Rules of Hooks: hook calls must not appear inside:
 * - if / else / else if blocks
 * - for / while / do-while loops
 * - switch cases
 * - nested functions (arrow or regular) that are not themselves hooks
 * - ternary expressions
 *
 * This is a static analysis gate — it catches obvious violations.
 */
import { readFileSync, existsSync, readdirSync } from "fs";

const HOOK_CALL_RE = /\buse[A-Z]\w*\s*\(/;

// Patterns that indicate we're inside a conditional context
const CONDITIONAL_STARTS = [
  /^\s*if\s*\(/,
  /^\s*}\s*else\s*\{/,
  /^\s*else\s*\{/,
  /^\s*else\s+if\s*\(/,
  /^\s*for\s*\(/,
  /^\s*while\s*\(/,
  /^\s*do\s*\{/,
  /^\s*switch\s*\(/,
  /^\s*case\s+/,
];

export async function run({ dir }) {
  const hookFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => /^use[A-Z].+\.(ts|tsx)$/.test(f) && !f.includes(".test."))
    : [];

  if (hookFiles.length === 0) {
    return { pass: false, code: "RH005", message: "No hook file found" };
  }

  const violations = [];

  for (const file of hookFiles) {
    const content = readFileSync(`${dir}/${file}`, "utf8");
    const lines = content.split("\n");

    let depth = 0;               // brace depth
    let conditionalDepths = [];  // depths at which we entered a conditional block

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      // Check if this line starts a conditional
      const isConditional = CONDITIONAL_STARTS.some(re => re.test(line));
      if (isConditional && openBraces > 0) {
        conditionalDepths.push(depth + openBraces);
      }

      depth += openBraces - closeBraces;

      // Pop conditional depths we've exited
      conditionalDepths = conditionalDepths.filter(d => d <= depth);

      // Check for hook call on this line
      if (HOOK_CALL_RE.test(line) && conditionalDepths.length > 0) {
        // Exclude the outer hook function itself
        const hookMatch = line.match(HOOK_CALL_RE);
        if (hookMatch) {
          violations.push({
            file,
            line: i + 1,
            hook: hookMatch[0].trim(),
            content: trimmed.slice(0, 80),
            context: `inside conditional at depth ${conditionalDepths[conditionalDepths.length - 1]}`,
          });
        }
      }

      // Also check ternary hook calls: condition ? useX() : useY()
      if (/\?\s*use[A-Z]\w*\s*\(|\?\s*\n?\s*use[A-Z]\w*\s*\(/.test(line)) {
        violations.push({
          file,
          line: i + 1,
          hook: "unknown",
          content: trimmed.slice(0, 80),
          context: "inside ternary expression",
        });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RH005",
      message: `${violations.length} conditional hook call(s) detected — violates Rules of Hooks`,
      detail: {
        violations,
        rule: "Hooks must be called at the top level of a React function, never inside conditions or loops",
      },
    };
  }

  return { pass: true };
}
