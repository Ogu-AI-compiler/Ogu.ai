import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UTH001 — spec-valid: theme-manifest-spec.json exists with required structure.
 *
 * Expected shape:
 * {
 *   "modes": ["light", "dark"],
 *   "tokens": ["color.surface.default", "color.text.primary", ...],
 *   "mappings": {
 *     "light": { "color.surface.default": "{color.gray.50}", ... },
 *     "dark":  { "color.surface.default": "{color.gray.900}", ... }
 *   }
 * }
 */
export async function run({ dir }) {
  const specPath = join(dir, 'theme-manifest-spec.json');

  if (!existsSync(specPath)) {
    return { pass: false, code: 'UTH001', message: 'theme-manifest-spec.json not found', detail: `Expected at: ${specPath}` };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'UTH001', message: 'theme-manifest-spec.json is not valid JSON', detail: err.message };
  }

  const missing = ['modes', 'tokens', 'mappings'].filter(k => spec[k] === undefined);
  if (missing.length > 0) {
    return { pass: false, code: 'UTH001', message: `Missing required field(s): ${missing.join(', ')}` };
  }

  if (!Array.isArray(spec.modes) || spec.modes.length === 0) {
    return { pass: false, code: 'UTH001', message: 'modes must be a non-empty array (e.g. ["light", "dark"])' };
  }

  if (!Array.isArray(spec.tokens) || spec.tokens.length === 0) {
    return { pass: false, code: 'UTH001', message: 'tokens must be a non-empty array of semantic token names' };
  }

  if (typeof spec.mappings !== 'object' || spec.mappings === null) {
    return { pass: false, code: 'UTH001', message: 'mappings must be an object keyed by mode name' };
  }

  return {
    pass: true,
    code: 'UTH001',
    message: `Spec valid — ${spec.modes.length} mode(s), ${spec.tokens.length} token(s)`,
  };
}
