import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA046 — output-artifacts-defined
 * The spec must declare where load test output is stored.
 *
 * Without artifact configuration, load test results are ephemeral — they vanish
 * after the CI run, making it impossible to:
 *   - Compare results across runs (trend analysis)
 *   - Debug failures after the fact
 *   - Produce PR summary comments
 *   - Feed into baseline comparison (QA047)
 *
 * Required: spec.outputArtifacts with at least one of:
 *   - resultsFile: path to JSON/CSV results file (e.g. "results/load-results.json")
 *   - htmlReport: path to HTML report
 *   - summaryFile: path to summary JSON for CI comments
 *   - dashboard: URL or tool reference (e.g. "grafana", "datadog", "k6-cloud")
 */

const VALID_ARTIFACT_KEYS = ['resultsFile', 'htmlReport', 'summaryFile', 'dashboard', 'influxdb', 'prometheus'];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'load-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA046', message: 'load-test-spec.json not readable' }; }

  const artifacts = spec.outputArtifacts;

  if (!artifacts || typeof artifacts !== 'object' || Array.isArray(artifacts)) {
    return {
      pass: false, code: 'QA046',
      message: 'spec.outputArtifacts not declared',
      detail: 'Add output artifact configuration. Example:\n  "outputArtifacts": {\n    "resultsFile": "results/load-test.json",\n    "htmlReport": "results/report.html"\n  }',
    };
  }

  const declared = VALID_ARTIFACT_KEYS.filter(k => artifacts[k] !== undefined && artifacts[k] !== null && artifacts[k] !== '');

  if (declared.length === 0) {
    return {
      pass: false, code: 'QA046',
      message: 'outputArtifacts object is empty — no output destinations configured',
      detail: `Add at least one of: ${VALID_ARTIFACT_KEYS.join(', ')}`,
    };
  }

  return {
    pass: true, code: 'QA046',
    message: `${declared.length} output artifact(s) declared: ${declared.join(', ')}`,
  };
}
