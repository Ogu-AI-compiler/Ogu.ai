import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UCS005 — no-raw-hex: semantic color entries must reference tokens, not raw hex/rgb values */

// Matches raw CSS color values that should not appear in semantic role definitions
const RAW_COLOR_PATTERNS = [
  /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/,   // hex
  /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,               // rgb()
  /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,[\d.]+\s*\)$/,   // rgba()
  /^hsl\(/,                                                  // hsl()
];

function isRawColor(value) {
  return RAW_COLOR_PATTERNS.some(p => p.test(String(value)));
}

/**
 * Recursively collect all string values from an object along with their key paths.
 * We look at role.colors.{mode} entries in the spec.
 */
function collectRoleColorValues(role) {
  const found = [];
  if (!role.colors || typeof role.colors !== 'object') return found;

  for (const [mode, modeColors] of Object.entries(role.colors)) {
    if (typeof modeColors !== 'object') {
      // modeColors itself is the color value
      found.push({ path: `${role.id}.colors.${mode}`, value: modeColors });
      continue;
    }
    for (const [slot, val] of Object.entries(modeColors)) {
      found.push({ path: `${role.id}.colors.${mode}.${slot}`, value: val });
    }
  }

  return found;
}

export async function run({ dir }) {
  const specPath = join(dir, 'color-system-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCS005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCS005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.semanticRoles) || spec.semanticRoles.length === 0) {
    return { pass: true, code: 'UCS005', message: 'No semantic roles — gate skipped', skipped: true };
  }

  const violations = [];

  for (const role of spec.semanticRoles) {
    const colorValues = collectRoleColorValues(role);
    for (const { path, value } of colorValues) {
      if (isRawColor(value)) {
        violations.push(`${path}: raw color value "${value}" — must reference a design token`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS005',
      message: `${violations.length} semantic role(s) contain raw color values`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS005',
    message: `No raw hex/rgb values in ${spec.semanticRoles.length} semantic role(s)`,
  };
}
