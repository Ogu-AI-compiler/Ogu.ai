/**
 * Gate UDT007 — bulk-actions-confirmation
 * Any bulkAction in selectionState with destructive:true must declare
 * a confirmation object with message(string).
 * Bulk destructive actions without confirmation bypass user intent.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'data-table-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDT007',
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
      code: 'UDT007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const bulkActions = spec.selectionState?.bulkActions;

  if (!Array.isArray(bulkActions) || bulkActions.length === 0) {
    return {
      pass: true,
      code: 'UDT007',
      message: 'bulk-actions-confirmation: no bulkActions declared — gate not applicable',
    };
  }

  const destructiveActions = bulkActions.filter(a => a.destructive === true);

  if (destructiveActions.length === 0) {
    return {
      pass: true,
      code: 'UDT007',
      message: `bulk-actions-confirmation: no destructive bulk actions — all ${bulkActions.length} action(s) are safe`,
    };
  }

  const violations = [];
  destructiveActions.forEach(action => {
    const id = action.id || action.label || 'unknown';
    if (typeof action.confirmation !== 'object' || action.confirmation === null || Array.isArray(action.confirmation)) {
      violations.push(`bulkAction "${id}" is destructive but has no confirmation object`);
    } else if (typeof action.confirmation.message !== 'string' || action.confirmation.message.trim() === '') {
      violations.push(`bulkAction "${id}" confirmation is missing message (string)`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDT007',
      message: `${violations.length} destructive bulk action(s) missing confirmation`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UDT007',
    message: `bulk-actions-confirmation: all ${destructiveActions.length} destructive action(s) have confirmation messages`,
  };
}
