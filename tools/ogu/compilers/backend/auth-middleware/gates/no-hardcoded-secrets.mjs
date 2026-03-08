import { readFileSync, existsSync } from "fs";

// Patterns that indicate hardcoded secrets
const SECRET_PATTERNS = [
  // JWT secrets hardcoded as string literals
  { re: /jwt\.(?:sign|verify)\s*\([^,]+,\s*["'`][^"'`]{8,}["'`]/, label: "hardcoded JWT secret in jwt.sign/verify" },
  // Variable assigned a suspicious string that looks like a secret
  { re: /(?:secret|password|apiKey|api_key|token|private_?key)\s*[:=]\s*["'`][A-Za-z0-9+/=_\-]{12,}["'`]/, label: "hardcoded secret assignment" },
  // Common weak secrets
  { re: /["'`](?:secret|mysecret|password|changeme|supersecret|your[-_]?secret)["'`]/i, label: "common weak secret string" },
];

// Allowed patterns (env-based)
const ALLOWED = [
  /process\.env\./,
  /getSecret\s*\(/,
  /secretBroker\s*\(/,
  /vault\.get\s*\(/,
  /config\.get\s*\(/,
];

export async function run({ dir }) {
  const files = ["middleware.ts", "token.ts", "errors.ts"]
    .map(f => `${dir}/${f}`)
    .filter(existsSync);

  if (!files.length) {
    return { pass: false, code: "AM003", message: "No auth implementation files found" };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
      // Skip lines that already use env/secret broker
      if (ALLOWED.some(re => re.test(line))) continue;

      for (const { re, label } of SECRET_PATTERNS) {
        if (re.test(line)) {
          violations.push({ file, line: i + 1, type: label, text: line.trim() });
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "AM003",
      message: `${violations.length} hardcoded secret(s) detected`,
      detail: {
        violations,
        hint: "Use process.env.JWT_SECRET or a secret broker — never hardcode secrets in source",
      },
    };
  }

  return { pass: true, detail: { checked: files.length } };
}
