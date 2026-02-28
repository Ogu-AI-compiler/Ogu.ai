// Formal error code registry and formatter.
// Format: OGU{gate}{sequence} — 4-digit code.
// First 2 digits = gate/phase number (01–14, 00 for general)
// Last 2 digits = specific error within that gate

const ERRORS = {
  // General (00)
  OGU0001: { gate: "general", severity: "error", message: "Missing required file: {path}" },
  OGU0002: { gate: "general", severity: "error", message: "Invalid JSON: {path} — {parseError}" },
  OGU0003: { gate: "general", severity: "error", message: "Feature {slug} not found" },

  // 01 — Doctor
  OGU0101: { gate: "01-doctor", severity: "warn", message: "Context lock stale: {file} hash mismatch" },
  OGU0102: { gate: "01-doctor", severity: "error", message: ".ogu/ directory missing or corrupted" },

  // 02 — Context
  OGU0201: { gate: "02-context", severity: "warn", message: "Spec section {heading} has no IR task coverage" },

  // 03 — Plan
  OGU0301: { gate: "03-plan", severity: "error", message: "IR output chain broken: task {id} needs {input}, not produced by any prior task or pre-existing" },
  OGU0302: { gate: "03-plan", severity: "error", message: "Unresolved IR input: {identifier} in task {id}" },
  OGU0303: { gate: "03-plan", severity: "error", message: "Duplicate IR output: {identifier} in tasks {id1} and {id2}" },
  OGU0304: { gate: "03-plan", severity: "warn", message: "Task {id} has no IR outputs (legacy format)" },
  OGU0305: { gate: "03-plan", severity: "error", message: "IR output missing from codebase: {identifier}" },

  // 04 — TODOs
  OGU0401: { gate: "04-todos", severity: "error", message: "TODO/FIXME found: {file}:{line} — {text}" },

  // 05 — UI
  OGU0501: { gate: "05-ui", severity: "error", message: "Non-functional UI element: {selector} — {reason}" },

  // 06 — Design
  OGU0601: { gate: "06-design", severity: "error", message: "Design invariant violated: {rule} — found {actual}, expected {expected}" },
  OGU0602: { gate: "06-design", severity: "warn", message: "Design rule not machine-verifiable: {rule} (skipped)" },
  OGU0603: { gate: "06-design", severity: "error", message: "Too many border-radius values: found {n}, max {max}" },
  OGU0604: { gate: "06-design", severity: "error", message: "Spacing token violation: {element} has {actual}px, nearest token {expected}px (tolerance ±2px)" },
  OGU0605: { gate: "06-design", severity: "error", message: "Inline style forbidden: {file}:{line} — {property}" },
  OGU0606: { gate: "06-runtime", severity: "error", message: "Strict mode: {detail}" },

  // 07 — Brand
  OGU0701: { gate: "07-brand", severity: "warn", message: "Brand color mismatch: {token} expected {expected}, found {actual}" },

  // 08 — Smoke
  OGU0801: { gate: "08-smoke", severity: "error", message: "Smoke test failed: {testName} — {error}" },

  // 09 — Vision
  OGU0901: { gate: "09-vision", severity: "error", message: "Critical vision assertion failed: {assertionId} — {rule}" },
  OGU0902: { gate: "09-vision", severity: "warn", message: "Non-critical vision assertion failed: {assertionId} — {rule}" },
  OGU0903: { gate: "09-vision", severity: "error", message: "Vision pass rate below threshold: {rate}% < 80%" },

  // 10 — Contracts
  OGU1001: { gate: "10-contracts", severity: "warn", message: "IR output {identifier} has no matching contract entry" },
  OGU1002: { gate: "10-contracts", severity: "warn", message: "Contract entry {key} is orphaned (no IR output references it)" },
  OGU1003: { gate: "10-contracts", severity: "error", message: "Contract violation: {contract} — {detail}" },

  // 11 — Preview
  OGU1101: { gate: "11-preview", severity: "error", message: "Preview health check failed: {url} returned {status}" },

  // 12 — Memory
  OGU1201: { gate: "12-memory", severity: "warn", message: "Memory update skipped: no new patterns detected" },

  // 13 — Spec
  OGU1301: { gate: "13-spec", severity: "error", message: "Spec hash chain broken: locked {locked} → actual {actual}, no valid SCR path" },
  OGU1302: { gate: "13-spec", severity: "error", message: "Spec section {heading} referenced by IR but missing from Spec.md" },
  OGU1303: { gate: "13-spec", severity: "warn", message: "SCR {id} exists but hash chain already complete (redundant)" },

  // 14 — Drift
  OGU1401: { gate: "14-drift", severity: "error", message: "IR output drift: {identifier} — {status}" },
  OGU1402: { gate: "14-drift", severity: "warn", message: "Untracked file: {path} not in any task's touches[]" },
  OGU1403: { gate: "14-drift", severity: "error", message: "Contract drift: {contract} — {detail}" },
  OGU1404: { gate: "14-drift", severity: "error", message: "Design token drift: {token} expected {expected}, computed {actual}" },
};

/**
 * Create a structured error object with formatted message.
 */
export function oguError(code, params = {}) {
  const template = ERRORS[code];
  if (!template) return { code, severity: "error", message: `Unknown error ${code}`, params };

  let message = template.message;
  for (const [key, value] of Object.entries(params)) {
    message = message.replace(`{${key}}`, value);
  }

  return {
    code,
    severity: template.severity,
    gate: template.gate,
    message: `${code}: ${message}`,
    params,
  };
}

/**
 * Format a list of errors into a human-readable string.
 */
export function formatErrors(errors) {
  const errs = errors.filter((e) => e.severity === "error");
  const warns = errors.filter((e) => e.severity === "warn");

  const lines = [];
  for (const e of errs) lines.push(`  \u2716 ${e.message}`);
  for (const w of warns) lines.push(`  \u26A0 ${w.message}`);
  lines.push("");
  lines.push(`${errs.length} error(s), ${warns.length} warning(s)`);

  return lines.join("\n");
}

/**
 * Check if error list contains any errors (not just warnings).
 */
export function hasErrors(errors) {
  return errors.some((e) => e.severity === "error");
}
