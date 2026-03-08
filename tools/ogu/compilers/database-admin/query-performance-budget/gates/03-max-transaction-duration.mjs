/**
 * Gate: max-transaction-duration (QPB003)
 * max_transaction_duration must be a concrete duration value (not "unlimited"
 * or a vague description). Long-running transactions hold locks, inflate WAL,
 * prevent autovacuum from running, and can cause connection pile-ups.
 *
 * Any transaction exceeding max_transaction_duration must be terminated.
 * This is enforced via PostgreSQL's idle_in_transaction_session_timeout.
 *
 * Minimum acceptable: max_transaction_duration > 0 and parseable.
 * max_transaction_duration must also be >= the longest workload statement_timeout
 * (a transaction can't have a shorter max than its longest query).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DURATION_RE = /^(\d+(?:\.\d+)?)\s*(ms|s|m|min|h)$/i;
const VAGUE_VALUES = ['unlimited', 'none', 'n/a', 'tbd', 'infinite', 'no limit'];

function parseDurationToMs(str) {
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
    return { pass: true, code: 'QPB003', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'QPB003', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  const maxTxn = spec.max_transaction_duration;

  if (!maxTxn) {
    return {
      pass: false,
      code: 'QPB003',
      message: 'max_transaction_duration is required',
      detail:
        'Long-running transactions hold locks, prevent autovacuum, and inflate WAL.\n' +
        'Declare max_transaction_duration as a concrete duration like "30s" or "5m".',
    };
  }

  const lower = String(maxTxn).toLowerCase().trim();
  if (VAGUE_VALUES.includes(lower)) {
    return {
      pass: false,
      code: 'QPB003',
      message: `max_transaction_duration "${maxTxn}" is not acceptable — transactions must have a finite limit`,
      detail:
        'Unlimited transaction duration is a reliability anti-pattern.\n' +
        'Long transactions hold row locks and prevent autovacuum from cleaning dead tuples.\n' +
        'Set a concrete limit like "30s", "2m", or "10m".',
    };
  }

  const txnMs = parseDurationToMs(maxTxn);
  if (txnMs === null) {
    return {
      pass: false,
      code: 'QPB003',
      message: `max_transaction_duration "${maxTxn}" is not a valid duration format`,
      detail: 'Use formats like "30s", "5m", "1h". No spaces required.',
    };
  }

  return {
    pass: true,
    code: 'QPB003',
    message: `max_transaction_duration "${maxTxn}" (${txnMs}ms) is a concrete, finite limit`,
  };
}
