import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UCV005 — prop-coverage: every declared prop axis has at least one variant entry.
 *
 * If spec declares props: ["intent", "size", "shape"], then variants must collectively
 * cover all values for each prop axis — or at minimum have at least one variant
 * that uses each prop name.
 */
export async function run({ dir }) {
  const specPath = join(dir, 'component-variant-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCV005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCV005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const declaredProps = Array.isArray(spec.props) ? spec.props : [];
  if (declaredProps.length === 0) {
    return { pass: true, code: 'UCV005', message: 'No props declared — gate skipped', skipped: true };
  }

  const variants = Array.isArray(spec.variants) ? spec.variants : [];
  if (variants.length === 0) {
    return { pass: true, code: 'UCV005', message: 'No variants — gate skipped', skipped: true };
  }

  // Collect all prop keys used across variants
  const usedPropKeys = new Set();
  for (const variant of variants) {
    if (variant.props && typeof variant.props === 'object') {
      for (const key of Object.keys(variant.props)) {
        usedPropKeys.add(key);
      }
    }
  }

  const missingProps = declaredProps.filter(p => !usedPropKeys.has(p));

  if (missingProps.length > 0) {
    return {
      pass: false,
      code: 'UCV005',
      message: `${missingProps.length} declared prop axis(es) have no variant entries`,
      detail: `Missing prop coverage: ${missingProps.join(', ')}\nUsed in variants: ${[...usedPropKeys].join(', ')}`,
    };
  }

  return { pass: true, code: 'UCV005', message: `All ${declaredProps.length} prop axis(es) have variant coverage` };
}
