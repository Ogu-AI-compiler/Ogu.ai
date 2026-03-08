import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'i18n-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'I1001', message: 'i18n-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'I1001', message: `Invalid JSON: ${e.message}` }; }

  const required = ['defaultLocale', 'locales'];
  const missing = required.filter(f => !spec[f]);
  if (missing.length) return { pass: false, code: 'I1001', message: `Missing required fields: ${missing.join(', ')}` };

  if (!Array.isArray(spec.locales) || spec.locales.length < 1) {
    return { pass: false, code: 'I1001', message: 'locales must be a non-empty array (e.g. ["en", "he", "fr"])' };
  }

  if (!spec.locales.includes(spec.defaultLocale)) {
    return { pass: false, code: 'I1001', message: `defaultLocale '${spec.defaultLocale}' must be in locales array` };
  }

  // Check locale files exist
  const missingFiles = spec.locales.filter(l => !existsSync(join(dir, `${l}.json`)));
  if (missingFiles.length) {
    return { pass: false, code: 'I1001', message: `Missing locale files: ${missingFiles.map(l => `${l}.json`).join(', ')}` };
  }

  return { pass: true, code: 'I1001', message: `Spec valid — ${spec.locales.length} locales: [${spec.locales.join(', ')}], default: ${spec.defaultLocale}` };
}
