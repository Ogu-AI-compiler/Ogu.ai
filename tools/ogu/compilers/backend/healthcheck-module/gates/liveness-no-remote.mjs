import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * HC002 — liveness-no-remote
 * Liveness checks must not depend on remote systems (DB, HTTP, Redis, queues).
 * Liveness = "is the process itself alive?" — not "can it reach dependencies?".
 * A liveness check that calls Redis will falsely report "dead" when Redis is down,
 * causing the orchestrator to kill and restart a perfectly healthy process.
 */

const REMOTE_PATTERNS = [
  /prisma\./,
  /db\./,
  /pool\./,
  /redis\./,
  /client\.(get|set|ping|query)/,
  /fetch\s*\(/,
  /axios\./,
  /queue\./,
  /bullmq/,
  /\.query\s*\(/,
  /\.ping\s*\(/,
];

function findLivenessFile(dir) {
  const candidates = [
    'src/lib/health/liveness.ts',
    'src/health/liveness.ts',
    'lib/health/liveness.ts',
    'health/liveness.ts',
  ];
  for (const c of candidates) {
    const p = join(dir, c);
    if (existsSync(p)) return p;
  }
  return null;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'healthcheck-spec.json'), 'utf8'));

  // If livenessChecks is empty or absent, it's not a remote call risk
  if (!spec.livenessChecks || spec.livenessChecks.length === 0) {
    const livenessFile = findLivenessFile(dir);
    if (!livenessFile) {
      return {
        pass: true, code: 'HC002',
        message: 'No liveness file found — liveness-no-remote gate skipped',
        skipped: true
      };
    }

    const content = readFileSync(livenessFile, 'utf8');
    const violations = [];
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (REMOTE_PATTERNS.some(p => p.test(line)) && !line.trim().startsWith('//')) {
        violations.push(`${livenessFile.replace(dir + '/', '')}:${i + 1} — remote call in liveness: ${line.trim()}`);
      }
    });

    if (violations.length) {
      return {
        pass: false, code: 'HC002',
        message: `${violations.length} remote call(s) detected in liveness check`,
        detail: violations.join('\n') + '\n\nLiveness must only check process-local state (uptime, memory, in-memory flag)'
      };
    }

    return { pass: true, code: 'HC002', message: 'Liveness check has no remote calls' };
  }

  // If liveness checks are named, verify they're not the same as readiness dependencies
  const readinessDeps = spec.dependencies.map(d => d.name.toLowerCase());
  const livenessViolations = spec.livenessChecks.filter(c =>
    readinessDeps.includes(c.toLowerCase()) ||
    ['database', 'redis', 'db', 'postgres', 'mysql', 'queue'].some(r => c.toLowerCase().includes(r))
  );

  if (livenessViolations.length) {
    return {
      pass: false, code: 'HC002',
      message: `Liveness checks reference remote systems: ${livenessViolations.join(', ')}`,
      detail: 'Liveness should only contain: uptime, processMemory, localFlag. Move remote checks to readiness.'
    };
  }

  return { pass: true, code: 'HC002', message: `Liveness checks are local-only: ${spec.livenessChecks.join(', ')}` };
}
