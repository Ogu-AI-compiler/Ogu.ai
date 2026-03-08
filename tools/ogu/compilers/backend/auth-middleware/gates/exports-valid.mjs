import { readFileSync, existsSync } from "fs";

const MIDDLEWARE_EXPORTS = ["requireAuth", "optionalAuth"];
const TOKEN_EXPORTS = ["signToken", "verifyToken"];
const ERROR_EXPORTS = ["AuthError", "TokenExpiredError", "InvalidTokenError", "MissingTokenError"];

function checkExports(content, required) {
  return required.filter(name => {
    const exportRe = new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\b|export\\s+(const|class)\\s+${name}\\b|export\\s+\\{[^}]*\\b${name}\\b`);
    return !exportRe.test(content);
  });
}

export async function run({ dir }) {
  const middlewarePath = `${dir}/middleware.ts`;
  const tokenPath = `${dir}/token.ts`;
  const errorsPath = `${dir}/errors.ts`;

  const missing = [];

  if (!existsSync(middlewarePath)) {
    missing.push("middleware.ts not found");
  } else {
    const content = readFileSync(middlewarePath, "utf8");
    const missingExports = checkExports(content, MIDDLEWARE_EXPORTS);
    missingExports.forEach(e => missing.push(`middleware.ts missing export: ${e}`));
  }

  if (!existsSync(tokenPath)) {
    missing.push("token.ts not found");
  } else {
    const content = readFileSync(tokenPath, "utf8");
    const missingExports = checkExports(content, TOKEN_EXPORTS);
    missingExports.forEach(e => missing.push(`token.ts missing export: ${e}`));
  }

  // Error classes can be in errors.ts or middleware.ts
  const errorsSrc = [errorsPath, middlewarePath].filter(existsSync).map(p => readFileSync(p, "utf8")).join("\n");
  if (errorsSrc) {
    const missingErrors = checkExports(errorsSrc, ERROR_EXPORTS);
    missingErrors.forEach(e => missing.push(`missing error class export: ${e}`));
  } else {
    missing.push("errors.ts not found and error classes not in middleware.ts");
  }

  if (missing.length) {
    return {
      pass: false,
      code: "AM002",
      message: `${missing.length} export issue(s)`,
      detail: { missing },
    };
  }

  return { pass: true, detail: { middleware: MIDDLEWARE_EXPORTS, token: TOKEN_EXPORTS, errors: ERROR_EXPORTS } };
}
