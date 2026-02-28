/**
 * Telemetry Exporter — export metrics in Prometheus/JSON format.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Export metrics in Prometheus text format.
 *
 * @param {Object<string, { type: string, value: number }>} metrics
 * @returns {string}
 */
export function exportPrometheus(metrics) {
  const lines = [];
  for (const [name, data] of Object.entries(metrics)) {
    lines.push(`# TYPE ${name} ${data.type}`);
    lines.push(`${name} ${data.value}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Export metrics as JSON.
 *
 * @param {Object<string, { type: string, value: number }>} metrics
 * @returns {string}
 */
export function exportJSON(metrics) {
  return JSON.stringify({
    metrics,
    timestamp: new Date().toISOString(),
  }, null, 2);
}

/**
 * Collect basic system metrics from Ogu state.
 *
 * @param {{ root: string }} opts
 * @returns {Object<string, { type: string, value: number }>}
 */
export function collectSystemMetrics({ root }) {
  return {
    'ogu_state_exists': {
      type: 'gauge',
      value: existsSync(join(root, '.ogu/STATE.json')) ? 1 : 0,
    },
    'ogu_audit_exists': {
      type: 'gauge',
      value: existsSync(join(root, '.ogu/audit/current.jsonl')) ? 1 : 0,
    },
    'ogu_budget_exists': {
      type: 'gauge',
      value: existsSync(join(root, '.ogu/budget/budget-state.json')) ? 1 : 0,
    },
  };
}
