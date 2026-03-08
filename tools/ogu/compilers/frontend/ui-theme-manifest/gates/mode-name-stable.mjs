import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UTH006 — mode-name-stable: the semantic token names in spec.tokens are consistent
 * across all mode mappings. Each mode mapping may only contain keys that appear in
 * spec.tokens. Extra keys in a mode indicate a naming inconsistency.
 */
export async function run({ dir }) {
  const specPath = join(dir, 'theme-manifest-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTH006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTH006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const canonicalTokens = new Set(Array.isArray(spec.tokens) ? spec.tokens : []);
  const modes = Array.isArray(spec.modes) ? spec.modes : [];
  const mappings = (spec.mappings && typeof spec.mappings === 'object') ? spec.mappings : {};

  if (canonicalTokens.size === 0 || modes.length === 0) {
    return { pass: true, code: 'UTH006', message: 'No tokens or modes — gate skipped', skipped: true };
  }

  const violations = [];

  for (const mode of modes) {
    const modeMap = mappings[mode];
    if (!modeMap || typeof modeMap !== 'object') continue;

    for (const key of Object.keys(modeMap)) {
      if (!canonicalTokens.has(key)) {
        violations.push(`Mode "${mode}": key "${key}" is not in spec.tokens — this name drift will break theme switching`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTH006',
      message: `${violations.length} mode mapping(s) contain keys not in canonical token list`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UTH006',
    message: `All mode mapping keys match the ${canonicalTokens.size} canonical token names`,
  };
}
