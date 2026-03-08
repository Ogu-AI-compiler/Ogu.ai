import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'tokens-spec.json'), 'utf8'));

  if (!spec.darkMode) {
    return { pass: true, code: 'DT006', message: 'Dark mode not required (spec.darkMode not set)', skipped: true };
  }

  const lightColors = Object.keys(spec.colors || {});
  const darkColors = Object.keys(spec.dark?.colors || spec.darkColors || {});

  if (!darkColors.length) {
    return {
      pass: false, code: 'DT006',
      message: 'Dark mode enabled but no dark color tokens defined',
      detail: 'Add spec.dark.colors or spec.darkColors with matching keys to spec.colors'
    };
  }

  // Every semantic color in light must have a dark counterpart
  const missing = lightColors.filter(k => !darkColors.includes(k));

  if (missing.length) {
    return {
      pass: false, code: 'DT006',
      message: `${missing.length} light mode tokens missing dark counterparts`,
      detail: missing.join(', ')
    };
  }

  return { pass: true, code: 'DT006', message: `Dark mode pairs complete — ${lightColors.length} color pairs` };
}
