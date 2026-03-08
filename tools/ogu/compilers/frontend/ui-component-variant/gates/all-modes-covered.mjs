import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UCV004 — all-modes-covered: each variant has visual definitions for all declared modes */
export async function run({ dir }) {
  const specPath = join(dir, 'component-variant-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCV004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCV004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const modes = Array.isArray(spec.modes) ? spec.modes : [];
  if (modes.length === 0) {
    return { pass: true, code: 'UCV004', message: 'No modes declared — gate skipped', skipped: true };
  }

  const variants = Array.isArray(spec.variants) ? spec.variants : [];
  if (variants.length === 0) {
    return { pass: true, code: 'UCV004', message: 'No variants — gate skipped', skipped: true };
  }

  const violations = [];

  for (const variant of variants) {
    const visual = variant.visual && typeof variant.visual === 'object' ? variant.visual : {};
    const missingModes = modes.filter(mode => !visual[mode]);

    if (missingModes.length > 0) {
      violations.push(`Variant "${variant.id}": missing visual for mode(s): ${missingModes.join(', ')}`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCV004',
      message: `${violations.length} variant(s) missing mode coverage`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UCV004', message: `All ${variants.length} variant(s) covered for ${modes.length} mode(s)` };
}
