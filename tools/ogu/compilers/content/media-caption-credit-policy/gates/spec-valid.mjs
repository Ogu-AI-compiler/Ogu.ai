import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** MCP001 — spec-valid: spec file exists, is valid JSON, and has required structure */
export async function run({ dir }) {
  const specPath = join(dir, 'media-caption-credit-policy.spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'MCP001',
      message: 'media-caption-credit-policy.spec.json not found',
      detail: `Expected file at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'MCP001',
      message: 'media-caption-credit-policy.spec.json is not valid JSON',
      detail: err.message,
    };
  }

  if (!Array.isArray(spec.mediaTypes) || spec.mediaTypes.length === 0) {
    return {
      pass: false,
      code: 'MCP001',
      message: 'spec.mediaTypes must be a non-empty array',
    };
  }

  const violations = [];
  for (const mt of spec.mediaTypes) {
    if (!mt.type || typeof mt.type !== 'string') {
      violations.push(`Media type entry missing "type" field: ${JSON.stringify(mt).slice(0, 60)}`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'MCP001',
      message: `${violations.length} media type(s) missing required "type" field`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'MCP001',
    message: `Spec valid — ${spec.mediaTypes.length} media type(s)`,
  };
}
