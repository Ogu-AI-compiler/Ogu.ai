import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UIT006 — component-aliases-semantic: component-tier tokens must alias a semantic token, not a primitive directly */
const ALIAS_PATTERN = /^\{(.+)\}$/;

export async function run({ dir }) {
  const specPath = join(dir, 'design-token-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UIT006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UIT006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.tokens) || spec.tokens.length === 0) {
    return { pass: true, code: 'UIT006', message: 'No tokens — gate skipped', skipped: true };
  }

  const componentTokens = spec.tokens.filter(t => t.tier === 'component');
  if (componentTokens.length === 0) {
    return {
      pass: true,
      code: 'UIT006',
      message: 'No component-tier tokens declared — gate skipped',
      skipped: true,
    };
  }

  // Build a lookup of name → tier for all tokens
  const tierByName = new Map();
  for (const token of spec.tokens) {
    if (token.name) tierByName.set(token.name, token.tier);
  }

  const violations = [];
  for (const token of componentTokens) {
    const value = String(token.value ?? '');
    const match = ALIAS_PATTERN.exec(value);

    if (!match) {
      // Component token has a raw value — always a violation
      violations.push(`"${token.name}": raw value "${value.slice(0, 40)}" — must alias a semantic token`);
      continue;
    }

    const referencedName = match[1];
    const referencedTier = tierByName.get(referencedName);

    if (referencedTier === 'primitive') {
      violations.push(
        `"${token.name}" → {${referencedName}}: component token aliases primitive directly (must go through semantic tier)`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UIT006',
      message: `${violations.length} component token(s) skip the semantic tier`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UIT006',
    message: `All ${componentTokens.length} component token(s) alias semantic tokens correctly`,
  };
}
