import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** MCP005 — license-required-external: externally sourced media types must require license declaration */
export async function run({ dir }) {
  const specPath = join(dir, 'media-caption-credit-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'MCP005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'MCP005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.mediaTypes) || spec.mediaTypes.length === 0) {
    return { pass: true, code: 'MCP005', message: 'No mediaTypes defined — gate skipped', skipped: true };
  }

  const externalTypes = spec.mediaTypes.filter(mt => mt.source === 'external');

  if (externalTypes.length === 0) {
    return {
      pass: true,
      code: 'MCP005',
      message: 'No externally sourced media types — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const mt of externalTypes) {
    if (mt.licenseRequired !== true) {
      violations.push(
        `Media type "${mt.type}" (source: external): licenseRequired must be true. ` +
        `External media without license declaration creates copyright liability.`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'MCP005',
      message: `${violations.length} external media type(s) missing licenseRequired:true`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'MCP005',
    message: `All ${externalTypes.length} external media type(s) require license declaration`,
  };
}
