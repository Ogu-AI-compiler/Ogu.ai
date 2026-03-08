/**
 * Gate: contract-page
 * Validates Page.tsx against the structural page contract:
 * - Uses layout component
 * - No raw fetch() in component body or useEffect
 * - Auth guard if spec.auth !== 'none'
 * - Error recovery action (Retry button or back link)
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const pagePath = `${dir}/Page.tsx`;
  const specPath = `${dir}/page-spec.json`;

  if (!existsSync(pagePath)) {
    return { pass: false, code: "RP012", message: "Page.tsx not found" };
  }

  const content = readFileSync(pagePath, "utf8");
  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};
  const violations = [];

  // Rule: uses-layout
  if (spec.layout && spec.layout !== "none") {
    const layoutName = spec.layout.split("/").pop().replace(/\.(tsx?|jsx?)$/, "");
    if (!content.includes(layoutName) && !content.includes("Layout")) {
      violations.push({ rule: "uses-layout", message: `Layout "${spec.layout}" not used in Page.tsx` });
    }
  }

  // Rule: no-raw-fetch — fetch() in component body or useEffect (not in hooks)
  // We check for fetch( that appears outside of a use* function definition
  const lines = content.split("\n");
  let insideHookDef = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/function\s+use[A-Z]|const\s+use[A-Z]\w*\s*=/.test(line)) insideHookDef = true;
    if (insideHookDef && /^\}/.test(line)) insideHookDef = false;

    if (!insideHookDef && /\bfetch\s*\(/.test(line) && !line.trimStart().startsWith("//")) {
      violations.push({
        rule: "no-raw-fetch",
        message: `Raw fetch() call at line ${i + 1} — data fetching must go through compiled hooks`,
      });
    }
  }

  // Rule: auth-guard — if spec.auth !== 'none', page must redirect or check auth
  if (spec.auth && spec.auth !== "none") {
    const hasAuthGuard =
      /useAuth\s*\(|useSession\s*\(|isAuthenticated|router\.replace|router\.push.*login|redirect\s*\(|notFound\s*\(/.test(content);
    if (!hasAuthGuard) {
      violations.push({
        rule: "auth-guard",
        message: `Page requires auth="${spec.auth}" but no auth guard detected (useAuth, useSession, redirect, router.replace)`,
      });
    }
  }

  // Rule: error-recovery — error state must have retry or back link
  const hasError = /error\b.*&&|if\s*\([^)]*error[^)]*\)\s*return|<ErrorBoundary/.test(content);
  if (hasError) {
    const hasRecovery = /retry|Retry|onRetry|refetch|router\.back|href.*\/|Link\b/.test(content);
    if (!hasRecovery) {
      violations.push({
        rule: "error-recovery",
        message: "Error state rendered but no recovery action (Retry button or back link) found",
      });
    }
  }

  const errors = violations.filter(v =>
    ["uses-layout", "no-raw-fetch", "auth-guard", "error-recovery"].includes(v.rule)
  );

  if (errors.length) {
    return {
      pass: false,
      code: "RP012",
      message: `Page contract: ${violations.length} violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true };
}
