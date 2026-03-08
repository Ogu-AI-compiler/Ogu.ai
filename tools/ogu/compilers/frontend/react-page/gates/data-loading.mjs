/**
 * Gate: data-loading
 * Page must render a meaningful loading state during data fetch.
 * Accepts: Suspense fallback, isLoading checks, skeleton components, or spinner.
 * Rejects: page that renders data directly with no loading branch.
 */
import { readFileSync, existsSync } from "fs";

const LOADING_PATTERNS = [
  /\bisLoading\b/,
  /\bloading\b/,
  /\bisPending\b/,
  /<Suspense\b/,
  /<Skeleton/,
  /<Spinner/,
  /<Loading/,
  /\.skeleton/i,
];

export async function run({ dir }) {
  const pagePath = `${dir}/Page.tsx`;
  const specPath = `${dir}/page-spec.json`;

  if (!existsSync(pagePath)) {
    return { pass: false, code: "RP006", message: "Page.tsx not found" };
  }

  const content = readFileSync(pagePath, "utf8");
  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};

  // If page has no data dependencies, loading state is not required
  const hasData = spec.data?.length > 0 || spec.async;
  if (!hasData) {
    const usesHooks = /\buse[A-Z]\w+\s*\(/.test(content);
    if (!usesHooks) {
      return { pass: true, skipped: true, detail: { reason: "Static page — no data loading required" } };
    }
  }

  const hasLoadingState = LOADING_PATTERNS.some(re => re.test(content));

  if (!hasLoadingState) {
    return {
      pass: false,
      code: "RP006",
      message: "No loading state found — page must render a skeleton/spinner/Suspense while data loads",
      detail: {
        hint: "Add: if (isLoading) return <PageSkeleton /> — before rendering data",
      },
    };
  }

  // Check it's actually in JSX (not just a variable declaration)
  const hasLoadingInJsx =
    /return\s*\([^)]*(?:isLoading|loading|isPending|Suspense|Skeleton|Spinner)/s.test(content) ||
    /if\s*\([^)]*(?:isLoading|loading|isPending)[^)]*\)\s*return/.test(content);

  if (!hasLoadingInJsx) {
    return {
      pass: false,
      code: "RP006",
      message: "Loading state variable exists but is not used in JSX render — must conditionally render loading UI",
    };
  }

  return { pass: true };
}
