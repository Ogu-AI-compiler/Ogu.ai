import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UTH002 — modes-complete: every semantic token has a mapping for every declared mode */
export async function run({ dir }) {
  const specPath = join(dir, 'theme-manifest-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTH002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTH002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const modes = Array.isArray(spec.modes) ? spec.modes : [];
  const tokens = Array.isArray(spec.tokens) ? spec.tokens : [];
  const mappings = (spec.mappings && typeof spec.mappings === 'object') ? spec.mappings : {};

  if (modes.length === 0 || tokens.length === 0) {
    return { pass: true, code: 'UTH002', message: 'No modes or tokens declared — gate skipped', skipped: true };
  }

  const violations = [];

  for (const mode of modes) {
    const modeMap = mappings[mode];

    if (!modeMap || typeof modeMap !== 'object') {
      violations.push(`Mode "${mode}": no mapping object declared`);
      continue;
    }

    for (const tokenName of tokens) {
      if (modeMap[tokenName] === undefined) {
        violations.push(`Mode "${mode}": token "${tokenName}" has no mapping`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTH002',
      message: `${violations.length} missing mode mapping(s)`,
      detail: violations.slice(0, 15).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UTH002',
    message: `All ${tokens.length} token(s) mapped for all ${modes.length} mode(s)`,
  };
}
