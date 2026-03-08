import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UIT005 — semantic-aliases-only: semantic-tier tokens must use alias references, not raw values */
const ALIAS_PATTERN = /^\{(.+)\}$/;

export async function run({ dir }) {
  const specPath = join(dir, 'design-token-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UIT005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UIT005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.tokens) || spec.tokens.length === 0) {
    return { pass: true, code: 'UIT005', message: 'No tokens — gate skipped', skipped: true };
  }

  const semanticTokens = spec.tokens.filter(t => t.tier === 'semantic');
  if (semanticTokens.length === 0) {
    return {
      pass: true,
      code: 'UIT005',
      message: 'No semantic-tier tokens declared — gate skipped',
      skipped: true,
    };
  }

  const violations = [];
  for (const token of semanticTokens) {
    const value = String(token.value ?? '');
    // Allow escape hatch via annotation in spec: "rawValueOk": true
    if (token.rawValueOk === true) continue;
    if (!ALIAS_PATTERN.test(value)) {
      violations.push(`"${token.name}": raw value "${value.slice(0, 40)}" (must be an alias like {primitive.name})`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UIT005',
      message: `${violations.length} semantic token(s) contain raw values instead of alias references`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UIT005',
    message: `All ${semanticTokens.length} semantic token(s) use alias references`,
  };
}
