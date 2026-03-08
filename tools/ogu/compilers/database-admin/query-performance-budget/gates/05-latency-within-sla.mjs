/**
 * Gate: latency-within-sla (QPB005)
 * If api_slo_ms is declared (the user-facing API response time SLA), the
 * OLTP workload's p99_latency_ms + p99_latency_ms must be < api_slo_ms.
 * The database budget must be tighter than the API SLO — the application
 * layer needs latency headroom for network, business logic, and serialization.
 *
 * Rule: oltp.p99_latency_ms < api_slo_ms * 0.7 (database should use <= 70% of SLO)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DB_BUDGET_FRACTION = 0.7;

export async function run({ dir }) {
  const specPath = join(dir, 'query-performance-budget.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'QPB005', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'QPB005', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!spec.api_slo_ms) {
    return {
      pass: true,
      code: 'QPB005',
      message: 'api_slo_ms not declared — SLA alignment check skipped',
      skipped: true,
    };
  }

  if (!spec.workloads || typeof spec.workloads !== 'object') {
    return { pass: true, code: 'QPB005', message: 'No workloads — gate skipped', skipped: true };
  }

  const apiSloMs = spec.api_slo_ms;
  const maxDbBudgetMs = apiSloMs * DB_BUDGET_FRACTION;
  const violations = [];

  for (const [name, workload] of Object.entries(spec.workloads)) {
    if (workload.is_replica) continue;
    if (typeof workload.p99_latency_ms !== 'number') continue;

    if (workload.p99_latency_ms > maxDbBudgetMs) {
      violations.push(
        `Workload "${name}": p99_latency_ms (${workload.p99_latency_ms}ms) exceeds ${DB_BUDGET_FRACTION * 100}% of api_slo_ms (${apiSloMs}ms). ` +
        `Database budget must be <= ${maxDbBudgetMs}ms to leave headroom for the application layer.`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'QPB005',
      message: `${violations.length} workload(s) exceeding API SLO budget`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'QPB005',
    message: `All workload p99 budgets fit within api_slo_ms (${apiSloMs}ms) × ${DB_BUDGET_FRACTION}`,
  };
}
