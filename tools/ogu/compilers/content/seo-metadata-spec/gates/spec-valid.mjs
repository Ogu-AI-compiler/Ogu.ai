import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SMS001 — spec-valid: spec file exists, is valid JSON, and has required structure */
export async function run({ dir }) {
  const specPath = join(dir, 'seo-metadata-spec.spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'SMS001',
      message: 'seo-metadata-spec.spec.json not found',
      detail: `Expected file at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'SMS001',
      message: 'seo-metadata-spec.spec.json is not valid JSON',
      detail: err.message,
    };
  }

  if (!Array.isArray(spec.contentTypes) || spec.contentTypes.length === 0) {
    return {
      pass: false,
      code: 'SMS001',
      message: 'spec.contentTypes must be a non-empty array',
    };
  }

  const violations = [];
  for (const ct of spec.contentTypes) {
    if (!ct.typeId) violations.push(`Entry missing typeId: ${JSON.stringify(ct).slice(0, 60)}`);
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SMS001',
      message: `${violations.length} content type entries missing typeId`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'SMS001',
    message: `Spec valid — ${spec.contentTypes.length} content type(s)`,
  };
}
