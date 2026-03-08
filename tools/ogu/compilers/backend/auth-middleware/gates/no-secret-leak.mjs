import { readFileSync, existsSync } from "fs";

// Patterns that indicate a secret/token value being passed to a logger or thrown in a message
const LEAK_PATTERNS = [
  { re: /console\.\w+\s*\([^)]*\btoken\b[^)]*\)/, label: "token value in console.log" },
  { re: /console\.\w+\s*\([^)]*\bsecret\b[^)]*\)/, label: "secret value in console.log" },
  { re: /console\.\w+\s*\([^)]*\bcredential\b[^)]*\)/, label: "credential in console.log" },
  { re: /logger\.\w+\s*\([^)]*\btoken\b[^)]*\)/, label: "token value in logger call" },
  { re: /new\s+(?:Auth|Token|Invalid)Error\s*\(\s*`[^`]*\$\{token\}/, label: "token interpolated in error message" },
  { re: /new\s+(?:Auth|Token|Invalid)Error\s*\(\s*`[^`]*\$\{secret\}/, label: "secret interpolated in error message" },
  { re: /message\s*:\s*`[^`]*\$\{(?:token|secret|key|password)[^}]*\}/, label: "secret in error message template" },
];

// Allowlist — logging the token TYPE or error name is fine
const SAFE_PATTERNS = [
  /typeof\s+token/,
  /token\s*===\s*undefined/,
  /token\s*===\s*null/,
  /!\s*token/,
  /token\s*\?/,
];

export async function run({ dir }) {
  const files = ["middleware.ts", "token.ts", "errors.ts"]
    .map(f => `${dir}/${f}`)
    .filter(existsSync);

  if (!files.length) {
    return { pass: false, code: "AM010", message: "No auth implementation files found" };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
      if (SAFE_PATTERNS.some(re => re.test(line))) continue;

      for (const { re, label } of LEAK_PATTERNS) {
        if (re.test(line)) {
          violations.push({ file, line: i + 1, type: label, text: line.trim() });
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "AM010",
      message: `${violations.length} potential secret leak(s) in logs/errors`,
      detail: {
        violations,
        hint: "Never log token values. Log the error type or a sanitized message instead.",
      },
    };
  }

  return { pass: true, detail: { checked: files.length } };
}
