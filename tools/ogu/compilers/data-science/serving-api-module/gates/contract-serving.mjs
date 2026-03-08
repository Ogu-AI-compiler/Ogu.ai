import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SA010 — contract-serving
 * Verifies that ML serving APIs satisfy the serving contract:
 * typed input schema, health endpoint, structured logging, no bare except.
 *
 * Why:
 * - Typed input schema (Pydantic/marshmallow): unvalidated inputs cause
 *   silent model failures — wrong dtype, missing field, out-of-range value —
 *   all produce predictions on garbage inputs with no error surfaced to callers.
 * - /health endpoint: required for load balancer liveness checks, container
 *   orchestration (k8s readiness probes), and deployment automation. A serving
 *   API without /health cannot be safely deployed to a managed platform.
 * - Structured logging: serving metrics (request volume, latency, error rate)
 *   are only observable if logs are in a parseable format. print() outputs
 *   cannot be aggregated or alerted on.
 * - No bare except: bare except: swallows SystemExit, KeyboardInterrupt, and
 *   OOM errors, causing the API to return 200 OK on fatal failures.
 *
 * Escape hatch: none — these are non-negotiable for production ML serving APIs.
 */

const RULES = [
  {
    id: 'pydantic-schema',
    description: 'Pydantic BaseModel or marshmallow Schema for input validation',
    test: c => /BaseModel|from pydantic|from marshmallow|Schema\s*\(/.test(c),
  },
  {
    id: 'health-endpoint',
    description: '/health or /ping endpoint defined',
    test: c => /['"]\/health['"]|['"]\/ping['"]|\/healthz/.test(c),
  },
  {
    id: 'structured-logging',
    description: 'logging module used (not print statements)',
    test: c => /import logging|from logging import|getLogger/.test(c),
  },
  {
    id: 'no-bare-except',
    description: 'No bare except: blocks (catches SystemExit and OOM errors)',
    test: c => !/^\s*except\s*:/m.test(c),
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) return { pass: false, code: 'SA010', message: 'No Python files found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'SA010',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'SA010', message: 'All serving API contract rules passed' };
}
