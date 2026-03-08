/**
 * Gate: defaults-typed (ES004)
 * Validates that every default value is compatible with the key's declared type.
 * A default that fails its own type rule is a silent runtime bug — the validator
 * will reject the default at startup, but the developer sees no error at spec time.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

/** @param {unknown} value @param {string} type */
function conformsToType(value, type) {
  if (value === null || value === undefined) return true;
  switch (type) {
    case 'string':  return typeof value === 'string';
    case 'number':  return typeof value === 'number' || !isNaN(Number(value));
    case 'boolean': return typeof value === 'boolean' || value === 'true' || value === 'false';
    case 'port':    return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 65536;
    case 'url':     try { new URL(String(value)); return true; } catch { return false; }
    case 'email':   return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'json':    try { JSON.parse(typeof value === 'string' ? value : JSON.stringify(value)); return true; } catch { return false; }
    case 'base64':  return typeof value === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
    default: return true;
  }
}

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'env-schema-spec.json'), 'utf8'));
  const violations = [];

  for (const key of spec.envKeys) {
    if (key.default !== undefined && !conformsToType(key.default, key.type)) {
      violations.push({
        name:    key.name,
        type:    key.type,
        default: key.default,
        reason:  `default value "${key.default}" does not conform to type "${key.type}"`,
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'ES004',
      message: `${violations.length} default type mismatch(es)`,
      detail: {
        violations,
        hint: 'Fix the default value to match the declared type, or change the type to match the intended default',
      },
    };
  }

  const withDefaults = spec.envKeys.filter(k => k.default !== undefined).length;
  return {
    pass: true, code: 'ES004',
    message: `All ${withDefaults} default(s) conform to their declared types`,
  };
}
