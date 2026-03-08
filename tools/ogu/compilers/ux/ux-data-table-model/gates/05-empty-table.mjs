/**
 * Gate UDT005 — empty-table
 * Spec must declare emptyState object with:
 * - message (string)
 * - optionally createAction (string)
 * A blank table with no feedback is a violation.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'data-table-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDT005',
      message: 'data-table-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UDT005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (typeof spec.emptyState !== 'object' || spec.emptyState === null || Array.isArray(spec.emptyState)) {
    return {
      pass: false,
      code: 'UDT005',
      message: 'emptyState is missing — every table must declare what to show when there are no rows',
    };
  }

  const es = spec.emptyState;

  if (typeof es.message !== 'string' || es.message.trim() === '') {
    return {
      pass: false,
      code: 'UDT005',
      message: 'emptyState.message (string) is missing or empty — users need to know why the table is empty',
    };
  }

  const createActionNote = typeof es.createAction === 'string' && es.createAction.trim() !== ''
    ? `, createAction="${es.createAction}"`
    : '';

  return {
    pass: true,
    code: 'UDT005',
    message: `empty-table: emptyState.message declared${createActionNote}`,
  };
}
