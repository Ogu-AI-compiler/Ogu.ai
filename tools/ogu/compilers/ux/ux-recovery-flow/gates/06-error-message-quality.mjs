/**
 * Gate URF006 — error-message-quality
 * Every failure must declare a `userMessage` (string).
 * The message must not exactly equal a generic placeholder (case-insensitive):
 * "An error occurred", "Something went wrong", "Error", "Unknown error"
 * Escape hatch: failure.genericMessageOk = true
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Exact generic placeholders (compared case-insensitively after trim)
const GENERIC_MESSAGES = new Set([
  'an error occurred',
  'something went wrong',
  'error',
  'unknown error',
]);

export async function run({ dir }) {
  const specPath = join(dir, 'recovery-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URF006',
      message: 'recovery-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'URF006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.failures) || spec.failures.length === 0) {
    return {
      pass: true,
      code: 'URF006',
      message: 'No failures to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const failure of spec.failures) {
    const label = `failure(id="${failure.id ?? 'unknown'}")`;

    // Escape hatch
    if (failure.genericMessageOk === true) continue;

    // userMessage must exist and be a non-empty string
    if (typeof failure.userMessage !== 'string' || failure.userMessage.trim() === '') {
      violations.push(`${label} missing or empty userMessage — users must receive a meaningful error message`);
      continue;
    }

    // Check for generic placeholder (case-insensitive, trimmed)
    const normalized = failure.userMessage.trim().toLowerCase();
    if (GENERIC_MESSAGES.has(normalized)) {
      violations.push(
        `${label} userMessage="${failure.userMessage}" is a generic placeholder — ` +
        'write a message that tells the user what happened and what they can do'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URF006',
      message: `${violations.length} failure(s) with missing or generic userMessage`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URF006',
    message: `error-message-quality: all ${spec.failures.length} failure(s) have specific user messages`,
  };
}
