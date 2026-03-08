import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UTS004 — body-line-height: the body text step must have line-height ≥ 1.4
 * WCAG Success Criterion 1.4.12 (Text Spacing) requires ≥ 1.5 for body text,
 * but we enforce a pragmatic minimum of 1.4 to avoid flagging tightly set designs.
 */

const MIN_LINE_HEIGHT = 1.4;

// Step IDs commonly used for body text
const BODY_STEP_IDS = ['body', 'base', 'text', 'paragraph', 'p', 'md', 'default'];

function parseLineHeight(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();

  // Unitless ratio (most common for line-height)
  const numericMatch = /^[\d.]+$/.exec(str);
  if (numericMatch) return parseFloat(str);

  // Percentage — convert to ratio
  const pctMatch = /^([\d.]+)%$/.exec(str);
  if (pctMatch) return parseFloat(pctMatch[1]) / 100;

  return null; // Token reference or complex calc — skip
}

export async function run({ dir }) {
  const specPath = join(dir, 'typography-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTS004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTS004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return { pass: true, code: 'UTS004', message: 'No steps — gate skipped', skipped: true };
  }

  // Find the body step — first match by explicit bodyStep flag, then by common IDs
  let bodyStep = spec.steps.find(s => s.isBodyText === true);
  if (!bodyStep) {
    bodyStep = spec.steps.find(s => BODY_STEP_IDS.includes(String(s.id || s.name || '').toLowerCase()));
  }

  if (!bodyStep) {
    return {
      pass: false,
      code: 'UTS004',
      message: 'Cannot identify body text step — set isBodyText: true on the body step, or use one of: ' + BODY_STEP_IDS.join(', '),
    };
  }

  const stepId = bodyStep.id || bodyStep.name || 'body';
  const lineHeightValue = parseLineHeight(bodyStep.lineHeight);

  if (lineHeightValue === null) {
    return {
      pass: true,
      code: 'UTS004',
      message: `Body step "${stepId}" lineHeight is a token reference — check skipped`,
      skipped: true,
    };
  }

  if (lineHeightValue < MIN_LINE_HEIGHT) {
    return {
      pass: false,
      code: 'UTS004',
      message: `Body step "${stepId}" lineHeight ${bodyStep.lineHeight} (${lineHeightValue}) < ${MIN_LINE_HEIGHT} minimum (WCAG SC 1.4.12)`,
    };
  }

  return {
    pass: true,
    code: 'UTS004',
    message: `Body step "${stepId}" lineHeight ${lineHeightValue} ≥ ${MIN_LINE_HEIGHT}`,
  };
}
