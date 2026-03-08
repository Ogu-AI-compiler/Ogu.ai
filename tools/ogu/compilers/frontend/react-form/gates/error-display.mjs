/**
 * Gate: error-display
 * Validation errors must be displayed per-field in the JSX.
 * Patterns: {errors.fieldName.message}, {fieldState.error?.message}, FormMessage, ErrorMessage.
 * Fail if only console.error or alert() is used for validation errors.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const formPath = `${dir}/Form.tsx`;
  if (!existsSync(formPath)) {
    return { pass: false, code: "RF006", message: "Form.tsx not found" };
  }

  const content = readFileSync(formPath, "utf8");

  // Patterns that indicate per-field error display
  const errorDisplayPatterns = [
    /errors\.\w+\.message/,          // react-hook-form: errors.email.message
    /fieldState\.error/,              // react-hook-form controller pattern
    /<FormMessage/,                   // shadcn FormMessage
    /<ErrorMessage/,                  // react-hook-form ErrorMessage
    /\.error\??\.\s*message/,         // generic .error?.message
    /errors\[\s*['"`]\w+['"`]\s*\]/,  // errors["fieldName"]
  ];

  const hasPerFieldErrors = errorDisplayPatterns.some(re => re.test(content));

  if (!hasPerFieldErrors) {
    return {
      pass: false,
      code: "RF006",
      message: "No per-field error display found — validation errors must appear next to each field",
      detail: {
        hint: "Use {errors.fieldName?.message} or <FormMessage> next to each field input",
      },
    };
  }

  // Warn if only global error handling (console/alert) found with no per-field
  const hasOnlyGlobal = /console\.error|window\.alert/.test(content) && !hasPerFieldErrors;
  if (hasOnlyGlobal) {
    return {
      pass: false,
      code: "RF006",
      message: "Validation errors handled globally only (console/alert) — must display per-field",
    };
  }

  return { pass: true, detail: { hasPerFieldErrors: true } };
}
