import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SMS007 — hreflang-coverage: localized content types must declare hreflang for all locales in spec.locales */
export async function run({ dir }) {
  const specPath = join(dir, 'seo-metadata-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'SMS007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SMS007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  // If no locales declared, hreflang rules do not apply
  if (!Array.isArray(spec.locales) || spec.locales.length <= 1) {
    return {
      pass: true,
      code: 'SMS007',
      message: 'Single locale or no locales declared — hreflang gate skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.contentTypes) || spec.contentTypes.length === 0) {
    return { pass: true, code: 'SMS007', message: 'No contentTypes — gate skipped', skipped: true };
  }

  const declaredLocales = new Set(spec.locales);
  const violations = [];

  for (const ct of spec.contentTypes) {
    // Only check content types that are localized
    if (!ct.localized) continue;

    if (!ct.hreflang || typeof ct.hreflang !== 'object') {
      violations.push(`"${ct.typeId}": localized type missing hreflang declaration`);
      continue;
    }

    const coveredLocales = new Set(Object.keys(ct.hreflang));

    for (const locale of declaredLocales) {
      if (!coveredLocales.has(locale)) {
        violations.push(`"${ct.typeId}": hreflang missing coverage for locale "${locale}"`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SMS007',
      message: `${violations.length} hreflang coverage gap(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'SMS007',
    message: `hreflang coverage complete for ${spec.locales.length} locale(s)`,
  };
}
