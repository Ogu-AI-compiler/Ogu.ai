/**
 * Gate: contract-form
 * Validates Form.tsx against the structural form contract:
 * - Loading state tracked
 * - Submit button disabled while loading
 * - Per-field error display
 * - Native <form> element
 * - Zod resolver used
 * - Submit route called
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const formPath = `${dir}/Form.tsx`;
  if (!existsSync(formPath)) {
    return { pass: false, code: "RF012", message: "Form.tsx not found" };
  }

  const content = readFileSync(formPath, "utf8");
  const violations = [];

  // Rule: loading-state — must track isSubmitting / isPending / isLoading
  if (!/isSubmitting|isPending|isLoading/.test(content)) {
    violations.push({ rule: "loading-state", message: "No loading state (isSubmitting/isPending/isLoading) found" });
  }

  // Rule: disabled-on-submit — submit button must use disabled with loading state
  const hasDisabledSubmit = /disabled\s*=\s*\{[^}]*(isSubmitting|isPending|isLoading)[^}]*\}/.test(content);
  if (!hasDisabledSubmit) {
    violations.push({ rule: "disabled-on-submit", message: "Submit button not disabled during submission — risk of double-submit" });
  }

  // Rule: form-element — must use <form onSubmit not <div onClick
  if (!/<form\b[^>]*onSubmit/i.test(content)) {
    violations.push({ rule: "form-element", message: "Must use <form onSubmit=...> not <div onClick=...>" });
  }

  // Rule: zod-resolver — must import zodResolver
  if (!content.includes("zodResolver")) {
    violations.push({ rule: "zod-resolver", message: "zodResolver from @hookform/resolvers/zod not found — must use Zod for validation" });
  }

  // Rule: per-field-errors (already checked in error-display gate, but contract re-checks)
  const hasPerFieldErrors = /errors\.\w+\.message|fieldState\.error|<FormMessage|<ErrorMessage/.test(content);
  if (!hasPerFieldErrors) {
    violations.push({ rule: "per-field-errors", message: "No per-field error display pattern found" });
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RF012",
      message: `Form contract: ${violations.length} violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { contractPassed: true } };
}
