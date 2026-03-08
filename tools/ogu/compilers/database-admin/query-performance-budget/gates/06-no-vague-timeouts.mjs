/**
 * Gate: no-vague-timeouts (QPB006)
 * All timeout values across all workloads must be concrete duration strings.
 * Vague timeout values ("high", "low", "unlimited", "TBD") cannot be enforced
 * by PostgreSQL's statement_timeout or set_config calls.
 *
 * This gate does a final sweep across all declared timeout fields.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DURATION_RE = /^(\d+(?:\.\d+)?)\s*(ms|s|m|min|h)$/i;
const VAGUE_VALUES = ['high', 'low', 'medium', 'fast', 'slow', 'acceptable', 'tbd', 'none', 'unlimited', 'infinite', 'n/a', 'ok', 'good'];

const TIMEOUT_FIELDS = ['statement_timeout', 'lock_timeout', 'idle_in_transaction_timeout', 'connect_timeout'];

export async function run({ dir }) {
  const specPath = join(dir, 'query-performance-budget.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'QPB006', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'QPB006', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  const violations = [];

  function checkTimeout(label, value) {
    if (value === undefined || value === null) return;
    const str = String(value).trim();
    const lower = str.toLowerCase();
    if (VAGUE_VALUES.includes(lower)) {
      violations.push(`${label}: "${value}" is a vague value — use a concrete duration like "5s" or "500ms"`);
      return;
    }
    if (!DURATION_RE.test(str)) {
      violations.push(`${label}: "${value}" is not a valid duration format — use "5s", "500ms", "2m", "1h"`);
    }
  }

  // Check top-level timeout fields
  for (const field of TIMEOUT_FIELDS) {
    if (field in spec) {
      checkTimeout(field, spec[field]);
    }
  }

  // Check max_transaction_duration
  if (spec.max_transaction_duration) {
    checkTimeout('max_transaction_duration', spec.max_transaction_duration);
  }

  // Check workload-level timeout fields
  if (spec.workloads && typeof spec.workloads === 'object') {
    for (const [name, workload] of Object.entries(spec.workloads)) {
      for (const field of TIMEOUT_FIELDS) {
        if (field in workload) {
          checkTimeout(`workloads.${name}.${field}`, workload[field]);
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'QPB006',
      message: `${violations.length} vague or invalid timeout value(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'QPB006',
    message: 'All timeout values are concrete, parseable durations',
  };
}
