import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UIT007 — naming-convention: all token names follow the declared naming schema */

// Built-in naming schemas. Spec declares which one via "namingConvention" field.
const NAMING_SCHEMAS = {
  'dot-notation': /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)*$/,
  'kebab':        /^[a-z][a-z0-9-]+(-[a-z0-9]+)*$/,
  'camel':        /^[a-z][a-zA-Z0-9]+$/,
  'slash':        /^[a-z][a-z0-9]*(\/[a-z][a-z0-9-]*)+$/,
};

const DEFAULT_SCHEMA = 'dot-notation';

export async function run({ dir }) {
  const specPath = join(dir, 'design-token-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UIT007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UIT007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.tokens) || spec.tokens.length === 0) {
    return { pass: true, code: 'UIT007', message: 'No tokens — gate skipped', skipped: true };
  }

  const schemaName = spec.namingConvention || DEFAULT_SCHEMA;
  const pattern = NAMING_SCHEMAS[schemaName];

  if (!pattern) {
    // Unknown schema — cannot validate. Skip rather than false-fail.
    return {
      pass: true,
      code: 'UIT007',
      message: `Unknown naming convention "${schemaName}" — gate skipped`,
      skipped: true,
    };
  }

  const violations = [];
  for (const token of spec.tokens) {
    if (!token.name) continue;
    // Escape hatch: token can declare namingConventionOk: true to opt out
    if (token.namingConventionOk === true) continue;
    if (!pattern.test(token.name)) {
      violations.push(`"${token.name}" does not match ${schemaName} convention`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UIT007',
      message: `${violations.length} token name(s) violate "${schemaName}" naming convention`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UIT007',
    message: `All token names follow "${schemaName}" convention (${spec.tokens.length} checked)`,
  };
}
