import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** USS005 — min-spacing: no spacing step is below 2px */

function parsePx(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim().toLowerCase();
  const pxMatch = /^([\d.]+)px$/.exec(str);
  if (pxMatch) return parseFloat(pxMatch[1]);
  const remMatch = /^([\d.]+)rem$/.exec(str);
  if (remMatch) return parseFloat(remMatch[1]) * 16;
  const numMatch = /^[\d.]+$/.exec(str);
  if (numMatch) return parseFloat(str);
  return null;
}

const MIN_PX = 2;

export async function run({ dir }) {
  const specPath = join(dir, 'spacing-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USS005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USS005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return { pass: true, code: 'USS005', message: 'No steps — gate skipped', skipped: true };
  }

  const violations = [];
  let checked = 0;

  for (const step of spec.steps) {
    const stepId = step.id || step.name || '(unnamed)';
    const px = parsePx(step.value);
    if (px === null) continue;
    checked++;
    if (px < MIN_PX) {
      violations.push(`Step "${stepId}": ${step.value} = ${px}px < ${MIN_PX}px minimum`);
    }
  }

  if (checked === 0) {
    return { pass: true, code: 'USS005', message: 'All step values are token references — min check skipped', skipped: true };
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USS005',
      message: `${violations.length} spacing step(s) below ${MIN_PX}px minimum`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'USS005', message: `All ${checked} step(s) ≥ ${MIN_PX}px` };
}
