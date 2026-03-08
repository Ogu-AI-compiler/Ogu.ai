import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** MCP004 — template-vars-valid: creditTemplate must only use variables declared in spec.templateVariables */
const KNOWN_VARIABLE_PATTERN = /\{([^}]+)\}/g;

export async function run({ dir }) {
  const specPath = join(dir, 'media-caption-credit-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'MCP004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'MCP004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.mediaTypes) || spec.mediaTypes.length === 0) {
    return { pass: true, code: 'MCP004', message: 'No mediaTypes defined — gate skipped', skipped: true };
  }

  // If templateVariables not declared, can't validate — skip
  if (!Array.isArray(spec.templateVariables) || spec.templateVariables.length === 0) {
    return {
      pass: true,
      code: 'MCP004',
      message: 'No templateVariables declared — gate skipped',
      skipped: true,
    };
  }

  const allowedVars = new Set(spec.templateVariables);
  const violations = [];

  for (const mt of spec.mediaTypes) {
    if (!mt.creditTemplate) continue;

    let match;
    KNOWN_VARIABLE_PATTERN.lastIndex = 0;
    const template = mt.creditTemplate;

    // Re-create the regex each time to avoid lastIndex state issues
    const varPattern = /\{([^}]+)\}/g;
    let m;
    while ((m = varPattern.exec(template)) !== null) {
      const varName = m[1];
      if (!allowedVars.has(varName)) {
        violations.push(
          `Media type "${mt.type}" creditTemplate uses undefined variable "{${varName}}". ` +
          `Allowed: ${[...allowedVars].map(v => '{' + v + '}').join(', ')}`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'MCP004',
      message: `${violations.length} creditTemplate(s) use undefined variables`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'MCP004',
    message: 'All creditTemplate variables are declared in spec.templateVariables',
  };
}
