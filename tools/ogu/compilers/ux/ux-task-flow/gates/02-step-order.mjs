/**
 * Gate UTK002 — step-order
 * Steps must have unique sequential `order` integers with no gaps.
 * Acceptable sequences: 0,1,2,... or 1,2,3,...
 * Gaps (e.g., 0,1,3) or duplicates are violations.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'task-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UTK002',
      message: 'task-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UTK002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return {
      pass: true,
      code: 'UTK002',
      message: 'No steps to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  // Check each step has an `order` field that is an integer
  const ordersFound = [];
  spec.steps.forEach((step, i) => {
    if (typeof step.order !== 'number' || !Number.isInteger(step.order)) {
      violations.push(`steps[${i}] (id="${step.id ?? 'unknown'}") missing or non-integer field: order`);
    } else {
      ordersFound.push(step.order);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTK002',
      message: `${violations.length} step(s) missing integer order field`,
      detail: violations.join('\n'),
    };
  }

  // Check for duplicate order values
  const seen = new Set();
  const duplicates = [];
  for (const ord of ordersFound) {
    if (seen.has(ord)) {
      duplicates.push(ord);
    }
    seen.add(ord);
  }
  if (duplicates.length > 0) {
    return {
      pass: false,
      code: 'UTK002',
      message: `Duplicate step order values: ${[...new Set(duplicates)].join(', ')}`,
    };
  }

  // Check for gaps — sort and verify sequence is contiguous
  const sorted = [...ordersFound].sort((a, b) => a - b);
  const min = sorted[0];

  // Only allow starting at 0 or 1
  if (min !== 0 && min !== 1) {
    return {
      pass: false,
      code: 'UTK002',
      message: `Step order must start at 0 or 1, but starts at ${min}`,
    };
  }

  const gapViolations = [];
  for (let i = 0; i < sorted.length; i++) {
    const expected = min + i;
    if (sorted[i] !== expected) {
      gapViolations.push(`Gap in order sequence: expected ${expected}, found ${sorted[i]}`);
    }
  }

  if (gapViolations.length > 0) {
    return {
      pass: false,
      code: 'UTK002',
      message: `Step order sequence has gaps`,
      detail: gapViolations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UTK002',
    message: `step-order: ${sorted.length} step(s) with valid sequential order (${min}…${sorted[sorted.length - 1]})`,
  };
}
