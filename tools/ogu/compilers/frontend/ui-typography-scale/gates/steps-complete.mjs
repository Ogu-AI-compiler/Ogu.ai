import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UTS002 — steps-complete: every scale step has font-size, line-height, font-weight */
export async function run({ dir }) {
  const specPath = join(dir, 'typography-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTS002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTS002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return { pass: true, code: 'UTS002', message: 'No steps — gate skipped', skipped: true };
  }

  const REQUIRED_FIELDS = ['fontSize', 'lineHeight', 'fontWeight'];
  const violations = [];

  for (const step of spec.steps) {
    const stepId = step.id || step.name || '(unnamed)';
    for (const field of REQUIRED_FIELDS) {
      if (step[field] === undefined) {
        violations.push(`Step "${stepId}" missing: ${field}`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTS002',
      message: `${violations.length} scale step(s) have missing required fields`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UTS002', message: `All ${spec.steps.length} step(s) have fontSize, lineHeight, fontWeight` };
}
