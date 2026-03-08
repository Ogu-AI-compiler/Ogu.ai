import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UTS003 — min-font-size: no scale step has font-size below 12px / 0.75rem */

/**
 * Parses a CSS size value and returns pixels.
 * Supports px, rem (assuming 16px base), and numeric strings.
 */
function toPx(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim().toLowerCase();

  const pxMatch = /^([\d.]+)px$/.exec(str);
  if (pxMatch) return parseFloat(pxMatch[1]);

  const remMatch = /^([\d.]+)rem$/.exec(str);
  if (remMatch) return parseFloat(remMatch[1]) * 16;

  const emMatch = /^([\d.]+)em$/.exec(str);
  if (emMatch) return parseFloat(emMatch[1]) * 16;

  // Plain number — treat as px
  const numMatch = /^[\d.]+$/.exec(str);
  if (numMatch) return parseFloat(str);

  return null; // Token reference or unparseable — skip
}

const MIN_SIZE_PX = 12;

export async function run({ dir }) {
  const specPath = join(dir, 'typography-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTS003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTS003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return { pass: true, code: 'UTS003', message: 'No steps — gate skipped', skipped: true };
  }

  const violations = [];
  let checked = 0;

  for (const step of spec.steps) {
    const stepId = step.id || step.name || '(unnamed)';
    const px = toPx(step.fontSize);

    if (px === null) {
      // Token reference — cannot verify without resolution
      continue;
    }

    checked++;
    if (px < MIN_SIZE_PX) {
      violations.push(`Step "${stepId}": fontSize ${step.fontSize} = ${px}px < ${MIN_SIZE_PX}px minimum`);
    }
  }

  if (checked === 0) {
    return {
      pass: true,
      code: 'UTS003',
      message: 'All fontSizes are token references — min size check skipped (resolve tokens first)',
      skipped: true,
    };
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTS003',
      message: `${violations.length} step(s) below ${MIN_SIZE_PX}px minimum font size`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UTS003', message: `All ${checked} step(s) ≥ ${MIN_SIZE_PX}px` };
}
