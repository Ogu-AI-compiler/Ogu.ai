/**
 * Gate: empty-state
 * Page must handle empty data — null entity, empty list, zero results.
 * A page that renders data.map(...) without checking data.length === 0
 * will show a blank section when the API returns an empty array.
 *
 * Accepts:
 * - explicit empty check: !data || data.length === 0
 * - EmptyState / Empty component
 * - "No results" / "Nothing here" text
 * - Conditional on data existence before map
 */
import { readFileSync, existsSync } from "fs";

const EMPTY_PATTERNS = [
  /\.length\s*===\s*0/,
  /\.length\s*==\s*0/,
  /!\s*\w+\s*\|\|\s*\w+\.length/,
  /<EmptyState/,
  /<Empty\b/,
  /isEmpty\b/,
  /no\s+results/i,
  /nothing\s+here/i,
  /no\s+data/i,
  /\?\s*null\s*:/,
  /\?\s*<.*empty/i,
  /\?\.\s*map/,   // optional chaining: data?.map(...)
];

export async function run({ dir }) {
  const pagePath = `${dir}/Page.tsx`;
  const specPath = `${dir}/page-spec.json`;

  if (!existsSync(pagePath)) {
    return { pass: false, code: "RP011", message: "Page.tsx not found" };
  }

  const content = readFileSync(pagePath, "utf8");
  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};

  // Only check pages that render lists or entity data
  const hasList = /\.map\s*\(/.test(content);
  const hasEntityData = spec.data?.length > 0;

  if (!hasList && !hasEntityData) {
    return { pass: true, skipped: true, detail: { reason: "No list or entity data rendered — empty state not required" } };
  }

  const hasEmptyState = EMPTY_PATTERNS.some(re => re.test(content));

  if (!hasEmptyState) {
    return {
      pass: false,
      code: "RP011",
      message: "Page renders data list but missing empty state handling",
      detail: {
        hint: "Add: if (!items || items.length === 0) return <EmptyState message='No items found' />",
      },
    };
  }

  return { pass: true };
}
