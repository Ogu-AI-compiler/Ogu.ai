import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UTH003 — token-refs-valid: every mode mapping value is either:
 * a) a valid alias reference {token.name} that exists in the token spec, OR
 * b) a valid raw hex value (for cases where the mapping itself is a direct color)
 *
 * Cross-compiler: reads design-token-spec.json from the same dir if present.
 */
const ALIAS_PATTERN = /^\{(.+)\}$/;
const HEX_PATTERN   = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

export async function run({ dir }) {
  const specPath = join(dir, 'theme-manifest-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTH003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTH003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const mappings = (spec.mappings && typeof spec.mappings === 'object') ? spec.mappings : {};
  const modes = Array.isArray(spec.modes) ? spec.modes : [];

  if (modes.length === 0) {
    return { pass: true, code: 'UTH003', message: 'No modes — gate skipped', skipped: true };
  }

  // Try to load known tokens from design-token-spec.json for alias resolution
  let knownTokenNames = null;
  const tokenSpecPath = join(dir, 'design-token-spec.json');
  if (existsSync(tokenSpecPath)) {
    try {
      const tokenSpec = JSON.parse(readFileSync(tokenSpecPath, 'utf8'));
      if (Array.isArray(tokenSpec.tokens)) {
        knownTokenNames = new Set(tokenSpec.tokens.map(t => t.name).filter(Boolean));
      }
    } catch {
      // Non-fatal — we just skip alias resolution checks
    }
  }

  const violations = [];

  for (const mode of modes) {
    const modeMap = mappings[mode];
    if (!modeMap || typeof modeMap !== 'object') continue;

    for (const [tokenName, value] of Object.entries(modeMap)) {
      if (value === undefined || value === null) {
        violations.push(`${mode}["${tokenName}"]: null or undefined mapping value`);
        continue;
      }

      const strValue = String(value);
      const aliasMatch = ALIAS_PATTERN.exec(strValue);

      if (aliasMatch) {
        // Alias reference — verify it resolves if we have the token spec
        if (knownTokenNames && !knownTokenNames.has(aliasMatch[1])) {
          violations.push(`${mode}["${tokenName}"]: alias {${aliasMatch[1]}} not found in design-token-spec.json`);
        }
        continue;
      }

      if (HEX_PATTERN.test(strValue)) {
        // Raw hex is acceptable in theme mappings (e.g. direct mode overrides)
        continue;
      }

      // Neither alias nor hex — flag it
      violations.push(`${mode}["${tokenName}"]: value "${strValue.slice(0, 40)}" is not a token reference or hex color`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTH003',
      message: `${violations.length} invalid theme mapping value(s)`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UTH003',
    message: 'All theme mapping values are valid token references or hex colors',
  };
}
