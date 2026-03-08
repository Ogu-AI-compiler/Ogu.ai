import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UCS007 — mode-coverage: every semantic role has a color assignment for every declared mode */
export async function run({ dir }) {
  const specPath = join(dir, 'color-system-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCS007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCS007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const modes = Array.isArray(spec.modes) ? spec.modes : [];
  const roles = Array.isArray(spec.semanticRoles) ? spec.semanticRoles : [];

  if (modes.length === 0 || roles.length === 0) {
    return { pass: true, code: 'UCS007', message: 'No modes or roles declared — gate skipped', skipped: true };
  }

  const violations = [];

  for (const role of roles) {
    if (!role.colors || typeof role.colors !== 'object') {
      violations.push(`"${role.id}": missing colors object — no mode assignments`);
      continue;
    }

    const missingModes = modes.filter(mode => role.colors[mode] === undefined);

    if (missingModes.length > 0) {
      violations.push(
        `"${role.id}": missing color assignment for mode(s): ${missingModes.join(', ')}`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS007',
      message: `${violations.length} semantic role(s) missing mode coverage`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS007',
    message: `All ${roles.length} role(s) covered for ${modes.length} mode(s): ${modes.join(', ')}`,
  };
}
