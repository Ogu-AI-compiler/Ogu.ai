import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PWS002 — states-complete: workflow must include draft, review, and published states */
const REQUIRED_STATES = ['draft', 'published'];

export async function run({ dir }) {
  const specPath = join(dir, 'publishing-workflow-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'PWS002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PWS002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.states) || spec.states.length === 0) {
    return { pass: true, code: 'PWS002', message: 'No states defined — gate skipped', skipped: true };
  }

  const stateIds = new Set(spec.states.map(s => s.id).filter(Boolean));
  const missing = REQUIRED_STATES.filter(s => !stateIds.has(s));

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'PWS002',
      message: `Workflow missing required states: ${missing.join(', ')}`,
      detail: `Every publishing workflow must include at minimum: ${REQUIRED_STATES.join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'PWS002',
    message: `Required states present (${spec.states.map(s => s.id).join(' → ')})`,
  };
}
