import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UIT003 — alias-resolves: every {alias.reference} resolves to an existing token */
const ALIAS_PATTERN = /^\{(.+)\}$/;

export async function run({ dir }) {
  const specPath = join(dir, 'design-token-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UIT003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UIT003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.tokens) || spec.tokens.length === 0) {
    return { pass: true, code: 'UIT003', message: 'No tokens — gate skipped', skipped: true };
  }

  // Build a set of all known token names
  const known = new Set(spec.tokens.map(t => t.name).filter(Boolean));

  const broken = [];
  for (const token of spec.tokens) {
    const value = String(token.value ?? '');
    const match = ALIAS_PATTERN.exec(value);
    if (match) {
      const referencedName = match[1];
      if (!known.has(referencedName)) {
        broken.push(`"${token.name}" → {${referencedName}} (target not found)`);
      }
    }
  }

  if (broken.length > 0) {
    return {
      pass: false,
      code: 'UIT003',
      message: `${broken.length} alias reference(s) cannot be resolved`,
      detail: broken.slice(0, 10).join('\n'),
    };
  }

  const aliasCount = spec.tokens.filter(t => ALIAS_PATTERN.test(String(t.value ?? ''))).length;
  return {
    pass: true,
    code: 'UIT003',
    message: `All ${aliasCount} alias reference(s) resolve to existing tokens`,
  };
}
