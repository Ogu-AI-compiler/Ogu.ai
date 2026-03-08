import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * AB006 — guardrail-metrics
 * A/B tests must monitor guardrail metrics alongside the primary metric to
 * detect regressions in product health while optimizing for the experiment goal.
 *
 * Why:
 * - Optimizing a single metric in isolation creates blind spots. A treatment
 *   that increases conversion rate by 5% while increasing error rate by 50%
 *   is a net negative for users and business — but a test monitoring only
 *   conversion rate would declare it a success.
 * - Guardrail metrics are the "do no harm" contract of A/B testing:
 *   even if the primary metric improves, the test must not degrade:
 *   - Latency (p99 response time) — user experience
 *   - Error rate (4xx/5xx rate) — reliability
 *   - Revenue per user — business health
 *   - Session duration — engagement quality
 * - Without guardrail monitoring, the treatment might be winning on the
 *   primary metric due to a confounder (users are less engaged but convert
 *   faster because the page loads with errors).
 *
 * Escape hatch: add "guardrailsInDashboard": true to ab-test-spec.json
 * if guardrail monitoring is configured in an external experimentation platform.
 */

const GUARDRAIL_CODE_RE = /guardrail|secondary.metric|safety.metric|error.rate|latency|p99|p95|revenue.regression|crash.rate|session.duration/i;

function extractContent(dir) {
  const parts = [];
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.py') || f.endsWith('.md')) {
      parts.push(readFileSync(join(dir, f), 'utf8'));
    } else if (f.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        for (const c of nb.cells ?? []) parts.push((c.source ?? []).join(''));
      } catch { /* skip */ }
    }
  }
  return parts.join('\n');
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'ab-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'AB006', message: 'ab-test-spec.json not readable' }; }

  if (spec.guardrailsInDashboard === true) {
    return { pass: true, code: 'AB006', message: 'Guardrail metrics monitored in external dashboard', skipped: true };
  }

  const specGuardrails = spec.guardrail_metrics;
  if (Array.isArray(specGuardrails) && specGuardrails.length > 0) {
    return {
      pass: true, code: 'AB006',
      message: `Guardrail metrics declared in spec: ${specGuardrails.join(', ')}`,
    };
  }

  const content = extractContent(dir);
  if (GUARDRAIL_CODE_RE.test(content)) {
    return { pass: true, code: 'AB006', message: 'Guardrail metrics monitored in analysis code' };
  }

  return {
    pass: false, code: 'AB006',
    message: 'No guardrail metrics defined for A/B test',
    detail: 'Add to ab-test-spec.json:\n' +
      '  "guardrail_metrics": [\n' +
      '    { "name": "latency_p99_ms", "max_degradation": 0.05 },\n' +
      '    { "name": "error_rate",     "max_degradation": 0.10 },\n' +
      '    { "name": "revenue_per_user" }\n' +
      '  ]\n\n' +
      'Or monitor in analysis code:\n' +
      '  guardrail_results = {\n' +
      '      "error_rate": test_error_rate - control_error_rate,\n' +
      '      "latency_p99": test_p99 - control_p99,\n' +
      '  }\n' +
      '  assert all(v < threshold for v in guardrail_results.values()), "Guardrail violated"',
  };
}
