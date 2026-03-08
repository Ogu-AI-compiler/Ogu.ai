import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** MCP006 — attribution-placement-declared: attributionPlacement must be one of the allowed values */
const VALID_PLACEMENTS = ['inline', 'footer', 'metadata-only'];

export async function run({ dir }) {
  const specPath = join(dir, 'media-caption-credit-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'MCP006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'MCP006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.mediaTypes) || spec.mediaTypes.length === 0) {
    return { pass: true, code: 'MCP006', message: 'No mediaTypes defined — gate skipped', skipped: true };
  }

  // Only check media types that require credit
  const creditRequired = spec.mediaTypes.filter(mt => mt.creditRequired === true);

  if (creditRequired.length === 0) {
    return {
      pass: true,
      code: 'MCP006',
      message: 'No credit-required media types — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const mt of creditRequired) {
    if (!mt.attributionPlacement) {
      violations.push(
        `Media type "${mt.type}": attributionPlacement not declared. ` +
        `Allowed: ${VALID_PLACEMENTS.join(', ')}`
      );
      continue;
    }

    if (!VALID_PLACEMENTS.includes(mt.attributionPlacement)) {
      violations.push(
        `Media type "${mt.type}": attributionPlacement="${mt.attributionPlacement}" is invalid. ` +
        `Allowed: ${VALID_PLACEMENTS.join(', ')}`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'MCP006',
      message: `${violations.length} media type(s) with invalid attributionPlacement`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'MCP006',
    message: `All ${creditRequired.length} credit-required type(s) have valid attributionPlacement`,
  };
}
