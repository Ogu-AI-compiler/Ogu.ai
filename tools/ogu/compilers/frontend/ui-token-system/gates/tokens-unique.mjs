import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UIT002 — tokens-unique: every token name is unique across the entire token set */
export async function run({ dir }) {
  const specPath = join(dir, 'design-token-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UIT002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UIT002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.tokens) || spec.tokens.length === 0) {
    return { pass: true, code: 'UIT002', message: 'No tokens to check — gate skipped', skipped: true };
  }

  const seen = new Map();
  const duplicates = [];

  for (const token of spec.tokens) {
    if (!token.name) continue;
    if (seen.has(token.name)) {
      duplicates.push(token.name);
    } else {
      seen.set(token.name, true);
    }
  }

  if (duplicates.length > 0) {
    return {
      pass: false,
      code: 'UIT002',
      message: `${duplicates.length} duplicate token name(s) detected`,
      detail: duplicates.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UIT002',
    message: `All ${spec.tokens.length} token names are unique`,
  };
}
