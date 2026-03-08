import { readFileSync } from 'fs';
import { join } from 'path';

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'i18n-spec.json'), 'utf8'));
  const localeData = {};

  for (const locale of spec.locales) {
    try {
      localeData[locale] = JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8'));
    } catch (e) {
      return { pass: false, code: 'I1003', message: `Failed to parse ${locale}.json: ${e.message}` };
    }
  }

  const defaultKeys = flattenKeys(localeData[spec.defaultLocale]).sort();
  const violations = [];

  for (const locale of spec.locales) {
    if (locale === spec.defaultLocale) continue;
    const localeKeys = flattenKeys(localeData[locale]).sort();

    const missing = defaultKeys.filter(k => !localeKeys.includes(k));
    const extra = localeKeys.filter(k => !defaultKeys.includes(k));

    if (missing.length) violations.push(`[${locale}] missing keys: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`);
    if (extra.length) violations.push(`[${locale}] extra keys not in default: ${extra.slice(0, 3).join(', ')}`);
  }

  if (violations.length) {
    return { pass: false, code: 'I1003', message: `Key parity violations (${violations.length})`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'I1003', message: `Key parity valid — ${defaultKeys.length} keys across ${spec.locales.length} locales` };
}
