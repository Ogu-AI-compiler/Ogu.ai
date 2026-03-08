import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const middlewarePath = `${dir}/middleware.ts`;
  const tokenPath = `${dir}/token.ts`;

  if (!existsSync(middlewarePath)) {
    return { pass: false, code: "AM011", message: "middleware.ts not found" };
  }

  const middleware = readFileSync(middlewarePath, "utf8");
  const token = existsSync(tokenPath) ? readFileSync(tokenPath, "utf8") : "";
  const combined = middleware + "\n" + token;
  const violations = [];

  // Rule: require-auth-signature
  if (!/export\s+(async\s+)?function\s+requireAuth\b/.test(middleware) &&
      !/export\s+const\s+requireAuth\s*=\s*(async\s+)?\(/.test(middleware)) {
    violations.push({ rule: "require-auth-signature", message: "requireAuth not exported as async function" });
  }

  // Rule: optional-auth-signature
  if (!/export\s+(async\s+)?function\s+optionalAuth\b/.test(middleware) &&
      !/export\s+const\s+optionalAuth\s*=\s*(async\s+)?\(/.test(middleware)) {
    violations.push({ rule: "optional-auth-signature", message: "optionalAuth not exported as async function" });
  }

  // Rule: bearer-extraction — must extract from Authorization header
  const hasBearerExtraction = /authorization|Authorization/.test(middleware) &&
    (/split\s*\(\s*['"]Bearer\s/.test(middleware) || /Bearer\s/.test(middleware) || /\.startsWith\s*\(\s*['"]Bearer/.test(middleware));

  if (!hasBearerExtraction) {
    violations.push({ rule: "bearer-extraction", message: "No Bearer token extraction from Authorization header found" });
  }

  // Rule: verify-not-decode — never jwt.decode() alone
  if (/jwt\.decode\s*\(/.test(combined) && !/jwt\.verify\s*\(/.test(combined)) {
    violations.push({ rule: "verify-not-decode", message: "jwt.decode() used without jwt.verify() — signature not validated" });
  }

  // Rule: error-classes existence (check across all files)
  const errorsPath = `${dir}/errors.ts`;
  const allSrc = combined + (existsSync(errorsPath) ? readFileSync(errorsPath, "utf8") : "");
  for (const cls of ["AuthError", "TokenExpiredError", "InvalidTokenError", "MissingTokenError"]) {
    if (!new RegExp(`class\\s+${cls}\\b`).test(allSrc)) {
      violations.push({ rule: "error-classes", message: `${cls} not defined` });
    }
  }

  // Rule: env-secrets — no hardcoded string after jwt.sign/verify second argument
  if (/jwt\.(?:sign|verify)\s*\([^,]+,\s*["'`][^"'`]{8,}["'`]/.test(combined)) {
    violations.push({ rule: "env-secrets", message: "JWT secret hardcoded in jwt.sign/verify — use process.env.JWT_SECRET" });
  }

  if (violations.length) {
    return {
      pass: false,
      code: "AM011",
      message: `Auth contract: ${violations.length} violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { checked: middlewarePath } };
}
