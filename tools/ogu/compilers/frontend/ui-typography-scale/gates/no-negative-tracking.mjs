import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UTS005 — no-negative-tracking: letter-spacing is not negative for body text step */

const BODY_STEP_IDS = ['body', 'base', 'text', 'paragraph', 'p', 'md', 'default'];

function parseLetterSpacing(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim().toLowerCase();

  // em-based (common for letter-spacing)
  const emMatch = /^(-?[\d.]+)em$/.exec(str);
  if (emMatch) return parseFloat(emMatch[1]);

  // px-based
  const pxMatch = /^(-?[\d.]+)px$/.exec(str);
  if (pxMatch) return parseFloat(pxMatch[1]);

  // Plain numeric
  const numMatch = /^-?[\d.]+$/.exec(str);
  if (numMatch) return parseFloat(str);

  return null;
}

export async function run({ dir }) {
  const specPath = join(dir, 'typography-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTS005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTS005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return { pass: true, code: 'UTS005', message: 'No steps — gate skipped', skipped: true };
  }

  // Find body step
  let bodyStep = spec.steps.find(s => s.isBodyText === true);
  if (!bodyStep) {
    bodyStep = spec.steps.find(s => BODY_STEP_IDS.includes(String(s.id || s.name || '').toLowerCase()));
  }

  if (!bodyStep) {
    // Can't identify body step — skip rather than false-fail
    return { pass: true, code: 'UTS005', message: 'Cannot identify body step — gate skipped', skipped: true };
  }

  const stepId = bodyStep.id || bodyStep.name || 'body';

  if (bodyStep.letterSpacing === undefined) {
    // No letter-spacing declared — not a violation (defaults to 0)
    return { pass: true, code: 'UTS005', message: `Body step "${stepId}" has no letterSpacing — default is 0 (pass)` };
  }

  const value = parseLetterSpacing(bodyStep.letterSpacing);

  if (value === null) {
    return { pass: true, code: 'UTS005', message: `Body step "${stepId}" letterSpacing is a token reference — check skipped`, skipped: true };
  }

  if (value < 0) {
    return {
      pass: false,
      code: 'UTS005',
      message: `Body step "${stepId}" letterSpacing ${bodyStep.letterSpacing} is negative — negative tracking reduces legibility for body text`,
    };
  }

  return { pass: true, code: 'UTS005', message: `Body step "${stepId}" letterSpacing ${bodyStep.letterSpacing} ≥ 0` };
}
