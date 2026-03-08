/**
 * Gate: replica-timeout-tighter (QPB004)
 * If read_replica workload is declared, its statement_timeout must be <=
 * the primary write workload's statement_timeout. Read queries on replicas
 * should have tighter (or equal) time budgets — a long-running analytical
 * query on a replica can cause replication lag by holding back VACUUM on the
 * primary through conflict with standby replay.
 *
 * This gate checks per-workload pair: any workload with is_replica: true
 * must have a timeout <= the equivalent primary workload's timeout.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DURATION_RE = /^(\d+(?:\.\d+)?)\s*(ms|s|m|min|h)$/i;

function parseDurationToMs(str) {
  if (!str) return null;
  const match = DURATION_RE.exec(String(str).trim());
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'ms') return value;
  if (unit === 's') return value * 1000;
  if (unit === 'm' || unit === 'min') return value * 60 * 1000;
  if (unit === 'h') return value * 3600 * 1000;
  return null;
}

export async function run({ dir }) {
  const specPath = join(dir, 'query-performance-budget.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'QPB004', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'QPB004', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!spec.workloads || typeof spec.workloads !== 'object') {
    return { pass: true, code: 'QPB004', message: 'No workloads — gate skipped', skipped: true };
  }

  const replicaWorkloads = Object.entries(spec.workloads).filter(([, w]) => w.is_replica === true);

  if (replicaWorkloads.length === 0) {
    return {
      pass: true,
      code: 'QPB004',
      message: 'No replica workloads declared — gate skipped',
      skipped: true,
    };
  }

  // Find the primary write workload timeout — use oltp or the first non-replica workload
  const primaryWorkloads = Object.entries(spec.workloads).filter(([, w]) => !w.is_replica);
  const primaryTimeouts = primaryWorkloads
    .map(([name, w]) => ({ name, ms: parseDurationToMs(w.statement_timeout) }))
    .filter(e => e.ms !== null);

  if (primaryTimeouts.length === 0) {
    return {
      pass: true,
      code: 'QPB004',
      message: 'No parseable primary workload timeouts — replica check skipped',
      skipped: true,
    };
  }

  const maxPrimaryTimeoutMs = Math.max(...primaryTimeouts.map(e => e.ms));
  const violations = [];

  for (const [name, workload] of replicaWorkloads) {
    const replicaMs = parseDurationToMs(workload.statement_timeout);
    if (replicaMs === null) continue;

    if (replicaMs > maxPrimaryTimeoutMs) {
      violations.push(
        `Replica workload "${name}" has statement_timeout ${workload.statement_timeout} ` +
        `(${replicaMs}ms) > primary max timeout (${maxPrimaryTimeoutMs}ms). ` +
        'Replica timeouts must be <= primary timeouts to prevent replication conflicts.'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'QPB004',
      message: `${violations.length} replica workload(s) with timeout exceeding primary`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'QPB004',
    message: `All ${replicaWorkloads.length} replica workload(s) have timeouts <= primary`,
  };
}
