import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * HC004 — dependency-timeouts
 * Every dependency check must be bounded by a timeout.
 * An unbound health check blocks the readiness endpoint until the dependency times out (could be minutes).
 */

const TIMEOUT_PATTERNS = [
  /Promise\.race\s*\(/,
  /AbortSignal\.timeout/,
  /setTimeout.*reject/,
  /timeoutMs|timeout\s*:/,
  /withTimeout/,
  /\.timeout\s*\(/,
];

function findHealthFiles(dir) {
  const results = [];
  const candidates = [
    'src/lib/health/readiness.ts',
    'src/lib/health/liveness.ts',
    'src/lib/health/index.ts',
    'src/health/readiness.ts',
  ];
  for (const c of candidates) {
    const p = join(dir, c);
    if (existsSync(p)) results.push(p);
  }
  return results;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'healthcheck-spec.json'), 'utf8'));
  const remoteDeps = spec.dependencies.filter(d => ['database', 'redis', 'http', 'queue', 'storage'].includes(d.type));

  if (remoteDeps.length === 0) {
    return { pass: true, code: 'HC004', message: 'No remote dependencies — timeout check skipped', skipped: true };
  }

  const healthFiles = findHealthFiles(dir);
  if (healthFiles.length === 0) {
    return {
      pass: false, code: 'HC004',
      message: 'Health module files not found — cannot verify timeout enforcement',
      detail: 'Create src/lib/health/readiness.ts with bounded dependency checks'
    };
  }

  const allContent = healthFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const hasTimeout = TIMEOUT_PATTERNS.some(p => p.test(allContent));

  if (!hasTimeout) {
    return {
      pass: false, code: 'HC004',
      message: 'Dependency health checks have no timeout bounds',
      detail: `Remote dependencies require timeout: ${remoteDeps.map(d => `${d.name} (${d.timeoutMs}ms)`).join(', ')}\n\nUse: Promise.race([check(), timeout(dep.timeoutMs)])`
    };
  }

  return {
    pass: true, code: 'HC004',
    message: `Dependency checks are timeout-bounded (${remoteDeps.length} remote dependency/dependencies)`
  };
}
