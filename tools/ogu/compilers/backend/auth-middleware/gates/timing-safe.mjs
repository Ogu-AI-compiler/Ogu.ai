import { readFileSync, existsSync } from "fs";

// Patterns indicating unsafe string comparison for secrets
const UNSAFE_COMPARE = [
  { re: /apiKey\s*===\s*\w+|key\s*===\s*\w+|secret\s*===\s*\w+|token\s*===\s*\w+/, label: "=== comparison of secret/token" },
  { re: /apiKey\s*==\s*\w+|key\s*==\s*\w+|secret\s*==\s*\w+/, label: "== comparison of secret/token" },
  { re: /\.includes\s*\(\s*(?:apiKey|secret|token)\s*\)/, label: ".includes() on secret value" },
];

// Timing-safe patterns
const TIMING_SAFE_RE = /timingSafeEqual|crypto\.timingSafeEqual|safeCompare|constantTimeEqual/;

export async function run({ dir }) {
  const specPath = `${dir}/auth-spec.json`;
  const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : {};

  // Only required for API key strategy
  if (spec.strategy && !["api-key", "basic"].includes(spec.strategy)) {
    return {
      pass: true,
      detail: { note: `Strategy '${spec.strategy}' uses JWT — timing-safe comparison not required for token body` },
    };
  }

  const files = ["middleware.ts", "token.ts"]
    .map(f => `${dir}/${f}`)
    .filter(existsSync);

  if (!files.length) {
    return { pass: false, code: "AM009", message: "No implementation files found" };
  }

  const combined = files.map(f => readFileSync(f, "utf8")).join("\n");

  // For API key / basic auth, timing-safe comparison is mandatory
  if (["api-key", "basic"].includes(spec.strategy)) {
    if (!TIMING_SAFE_RE.test(combined)) {
      return {
        pass: false,
        code: "AM009",
        message: `Strategy '${spec.strategy}' requires crypto.timingSafeEqual() — string === comparison leaks timing info`,
        detail: { hint: "import { timingSafeEqual } from 'crypto'; use Buffer.from(a).equals alternative or timingSafeEqual" },
      };
    }
  }

  // Check for obviously unsafe comparisons regardless of strategy
  const violations = [];
  const lines = combined.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("//")) continue;
    for (const { re, label } of UNSAFE_COMPARE) {
      if (re.test(line)) {
        violations.push({ line: i + 1, type: label, text: line.trim() });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "AM009",
      message: `${violations.length} unsafe comparison(s) — use crypto.timingSafeEqual`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { timingSafe: TIMING_SAFE_RE.test(combined) || spec.strategy === "jwt" } };
}
