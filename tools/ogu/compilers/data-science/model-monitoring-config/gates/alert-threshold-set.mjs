import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * MM004 — alert-threshold-set
 * Model monitoring configs must declare alert thresholds for all monitored metrics.
 *
 * Why:
 * - Monitoring without alerting is observability theater: data is collected,
 *   dashboards are built, and nobody looks at them until a business stakeholder
 *   notices a metric drop weeks later.
 * - Thresholds define what "abnormal" means for this specific model and use case.
 *   A 10% performance drop may be tolerable for a recommendation system but
 *   critical for a fraud detection model. Thresholds encode this knowledge.
 * - Automated alerting enables <1 hour MTTR (Mean Time to Repair) for model
 *   degradation. Without it, MTTR is measured in days.
 * - Alert thresholds should be set conservatively at first and tightened
 *   as the model's behavior in production becomes better understood.
 *
 * Required: each item in drift_metrics and performance_metrics must declare
 * a threshold AND an alert_action (who/what gets notified).
 *
 * Escape hatch: add "alertsExternal": true if alerting is configured in an
 * external monitoring platform (Datadog, PagerDuty, Grafana alerts).
 */

export async function run({ dir }) {
  let config;
  try { config = JSON.parse(readFileSync(join(dir, 'monitoring-config.json'), 'utf8')); }
  catch { return { pass: false, code: 'MM004', message: 'monitoring-config.json not readable' }; }

  if (config.alertsExternal === true) {
    return { pass: true, code: 'MM004', message: 'Alerting configured in external monitoring platform', skipped: true };
  }

  const issues = [];
  let checkedCount = 0;

  // Check drift_metrics
  for (const [i, m] of (config.drift_metrics ?? []).entries()) {
    checkedCount++;
    if (m.threshold === undefined || m.threshold === null) {
      issues.push(`drift_metrics[${i}] "${m.name}": missing threshold`);
    }
    if (!m.alert_action && !config.default_alert_action) {
      issues.push(`drift_metrics[${i}] "${m.name}": missing alert_action (or set default_alert_action)`);
    }
  }

  // Check performance_metrics
  for (const [i, m] of (config.performance_metrics ?? []).entries()) {
    checkedCount++;
    if (m.threshold === undefined || m.threshold === null) {
      issues.push(`performance_metrics[${i}] "${m.name}": missing threshold`);
    }
  }

  if (checkedCount === 0) {
    return {
      pass: false, code: 'MM004',
      message: 'No monitored metrics declared — nothing to set thresholds for',
      detail: 'Add drift_metrics or performance_metrics to monitoring-config.json first.',
    };
  }

  if (issues.length) {
    return {
      pass: false, code: 'MM004',
      message: `${issues.length} metric(s) missing alert thresholds`,
      detail: issues.join('\n') +
        '\n\nAdd thresholds and actions:\n' +
        '  "default_alert_action": "slack:#ml-alerts",\n' +
        '  "drift_metrics": [\n' +
        '    {\n' +
        '      "name": "feature_drift",\n' +
        '      "drift_test": "ks_test",\n' +
        '      "threshold": 0.05,\n' +
        '      "alert_action": "pagerduty:ml-oncall"\n' +
        '    }\n' +
        '  ]',
    };
  }

  return {
    pass: true, code: 'MM004',
    message: `Alert thresholds set for all ${checkedCount} monitored metric(s)`,
  };
}
