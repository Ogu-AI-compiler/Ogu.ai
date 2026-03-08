/**
 * Gate UDT003 — selection-state
 * If spec.selectable:true, spec must declare selectionState with:
 * - maxSelection (number or "unlimited")
 * - bulkActions (array)
 * Escape hatch: spec.selectable = false (gate not applicable)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'data-table-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDT003',
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
      code: 'UDT003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (spec.selectable !== true) {
    return {
      pass: true,
      code: 'UDT003',
      message: 'selection-state: selectable is not true — gate not applicable',
    };
  }

  if (typeof spec.selectionState !== 'object' || spec.selectionState === null || Array.isArray(spec.selectionState)) {
    return {
      pass: false,
      code: 'UDT003',
      message: 'selectable:true but selectionState object is missing',
    };
  }

  const ss = spec.selectionState;
  const violations = [];

  const maxSel = ss.maxSelection;
  if (typeof maxSel !== 'number' && maxSel !== 'unlimited') {
    violations.push('selectionState.maxSelection must be a number or "unlimited"');
  }

  if (!Array.isArray(ss.bulkActions)) {
    violations.push('selectionState.bulkActions (array) is missing');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDT003',
      message: `selectionState is invalid: ${violations.length} issue(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UDT003',
    message: `selection-state: maxSelection=${maxSel}, ${ss.bulkActions.length} bulk action(s)`,
  };
}
