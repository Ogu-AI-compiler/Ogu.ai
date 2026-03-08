import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * MM003 — retraining-trigger
 * Model monitoring configs must declare the conditions that trigger retraining.
 *
 * Why:
 * - Without explicit retraining triggers, model degradation persists until
 *   a human notices and manually initiates retraining. This can take weeks.
 * - Explicit triggers enable automated retraining pipelines (MLOps):
 *   when drift score exceeds threshold OR performance drops below SLO,
 *   a pipeline automatically kicks off data collection and retraining.
 * - Retraining triggers must specify BOTH condition AND action:
 *   - "performance_drop" → what metric? what threshold?
 *   - "scheduled" → what schedule? what data window?
 *   - "drift_detected" → which drift metric triggers it?
 * - Without this, teams operate in "retraining by escalation" mode:
 *   business stakeholders notice metric drops, escalate to DS team,
 *   DS team investigates, 2-4 weeks later the model is updated.
 *
 * Supported trigger types: drift_threshold, performance_drop,
 * scheduled, data_volume, manual_approval.
 *
 * Escape hatch: add "retrainingManual": true for models where automated
 * retraining is intentionally prohibited (e.g., regulatory models requiring
 * human review before every update).
 */

const VALID_TRIGGER_TYPES = new Set([
  'drift_threshold', 'performance_drop', 'scheduled',
  'data_volume', 'manual_approval', 'custom',
]);

export async function run({ dir }) {
  let config;
  try { config = JSON.parse(readFileSync(join(dir, 'monitoring-config.json'), 'utf8')); }
  catch { return { pass: false, code: 'MM003', message: 'monitoring-config.json not readable' }; }

  if (config.retrainingManual === true) {
    return { pass: true, code: 'MM003', message: 'Retraining is manual/human-approved (intentional)', skipped: true };
  }

  const triggers = config.retraining_triggers;
  if (!triggers || !Array.isArray(triggers) || triggers.length === 0) {
    return {
      pass: false, code: 'MM003',
      message: 'No retraining_triggers declared in monitoring-config.json',
      detail: 'Add to monitoring-config.json:\n' +
        '  "retraining_triggers": [\n' +
        '    {\n' +
        '      "type": "performance_drop",\n' +
        '      "metric": "f1_score",\n' +
        '      "threshold": 0.05,\n' +
        '      "action": "trigger_pipeline",\n' +
        '      "pipeline": "training_pipeline_v2"\n' +
        '    },\n' +
        '    {\n' +
        '      "type": "scheduled",\n' +
        '      "schedule": "0 0 * * 1",\n' +
        '      "data_window_days": 90\n' +
        '    }\n' +
        '  ]',
    };
  }

  const issues = [];
  for (const [i, t] of triggers.entries()) {
    if (!t.type) {
      issues.push(`retraining_triggers[${i}]: missing "type"`);
      continue;
    }
    if (!VALID_TRIGGER_TYPES.has(t.type)) {
      issues.push(`retraining_triggers[${i}]: unknown type "${t.type}"`);
    }
    if ((t.type === 'performance_drop' || t.type === 'drift_threshold') && !t.threshold) {
      issues.push(`retraining_triggers[${i}] type="${t.type}": missing "threshold"`);
    }
    if (t.type === 'scheduled' && !t.schedule) {
      issues.push(`retraining_triggers[${i}] type="scheduled": missing "schedule" (cron expression)`);
    }
    if (!t.action && t.type !== 'manual_approval') {
      issues.push(`retraining_triggers[${i}]: missing "action" — what happens when trigger fires?`);
    }
  }

  if (issues.length) {
    return {
      pass: false, code: 'MM003',
      message: `${issues.length} issue(s) in retraining_triggers`,
      detail: issues.join('\n'),
    };
  }

  return {
    pass: true, code: 'MM003',
    message: `${triggers.length} retraining trigger(s) declared: ${triggers.map(t => t.type).join(', ')}`,
  };
}
