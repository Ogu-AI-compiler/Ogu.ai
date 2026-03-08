import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * USA001 — spec-valid: state-appearance-spec.json exists with required structure.
 *
 * Expected shape:
 * {
 *   "components": [
 *     {
 *       "id": "Button",
 *       "states": {
 *         "default":  { "background": "{color.button.bg}" },
 *         "hover":    { "background": "{color.button.bg-hover}" },
 *         "focus":    { "background": "{color.button.bg}", "focusRing": "{color.focus.ring}" },
 *         "active":   { "background": "{color.button.bg-active}" },
 *         "disabled": { "opacity": 0.4 },
 *         "error":    { "border": "{color.destructive.default}" }
 *       }
 *     }
 *   ]
 * }
 */
export async function run({ dir }) {
  const specPath = join(dir, 'state-appearance-spec.json');

  if (!existsSync(specPath)) {
    return { pass: false, code: 'USA001', message: 'state-appearance-spec.json not found', detail: `Expected at: ${specPath}` };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'USA001', message: 'state-appearance-spec.json is not valid JSON', detail: err.message };
  }

  if (!spec.components || !Array.isArray(spec.components) || spec.components.length === 0) {
    return { pass: false, code: 'USA001', message: 'Missing required field: components (non-empty array)' };
  }

  const missingFields = [];
  for (const [i, comp] of spec.components.entries()) {
    const compId = comp.id || `components[${i}]`;
    if (!comp.id) missingFields.push(`${compId} missing: id`);
    if (!comp.states || typeof comp.states !== 'object') {
      missingFields.push(`"${compId}" missing: states (object)`);
    }
  }

  if (missingFields.length > 0) {
    return {
      pass: false,
      code: 'USA001',
      message: `${missingFields.length} component(s) have missing required fields`,
      detail: missingFields.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'USA001', message: `Spec valid — ${spec.components.length} component(s)` };
}
