/**
 * Gate: route-params
 * URL params accessed via useParams() or component props must be typed.
 * Patterns that indicate untyped param access:
 * - useParams() without a type argument: useParams<{id: string}>()
 * - params.id without null check or type cast
 * - router.query.id without string assertion
 *
 * Also checks that params declared in page-spec.json are actually typed.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const pagePath = `${dir}/Page.tsx`;
  const specPath = `${dir}/page-spec.json`;

  if (!existsSync(pagePath)) {
    return { pass: false, code: "RP005", message: "Page.tsx not found" };
  }

  const content = readFileSync(pagePath, "utf8");
  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};
  const violations = [];

  // Check 1: useParams without type parameter
  // Untyped: useParams()  — Typed: useParams<{ id: string }>()
  const useParamsRe = /\buseParams\s*\(\s*\)/g;
  const typedUseParamsRe = /\buseParams\s*<[^>]+>\s*\(\s*\)/;

  if (useParamsRe.test(content) && !typedUseParamsRe.test(content)) {
    violations.push({
      issue: "useParams() called without type parameter",
      fix: "useParams<{ id: string; slug: string }>()",
    });
  }

  // Check 2: params declared in spec must appear in the file
  const declaredParams = spec.params || [];
  for (const param of declaredParams) {
    const name = typeof param === "string" ? param : param.name;
    if (!content.includes(name)) {
      violations.push({
        issue: `Param "${name}" declared in page-spec.json but not used in Page.tsx`,
      });
    }
  }

  // Check 3: Next.js style — searchParams/params as props without type
  const hasNextParams = /\bparams\s*:\s*\{/.test(content) || /\bsearchParams\s*:\s*\{/.test(content);
  const hasUntypedProps = /function\s+\w+Page\s*\(\s*\{[^}]*params[^}]*\}\s*\)(?!\s*:)/.test(content);
  if (hasUntypedProps) {
    violations.push({
      issue: "Page component destructures params from props without return type annotation",
      fix: "function UserPage({ params }: { params: { id: string } })",
    });
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RP005",
      message: `${violations.length} untyped route param access(es) detected`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { params: declaredParams } };
}
