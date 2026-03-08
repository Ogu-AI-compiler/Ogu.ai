import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UIT001 — spec-valid: design-token-spec.json exists and every token has required fields */
export async function run({ dir }) {
  const specPath = join(dir, 'design-token-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'UIT001',
      message: 'design-token-spec.json not found',
      detail: `Expected at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UIT001',
      message: 'design-token-spec.json is not valid JSON',
      detail: err.message,
    };
  }

  if (!spec.tokens || !Array.isArray(spec.tokens)) {
    return {
      pass: false,
      code: 'UIT001',
      message: 'design-token-spec.json missing required field: tokens (array)',
      detail: `Found top-level keys: ${Object.keys(spec).join(', ')}`,
    };
  }

  if (spec.tokens.length === 0) {
    return {
      pass: false,
      code: 'UIT001',
      message: 'tokens array is empty — at least one token is required',
    };
  }

  // Every token must have: name, value, type, tier
  const missingFields = [];
  for (const [i, token] of spec.tokens.entries()) {
    if (!token.name)             missingFields.push(`tokens[${i}] missing: name`);
    if (token.value === undefined) missingFields.push(`tokens[${i}] (${token.name || '?'}) missing: value`);
    if (!token.type)             missingFields.push(`tokens[${i}] (${token.name || '?'}) missing: type`);
    if (!token.tier)             missingFields.push(`tokens[${i}] (${token.name || '?'}) missing: tier`);
  }

  if (missingFields.length > 0) {
    return {
      pass: false,
      code: 'UIT001',
      message: `${missingFields.length} token(s) have missing required fields`,
      detail: missingFields.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UIT001',
    message: `Spec valid — ${spec.tokens.length} token(s) declared`,
  };
}
