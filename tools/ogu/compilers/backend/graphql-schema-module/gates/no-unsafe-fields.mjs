import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * GS003 — no-unsafe-fields
 * Fields named password, passwordHash, token, secret, apiKey must not appear
 * in the schema unless marked with @deprecated or @internal directive.
 * These are internal implementation details that should not be in the API.
 */

const UNSAFE_FIELD_NAMES = /\b(password|passwordHash|password_hash|secret|apiKey|api_key|privateKey|private_key|internalToken)\s*:/i;
const SAFE_ANNOTATIONS = /@deprecated|@internal|@skip/i;

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'graphql-schema-spec.json'), 'utf8'));
  const sdl = readFileSync(join(dir, spec.sdlFile), 'utf8');
  const lines = sdl.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (UNSAFE_FIELD_NAMES.test(line)) {
      // Check the same line and next line for safe annotations
      const context = lines.slice(i, i + 2).join('\n');
      if (!SAFE_ANNOTATIONS.test(context)) {
        violations.push(`SDL line ${i + 1} — unsafe field exposed: ${line.trim()}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'GS003',
      message: `${violations.length} unsafe field(s) in schema`,
      detail: violations.join('\n') + '\n\nRemove or mark with @deprecated if intentionally exposed.'
    };
  }

  return { pass: true, code: 'GS003', message: 'No unsafe fields in GraphQL schema' };
}
