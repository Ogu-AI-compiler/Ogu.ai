import { readFileSync, existsSync } from "fs";

// Required status codes by route characteristics
const STATUS_PATTERNS = {
  400: [/status\s*\(\s*400\s*\)/, /statusCode\s*=\s*400/, /"status"\s*:\s*400/],
  401: [/status\s*\(\s*401\s*\)/, /statusCode\s*=\s*401/, /"status"\s*:\s*401/],
  500: [/status\s*\(\s*500\s*\)/, /statusCode\s*=\s*500/, /catch.*500/, /\.status\(500\)/],
};

export async function run({ dir }) {
  const specPath = `${dir}/route-spec.json`;
  const handlerPath = `${dir}/handler.ts`;

  if (!existsSync(handlerPath)) {
    return { pass: false, code: "AR004", message: "handler.ts not found" };
  }

  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};
  const content = readFileSync(handlerPath, "utf8");
  const missing = [];

  // Every handler must have 400 (validation error)
  if (!STATUS_PATTERNS[400].some(re => re.test(content))) {
    missing.push("400 (validation error)");
  }

  // Protected routes must have 401
  if (spec.auth && spec.auth !== "none") {
    if (!STATUS_PATTERNS[401].some(re => re.test(content))) {
      missing.push("401 (unauthorized)");
    }
  }

  // Every handler must have 500 or a catch-all
  const hasTryCatch = /try\s*\{[\s\S]*?\}\s*catch/.test(content);
  const has500 = STATUS_PATTERNS[500].some(re => re.test(content));
  if (!hasTryCatch && !has500) {
    missing.push("500 / try-catch (server error handling)");
  }

  // Check for error envelope shape: { error: string }
  const hasErrorEnvelope = /\{\s*error\s*:/.test(content) || /error:\s*["'`]/.test(content) ||
    /error:\s*\w+\.message/.test(content);
  if (!hasErrorEnvelope) {
    missing.push("error envelope { error: string }");
  }

  if (missing.length) {
    return {
      pass: false,
      code: "AR004",
      message: `Missing error handling: ${missing.join("; ")}`,
      detail: { missing },
    };
  }

  return { pass: true, detail: { hasTryCatch, has400: true, has500: true } };
}
