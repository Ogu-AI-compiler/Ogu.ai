import { readFileSync, existsSync } from "fs";

// These are the typed error classes that must exist
const REQUIRED_ERROR_CLASSES = ["AuthError", "TokenExpiredError", "InvalidTokenError", "MissingTokenError"];

// Patterns that indicate throwing a generic Error in auth context
const GENERIC_THROW_RE = /throw\s+new\s+Error\s*\(/g;

// Patterns that indicate auth-related context
const AUTH_CONTEXT_RE = /token|auth|credential|permission|unauthorized|forbidden/i;

export async function run({ dir }) {
  const errorsPath = `${dir}/errors.ts`;
  const middlewarePath = `${dir}/middleware.ts`;

  const sources = [errorsPath, middlewarePath].filter(existsSync);
  if (!sources.length) {
    return { pass: false, code: "AM006", message: "No errors.ts or middleware.ts found" };
  }

  const combined = sources.map(f => readFileSync(f, "utf8")).join("\n");
  const violations = [];

  // Check all required error classes are defined
  for (const cls of REQUIRED_ERROR_CLASSES) {
    const classRe = new RegExp(`class\\s+${cls}\\b`);
    if (!classRe.test(combined)) {
      violations.push({ type: "missing-class", message: `${cls} class not defined` });
    }
  }

  // Check that AuthError extends Error
  if (/class\s+AuthError\b/.test(combined) && !/class\s+AuthError\s+extends\s+Error/.test(combined)) {
    violations.push({ type: "bad-inheritance", message: "AuthError must extend Error" });
  }

  // Check for generic Error throws in auth context
  const middlewareContent = existsSync(middlewarePath) ? readFileSync(middlewarePath, "utf8") : "";
  const lines = middlewareContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/throw\s+new\s+Error\s*\(/.test(line)) {
      // Check surrounding context for auth-related code
      const ctx = lines.slice(Math.max(0, i - 3), i + 4).join(" ");
      if (AUTH_CONTEXT_RE.test(ctx)) {
        violations.push({
          type: "generic-error",
          message: `Line ${i + 1}: generic Error thrown in auth context — use AuthError, TokenExpiredError, etc.`,
          text: line.trim(),
        });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "AM006",
      message: `${violations.length} typed error issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { errorClasses: REQUIRED_ERROR_CLASSES } };
}
