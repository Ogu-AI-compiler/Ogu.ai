import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'tokens-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'DT001', message: 'tokens-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'DT001', message: `Invalid JSON: ${e.message}` };
  }

  if (!spec.colors || typeof spec.colors !== 'object') {
    return { pass: false, code: 'DT001', message: 'spec.colors is required — define your color palette' };
  }

  // Validate hex colors
  const allColors = Object.values(spec.colors).flatMap(v =>
    typeof v === 'object' ? Object.values(v) : [v]
  );

  const invalidColors = allColors.filter(c => typeof c === 'string' && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(c) && !/^(rgb|hsl|oklch)/.test(c));

  if (invalidColors.length) {
    return {
      pass: false, code: 'DT001',
      message: `Invalid color format (expected hex, rgb, hsl, or oklch): ${invalidColors.slice(0, 3).join(', ')}`
    };
  }

  return { pass: true, code: 'DT001', message: `Spec valid — ${Object.keys(spec.colors).length} color groups` };
}
