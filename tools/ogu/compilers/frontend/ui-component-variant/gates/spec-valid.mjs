import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UCV001 — spec-valid: component-variant-spec.json exists with required structure.
 *
 * Expected shape:
 * {
 *   "component": "Button",
 *   "modes": ["light", "dark"],
 *   "props": ["intent", "size", "shape"],
 *   "variants": [
 *     {
 *       "id": "primary",
 *       "props": { "intent": "primary", "size": "md" },
 *       "visual": {
 *         "light": { "background": "{color.interactive.primary}", "text": "{color.text.on-action}" },
 *         "dark":  { "background": "{color.interactive.primary-dark}", "text": "{color.text.on-action}" }
 *       }
 *     }
 *   ]
 * }
 */
export async function run({ dir }) {
  const specPath = join(dir, 'component-variant-spec.json');

  if (!existsSync(specPath)) {
    return { pass: false, code: 'UCV001', message: 'component-variant-spec.json not found', detail: `Expected at: ${specPath}` };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'UCV001', message: 'component-variant-spec.json is not valid JSON', detail: err.message };
  }

  if (!spec.component) {
    return { pass: false, code: 'UCV001', message: 'Missing required field: component (the component name)' };
  }

  if (!spec.variants || !Array.isArray(spec.variants) || spec.variants.length === 0) {
    return { pass: false, code: 'UCV001', message: 'Missing required field: variants (non-empty array)' };
  }

  // Each variant needs id and visual
  const missingFields = [];
  for (const [i, variant] of spec.variants.entries()) {
    const variantId = variant.id || `variants[${i}]`;
    if (!variant.id) missingFields.push(`${variantId} missing: id`);
    if (!variant.visual || typeof variant.visual !== 'object') {
      missingFields.push(`"${variantId}" missing: visual (object with mode → properties)`);
    }
  }

  if (missingFields.length > 0) {
    return {
      pass: false,
      code: 'UCV001',
      message: `${missingFields.length} variant(s) have missing required fields`,
      detail: missingFields.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UCV001', message: `Spec valid — component: ${spec.component}, ${spec.variants.length} variant(s)` };
}
