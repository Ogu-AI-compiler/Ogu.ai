import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** VE003 — mitigation-context-meaningful: mitigation_context must describe real compensating controls */
export async function run({ dir }) {
  const specPath = join(dir, 'vuln-exception-record.json');
  if (!existsSync(specPath)) return { pass: true, code: 'VE003', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'VE003', message: 'Invalid JSON — gate skipped', skipped: true }; }

  const context = String(spec.mitigation_context || '');
  if (context.trim().length < 30) {
    return {
      pass: false,
      code: 'VE003',
      message: `mitigation_context is too short (${context.trim().length} chars) — must describe specific compensating controls (at least 30 characters)`,
    };
  }

  const PLACEHOLDER_PATTERNS = [/^n\/a$/i, /^none$/i, /^todo/i, /^tbd$/i, /^pending$/i, /^will fix later/i];
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(context.trim())) {
      return {
        pass: false,
        code: 'VE003',
        message: `mitigation_context "${context.trim()}" is a placeholder — describe the actual compensating control in place`,
      };
    }
  }

  return { pass: true, code: 'VE003', message: 'Mitigation context is meaningful' };
}
