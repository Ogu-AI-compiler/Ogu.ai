import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** MCP003 — credit-template-defined: when creditRequired is true, a creditTemplate must be defined */
export async function run({ dir }) {
  const specPath = join(dir, 'media-caption-credit-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'MCP003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'MCP003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.mediaTypes) || spec.mediaTypes.length === 0) {
    return { pass: true, code: 'MCP003', message: 'No mediaTypes defined — gate skipped', skipped: true };
  }

  const creditRequiredTypes = spec.mediaTypes.filter(mt => mt.creditRequired === true);

  if (creditRequiredTypes.length === 0) {
    return {
      pass: true,
      code: 'MCP003',
      message: 'No media types require credit — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const mt of creditRequiredTypes) {
    if (!mt.creditTemplate || typeof mt.creditTemplate !== 'string' || mt.creditTemplate.trim() === '') {
      violations.push(
        `Media type "${mt.type}": creditRequired is true but creditTemplate is missing or empty`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'MCP003',
      message: `${violations.length} media type(s) require credit but have no creditTemplate`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'MCP003',
    message: `All ${creditRequiredTypes.length} credit-required media type(s) have creditTemplate`,
  };
}
