import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** MCP002 — caption-credit-declared: every media type must declare captionRequired and creditRequired */
export async function run({ dir }) {
  const specPath = join(dir, 'media-caption-credit-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'MCP002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'MCP002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.mediaTypes) || spec.mediaTypes.length === 0) {
    return { pass: true, code: 'MCP002', message: 'No mediaTypes defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const mt of spec.mediaTypes) {
    if (!Object.prototype.hasOwnProperty.call(mt, 'captionRequired')) {
      violations.push(`Media type "${mt.type}": captionRequired not declared (must be true or false)`);
    } else if (typeof mt.captionRequired !== 'boolean') {
      violations.push(`Media type "${mt.type}": captionRequired must be boolean`);
    }

    if (!Object.prototype.hasOwnProperty.call(mt, 'creditRequired')) {
      violations.push(`Media type "${mt.type}": creditRequired not declared (must be true or false)`);
    } else if (typeof mt.creditRequired !== 'boolean') {
      violations.push(`Media type "${mt.type}": creditRequired must be boolean`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'MCP002',
      message: `${violations.length} media type(s) missing caption/credit declarations`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'MCP002',
    message: `All ${spec.mediaTypes.length} media type(s) have captionRequired and creditRequired declared`,
  };
}
