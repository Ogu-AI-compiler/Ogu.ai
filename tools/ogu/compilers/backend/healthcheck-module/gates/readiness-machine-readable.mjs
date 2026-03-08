import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * HC003 — readiness-machine-readable
 * Readiness endpoint must return JSON with per-dependency status.
 * Expected shape: { status: "healthy"|"degraded"|"unhealthy", dependencies: { [name]: { status, latencyMs } } }
 */

const MACHINE_READABLE_PATTERNS = [
  /status\s*:\s*['"`]healthy['"`]/,
  /status\s*:\s*['"`]unhealthy['"`]/,
  /status\s*:\s*['"`]degraded['"`]/,
  /dependencies\s*:/,
  /res\.json\s*\(/,
  /reply\.send\s*\(/,   // fastify
  /JSON\.stringify/,
];

const PER_DEPENDENCY_PATTERNS = [
  /\[.*name.*\]\s*:/,           // dynamic key per dep name
  /dependencies\s*\[/,
  /\.forEach\s*\(.*dep/,
  /Object\.fromEntries/,
  /reduce\s*\(/,
];

function findReadinessFile(dir) {
  const candidates = [
    'src/lib/health/readiness.ts',
    'src/health/readiness.ts',
    'lib/health/readiness.ts',
  ];
  for (const c of candidates) {
    const p = join(dir, c);
    if (existsSync(p)) return p;
  }
  return null;
}

export async function run({ dir }) {
  const readinessFile = findReadinessFile(dir);

  if (!readinessFile) {
    return {
      pass: false, code: 'HC003',
      message: 'Readiness file not found (expected src/lib/health/readiness.ts)',
      detail: 'Create src/lib/health/readiness.ts that returns JSON with per-dependency status'
    };
  }

  const content = readFileSync(readinessFile, 'utf8');

  const hasMachineReadable = MACHINE_READABLE_PATTERNS.some(p => p.test(content));
  if (!hasMachineReadable) {
    return {
      pass: false, code: 'HC003',
      message: 'Readiness output is not machine-readable JSON',
      detail: 'Return: res.json({ status: "healthy"|"degraded"|"unhealthy", dependencies: { postgres: { status: "healthy", latencyMs: 12 } } })'
    };
  }

  const hasPerDependency = PER_DEPENDENCY_PATTERNS.some(p => p.test(content)) ||
    content.includes('dependencies');
  if (!hasPerDependency) {
    return {
      pass: false, code: 'HC003',
      message: 'Readiness output does not include per-dependency status',
      detail: 'Each dependency must appear by name in the response: { dependencies: { postgres: { status }, redis: { status } } }'
    };
  }

  return { pass: true, code: 'HC003', message: 'Readiness handler returns machine-readable per-dependency JSON' };
}
