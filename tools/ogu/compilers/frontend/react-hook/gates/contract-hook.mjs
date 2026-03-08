/**
 * Gate: contract-hook
 * Validates hook against structural contract:
 * - Typed return object (not `any`, not bare unknown)
 * - Async hooks expose loading + error in return
 * - Returned functions wrapped in useCallback
 * - No unhandled promise rejections (async errors caught)
 */
import { readFileSync, existsSync, readdirSync } from "fs";

export async function run({ dir }) {
  const hookFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => /^use[A-Z].+\.(ts|tsx)$/.test(f) && !f.includes(".test."))
    : [];

  if (hookFiles.length === 0) {
    return { pass: false, code: "RH011", message: "No hook file found" };
  }

  const specPath = `${dir}/hook-spec.json`;
  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};
  const isAsync = spec.async || spec.fetches;

  const violations = [];

  for (const file of hookFiles) {
    const content = readFileSync(`${dir}/${file}`, "utf8");

    // Rule: typed-return — must have a return type annotation or inferred object
    // Check: hook must return an object, not void or any
    const hasReturnType = /\)\s*:\s*\{/.test(content) || /=>\s*\{[\s\S]*return\s+\{/.test(content);
    const returnsObject = /return\s+\{/.test(content);
    if (!returnsObject) {
      // Allow tuple returns if explicitly typed
      const returnsTuple = /return\s+\[/.test(content);
      const hasTupleType = /\)\s*:\s*\[/.test(content) || /as\s+const/.test(content);
      if (!returnsTuple || !hasTupleType) {
        violations.push({ rule: "typed-return", file, message: "Hook must return a typed object or documented tuple — no implicit void or any" });
      }
    }

    // Rule: async-states — async hooks must expose loading + error
    if (isAsync) {
      const hasLoading = /\b(isLoading|loading|isPending)\b/.test(content);
      const hasError = /\b(error|isError)\b/.test(content);

      if (!hasLoading) {
        violations.push({ rule: "async-states", file, message: "Async hook missing loading state (isLoading/loading/isPending)" });
      }
      if (!hasError) {
        violations.push({ rule: "async-states", file, message: "Async hook missing error state (error/isError)" });
      }
    }

    // Rule: stable-callbacks — returned functions should use useCallback
    // Heuristic: if there's a function in the return object, useCallback should appear
    const hasReturnedFn = /return\s+\{[^}]*:\s*(?:async\s+)?\([^)]*\)\s*=>|return\s+\{[^}]*:\s*(?:async\s+)?function/.test(content);
    if (hasReturnedFn && !content.includes("useCallback")) {
      violations.push({ rule: "stable-callbacks", file, message: "Hook returns functions but uses no useCallback — consumers will get new references on every render" });
    }

    // Rule: error-boundary-compatible — async calls should be in try/catch
    if (isAsync) {
      const hasAwait = /\bawait\b/.test(content);
      const hasTryCatch = /\btry\s*\{/.test(content);
      if (hasAwait && !hasTryCatch) {
        violations.push({ rule: "error-boundary-compatible", file, message: "Async hook uses await without try/catch — unhandled rejections will propagate" });
      }
    }
  }

  const errors = violations.filter(v => ["typed-return", "async-states", "error-boundary-compatible"].includes(v.rule));

  if (errors.length) {
    return {
      pass: false,
      code: "RH011",
      message: `Hook contract: ${violations.length} violation(s)`,
      detail: { violations },
    };
  }

  if (violations.length) {
    // warnings only — still pass
    return { pass: true, detail: { warnings: violations } };
  }

  return { pass: true };
}
