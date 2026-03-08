/**
 * Gate: error-boundary
 * Page must handle error state from its data hooks.
 * Accepts: error state check + render, ErrorBoundary wrapper, error prop from hook.
 * Rejects: page that ignores error from hook return values.
 */
import { readFileSync, existsSync } from "fs";

const ERROR_PATTERNS = [
  /\berror\b.*&&/,
  /if\s*\([^)]*\berror\b[^)]*\)\s*return/,
  /<ErrorBoundary/,
  /\berror\s*\?/,
  /isError\b/,
  /error\.message/,
  /\berror\b.*<[A-Z]/,
];

export async function run({ dir }) {
  const pagePath = `${dir}/Page.tsx`;
  const specPath = `${dir}/page-spec.json`;

  if (!existsSync(pagePath)) {
    return { pass: false, code: "RP007", message: "Page.tsx not found" };
  }

  const content = readFileSync(pagePath, "utf8");
  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};

  // Static page with no hooks — skip
  const usesHooks = /\buse[A-Z]\w+\s*\(/.test(content);
  const hasData = spec.data?.length > 0 || spec.async || usesHooks;
  if (!hasData) {
    return { pass: true, skipped: true, detail: { reason: "Static page — no error handling required" } };
  }

  const hasErrorHandling = ERROR_PATTERNS.some(re => re.test(content));

  if (!hasErrorHandling) {
    return {
      pass: false,
      code: "RP007",
      message: "No error state handling found — page must render an error UI when data hooks return errors",
      detail: {
        hint: "Add: if (error) return <ErrorMessage error={error} onRetry={refetch} />",
      },
    };
  }

  return { pass: true };
}
