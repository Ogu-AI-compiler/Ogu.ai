import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA060 — spec-valid
 * visual-regression-spec.json must declare:
 *   - tool: the visual testing tool
 *   - viewports: array of { name, width, height }
 *   - stories or routes: what to capture (at least one of)
 *   - diffThreshold: pixel diff sensitivity (0.0–1.0)
 *
 * Valid tools: chromatic, percy, applitools, playwright-vrt, backstop, lost-pixel, reg-suit
 */

const VALID_TOOLS = new Set([
  'chromatic', 'percy', 'applitools', 'playwright-vrt', 'backstop', 'lost-pixel', 'reg-suit', 'storyshots',
]);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'visual-regression-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA060', message: 'visual-regression-spec.json not found or not valid JSON' }; }

  if (!spec.tool || !VALID_TOOLS.has(spec.tool)) {
    return {
      pass: false, code: 'QA060',
      message: `spec.tool "${spec.tool ?? 'undefined'}" not valid`,
      detail: `Valid tools: ${[...VALID_TOOLS].join(', ')}`,
    };
  }

  if (!Array.isArray(spec.viewports) || spec.viewports.length === 0) {
    return { pass: false, code: 'QA060', message: 'spec.viewports must be a non-empty array of { name, width, height }' };
  }

  const vpErrors = [];
  for (const [i, vp] of spec.viewports.entries()) {
    if (!vp.name || typeof vp.name !== 'string') vpErrors.push(`viewports[${i}]: name required`);
    if (typeof vp.width !== 'number' || vp.width < 320) vpErrors.push(`viewports[${i}]: width must be ≥ 320px`);
    if (typeof vp.height !== 'number' || vp.height < 200) vpErrors.push(`viewports[${i}]: height must be ≥ 200px`);
  }
  if (vpErrors.length) {
    return { pass: false, code: 'QA060', message: 'Viewport validation errors', detail: vpErrors.join('\n') };
  }

  const hasTargets = (Array.isArray(spec.stories) && spec.stories.length > 0)
    || (Array.isArray(spec.routes) && spec.routes.length > 0)
    || (Array.isArray(spec.components) && spec.components.length > 0);

  if (!hasTargets) {
    return {
      pass: false, code: 'QA060',
      message: 'No capture targets declared — add spec.stories, spec.routes, or spec.components',
    };
  }

  if (typeof spec.diffThreshold !== 'number') {
    return { pass: false, code: 'QA060', message: 'spec.diffThreshold is required (number between 0.0 and 1.0)' };
  }

  const targetCount = (spec.stories?.length ?? 0) + (spec.routes?.length ?? 0) + (spec.components?.length ?? 0);
  return {
    pass: true, code: 'QA060',
    message: `Spec valid — tool: ${spec.tool}, ${spec.viewports.length} viewport(s), ${targetCount} capture target(s)`,
  };
}
