import { readFileSync } from 'fs';
import { join } from 'path';

function extractInterpolations(str) {
  // Match {{variable}}, {variable}, %(variable)s formats
  return [
    ...(str.match(/\{\{(\w+)\}\}/g) || []).map(m => m.replace(/[{}]/g, '')),
    ...(str.match(/\{(\w+)\}/g) || []).map(m => m.replace(/[{}]/g, '')),
    ...(str.match(/%\((\w+)\)s/g) || []).map(m => m.replace(/%\(|\)s/g, '')),
  ];
}

function flattenEntries(obj, prefix = '') {
  const entries = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') entries.push([fullKey, v]);
    else if (typeof v === 'object') entries.push(...flattenEntries(v, fullKey));
  }
  return entries;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'i18n-spec.json'), 'utf8'));
  const localeData = {};

  for (const locale of spec.locales) {
    localeData[locale] = JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8'));
  }

  const defaultEntries = Object.fromEntries(flattenEntries(localeData[spec.defaultLocale]));
  const violations = [];

  for (const locale of spec.locales) {
    if (locale === spec.defaultLocale) continue;
    const localeEntries = Object.fromEntries(flattenEntries(localeData[locale]));

    for (const [key, defaultValue] of Object.entries(defaultEntries)) {
      const defaultVars = extractInterpolations(defaultValue);
      if (!defaultVars.length) continue;

      const localeValue = localeEntries[key];
      if (!localeValue) continue; // missing key caught by key-parity gate

      const localeVars = extractInterpolations(localeValue);
      const missingVars = defaultVars.filter(v => !localeVars.includes(v));
      const extraVars = localeVars.filter(v => !defaultVars.includes(v));

      if (missingVars.length) violations.push(`[${locale}] '${key}': missing interpolations {{${missingVars.join('}}, {{')}}}`);
      if (extraVars.length) violations.push(`[${locale}] '${key}': unexpected interpolations {{${extraVars.join('}}, {{')}}}`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'I1004', message: `Interpolation parity violations (${violations.length})`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'I1004', message: 'Interpolation variables consistent across all locales' };
}
