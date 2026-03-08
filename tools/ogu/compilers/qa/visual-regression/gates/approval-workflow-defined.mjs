import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA063 — approval-workflow-defined
 * A visual regression spec must define what happens when a visual change is detected.
 *
 * Without an approval workflow, every change either:
 *   a) Blocks the pipeline forever (no way to update baselines)
 *   b) Auto-approves everything (defeating the purpose of VRT)
 *
 * Required: spec.approvalWorkflow with:
 *   - mode: "manual", "pr-comment", "auto-approve-non-critical", or "external"
 *   - If mode is "auto-approve-*": must also declare autoApproveConditions
 *   - notifyOnChange: boolean (should team be notified?)
 *
 * "auto-approve-all" is forbidden — it makes VRT a no-op.
 */

const VALID_MODES = new Set(['manual', 'pr-comment', 'auto-approve-non-critical', 'external', 'chromatic-ui', 'percy-dashboard']);
const FORBIDDEN_MODES = new Set(['auto-approve-all', 'skip', 'none', 'ignore']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'visual-regression-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA063', message: 'visual-regression-spec.json not readable' }; }

  const workflow = spec.approvalWorkflow;

  if (!workflow || typeof workflow !== 'object') {
    return {
      pass: false, code: 'QA063',
      message: 'spec.approvalWorkflow not declared',
      detail: 'Add an approval workflow. Example:\n  "approvalWorkflow": {\n    "mode": "pr-comment",\n    "notifyOnChange": true\n  }',
    };
  }

  const mode = workflow.mode;
  if (!mode) {
    return { pass: false, code: 'QA063', message: 'approvalWorkflow.mode is required' };
  }

  if (FORBIDDEN_MODES.has(mode)) {
    return {
      pass: false, code: 'QA063',
      message: `approvalWorkflow.mode "${mode}" is forbidden — makes visual regression testing a no-op`,
      detail: `Valid modes: ${[...VALID_MODES].join(', ')}`,
    };
  }

  if (!VALID_MODES.has(mode)) {
    return {
      pass: false, code: 'QA063',
      message: `approvalWorkflow.mode "${mode}" not recognised`,
      detail: `Valid modes: ${[...VALID_MODES].join(', ')}`,
    };
  }

  // Auto-approve modes must declare conditions
  if (mode.startsWith('auto-approve') && mode !== 'auto-approve-non-critical') {
    if (!workflow.autoApproveConditions) {
      return {
        pass: false, code: 'QA063',
        message: `approvalWorkflow.mode "${mode}" requires autoApproveConditions to be declared`,
      };
    }
  }

  const notifyStr = workflow.notifyOnChange === true ? ', notifications: enabled' : '';
  return {
    pass: true, code: 'QA063',
    message: `approvalWorkflow: mode "${mode}"${notifyStr}`,
  };
}
