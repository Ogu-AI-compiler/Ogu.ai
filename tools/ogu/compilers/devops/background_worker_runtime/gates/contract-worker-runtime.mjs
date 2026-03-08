/**
 * Gate: contract-worker-runtime (BW008)
 * Enforces the background_worker_runtime contract: a dead-letter queue must be
 * configured (without it, messages that exhaust retries are silently dropped),
 * an owner identifies the accountable team, maxRetries must be explicitly set
 * (broker defaults vary from 0 to infinite), and concurrency must be declared
 * to prevent unbounded resource usage under load.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'bg-worker-spec.json'), 'utf8'));
  const violations = [];

  // Dead letter queue is required — without it, failed messages are silently dropped
  if (!spec.deadLetterQueue) {
    violations.push({
      rule:   'dead-letter-queue-required',
      reason: 'No deadLetterQueue configured — messages that exceed maxRetries will be silently lost with no recovery path',
      hint:   'Add deadLetterQueue: "orders-dlq" to capture failed messages for inspection and replay',
    });
  }

  // Owner is required for operational accountability
  if (!spec.owner) {
    violations.push({
      rule:   'owner-required',
      reason: 'owner field is required — without an owner, no team is accountable for this worker',
      hint:   'Add owner: "platform-team" or the name of the team responsible for this worker',
    });
  }

  // maxRetries must be set — default behaviour varies by broker and may be infinite or 0
  if (spec.maxRetries === undefined) {
    violations.push({
      rule:   'max-retries-required',
      reason: 'maxRetries not set — broker defaults vary from 0 to infinite; explicit configuration is required',
      hint:   'Add maxRetries: 3 (or another positive integer). Set to 0 for no retries, but ensure a DLQ is configured',
    });
  } else if (!Number.isInteger(spec.maxRetries) || spec.maxRetries < 0) {
    violations.push({
      rule:     'max-retries-invalid',
      received: spec.maxRetries,
      reason:   `maxRetries must be a non-negative integer, got: ${spec.maxRetries}`,
      hint:     'Use 0 for no retries (messages go straight to DLQ), or a positive integer for retry-with-backoff',
    });
  }

  // Concurrency must be explicitly declared to avoid unbounded resource usage
  if (spec.concurrency === undefined && !spec.skipConcurrencyCheck) {
    violations.push({
      rule:   'concurrency-required',
      reason: 'concurrency not set — an unbound worker will consume as many messages as the broker delivers, exhausting CPU and memory under load',
      hint:   'Add concurrency: 10 (parallel message slots), or skipConcurrencyCheck: true if the broker enforces this externally',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'BW008',
      message: `${violations.length} contract violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'BW008',
    message: `Worker runtime contract satisfied — ${spec.name}, DLQ: ${spec.deadLetterQueue}, retries: ${spec.maxRetries}`,
  };
}
