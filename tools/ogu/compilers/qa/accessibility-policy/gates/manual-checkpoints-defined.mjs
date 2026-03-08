import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA074 — manual-checkpoints-defined
 * Automated tools like axe-core can only detect ~30–40% of WCAG failures.
 * The remaining 60–70% require human judgment — screen reader testing,
 * cognitive load assessment, reading order, animation preference, etc.
 *
 * This gate requires that manual testing checkpoints are defined in the spec.
 * Manual checkpoints do not need to be run in CI, but they must be documented
 * so QA teams know what to check.
 *
 * Minimum: at least 3 manual checkpoints covering different concern areas.
 *
 * Common manual checkpoints:
 *   - Screen reader navigation (NVDA/JAWS/VoiceOver)
 *   - Keyboard-only navigation (Tab, Shift+Tab, Enter, Space, arrows)
 *   - Zoom to 200% — content must not overflow or break
 *   - Reduced motion — animations respect prefers-reduced-motion
 *   - Color-only information — not conveyed by color alone
 *   - Focus visible — focus indicator is always visible
 */

const MIN_CHECKPOINTS = 3;

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'accessibility-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA074', message: 'accessibility-policy-spec.json not readable' }; }

  const checkpoints = spec.manualCheckpoints ?? spec.manual ?? spec.manualTests;

  if (!checkpoints) {
    return {
      pass: false, code: 'QA074',
      message: 'spec.manualCheckpoints not declared',
      detail: `Automated tools detect only ~30–40% of WCAG failures. Document at least ${MIN_CHECKPOINTS} manual testing checkpoints.\nAdd:\n  "manualCheckpoints": [\n    { "id": "screen-reader", "description": "Navigate with NVDA/VoiceOver" },\n    { "id": "keyboard-only", "description": "All interactions via keyboard only" },\n    { "id": "zoom-200", "description": "Content readable at 200% zoom" }\n  ]`,
    };
  }

  if (!Array.isArray(checkpoints)) {
    return { pass: false, code: 'QA074', message: 'manualCheckpoints must be an array' };
  }

  if (checkpoints.length < MIN_CHECKPOINTS) {
    return {
      pass: false, code: 'QA074',
      message: `Only ${checkpoints.length} manual checkpoint(s) — minimum is ${MIN_CHECKPOINTS}`,
      detail: 'Automated tools miss: screen reader order, cognitive clarity, motion sensitivity, focus traps in complex widgets.',
    };
  }

  const missing = checkpoints.filter(cp => !cp.description && !cp.name && !cp.id);
  if (missing.length > 0) {
    return {
      pass: false, code: 'QA074',
      message: `${missing.length} manual checkpoint(s) have no description or id`,
    };
  }

  return {
    pass: true, code: 'QA074',
    message: `${checkpoints.length} manual checkpoint(s) defined`,
  };
}
