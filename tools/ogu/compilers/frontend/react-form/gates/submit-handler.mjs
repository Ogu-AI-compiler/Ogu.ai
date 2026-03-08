/**
 * Gate: submit-handler
 * Form must have a real onSubmit handler that calls the declared submitRoute.
 * A no-op (console.log, empty function, e.preventDefault() only) is a failure.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const formPath = `${dir}/Form.tsx`;
  if (!existsSync(formPath)) {
    return { pass: false, code: "RF011", message: "Form.tsx not found" };
  }

  const content = readFileSync(formPath, "utf8");

  // Must have onSubmit on a <form> element
  if (!/<form\b[^>]*onSubmit/i.test(content)) {
    return {
      pass: false,
      code: "RF011",
      message: "No <form onSubmit=...> found — form must use a native <form> element with onSubmit",
    };
  }

  // Must have handleSubmit from react-hook-form or equivalent
  const hasHandleSubmit = /handleSubmit\s*\(/.test(content);
  const hasOnSubmitFn = /(?:async\s+)?(?:function\s+)?(?:onSubmit|handleSubmit|submitForm)\s*[\(=]/.test(content);

  if (!hasHandleSubmit && !hasOnSubmitFn) {
    return {
      pass: false,
      code: "RF011",
      message: "Submit handler appears to be a no-op — must call handleSubmit() or define a real onSubmit function",
    };
  }

  // Must not be purely console.log / e.preventDefault only
  const submitFnRe = /(?:async\s+)?function\s+(?:onSubmit|handleSubmit|submitForm)\s*\([^)]*\)\s*\{([^}]+)\}/s;
  const arrowRe = /(?:onSubmit|handleSubmit|submitForm)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{([^}]+)\}/s;
  const body = (content.match(submitFnRe)?.[1] || "") + (content.match(arrowRe)?.[1] || "");

  if (body && /^\s*(console\.\w+|e\.preventDefault\(\))\s*;?\s*$/.test(body.trim())) {
    return {
      pass: false,
      code: "RF011",
      message: "Submit handler is a no-op (only console or preventDefault) — must call the submit route",
    };
  }

  // Check submitRoute from spec is referenced
  const specPath = `${dir}/form-spec.json`;
  if (existsSync(specPath)) {
    const spec = JSON.parse(readFileSync(specPath, "utf8"));
    if (spec.submitRoute) {
      // Route path or a function/api call referencing it should appear
      const routeRef = spec.submitRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(routeRef).test(content)) {
        return {
          pass: false,
          code: "RF011",
          message: `Submit handler does not reference submitRoute: "${spec.submitRoute}"`,
          detail: { submitRoute: spec.submitRoute },
        };
      }
    }
  }

  return { pass: true, detail: { hasSubmitHandler: true } };
}
