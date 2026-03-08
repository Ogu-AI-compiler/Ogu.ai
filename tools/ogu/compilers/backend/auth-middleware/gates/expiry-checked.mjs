import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const tokenPath = `${dir}/token.ts`;
  const middlewarePath = `${dir}/middleware.ts`;

  const files = [tokenPath, middlewarePath].filter(existsSync);
  if (!files.length) {
    return { pass: false, code: "AM004", message: "No token.ts or middleware.ts found" };
  }

  const combined = files.map(f => readFileSync(f, "utf8")).join("\n");
  const violations = [];

  // Violation 1: jwt.decode() used without jwt.verify()
  const hasDecodeOnly = /jwt\.decode\s*\(/.test(combined) && !/jwt\.verify\s*\(/.test(combined);
  if (hasDecodeOnly) {
    violations.push({
      type: "decode-without-verify",
      message: "jwt.decode() used without jwt.verify() — decode skips signature and expiry verification",
    });
  }

  // Violation 2: jwt.verify() called with ignoreExpiration: true
  if (/ignoreExpiration\s*:\s*true/.test(combined)) {
    violations.push({
      type: "ignore-expiration",
      message: "ignoreExpiration: true detected — token expiry must always be enforced",
    });
  }

  // Violation 3: Manual exp check missing when not using jwt.verify
  const usesJwtVerify = /jwt\.verify\s*\(/.test(combined);
  const usesManualExpCheck = /\.exp\s*[<>]|Date\.now\(\).*exp|exp.*Date\.now\(\)|expiresAt|expires_at/.test(combined);

  // If strategy is not JWT, check for manual expiry on API keys / sessions
  const specPath = `${dir}/auth-spec.json`;
  if (existsSync(specPath)) {
    const spec = JSON.parse(readFileSync(specPath, "utf8"));
    if (spec.strategy !== "jwt" && !usesManualExpCheck) {
      violations.push({
        type: "no-expiry-check",
        message: `Strategy '${spec.strategy}' has no expiry check — tokens/sessions must validate expiration`,
      });
    }
  } else if (!usesJwtVerify && !usesManualExpCheck) {
    violations.push({
      type: "no-expiry-check",
      message: "No jwt.verify() and no manual expiry check found",
    });
  }

  if (violations.length) {
    return {
      pass: false,
      code: "AM004",
      message: `Expiry not properly checked: ${violations.length} issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { usesJwtVerify, usesManualExpCheck } };
}
