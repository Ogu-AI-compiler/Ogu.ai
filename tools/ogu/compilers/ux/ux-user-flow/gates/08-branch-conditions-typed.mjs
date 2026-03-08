/**
 * Gate UXF008 — branch-conditions-typed
 * Every edge that represents a conditional branch (from a decision node)
 * must declare an explicit condition type.
 * Valid condition types: permission, data-state, experiment, user-choice, system-event, validation.
 * This ensures all branching logic is machine-checkable, not implicit.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_CONDITION_TYPES = new Set([
  'permission', 'data-state', 'experiment', 'user-choice',
  'system-event', 'validation', 'feature-flag',
]);

export async function run({ dir }) {
  const specPath = join(dir, 'user-flow-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXF008', message: 'user-flow-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXF008', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || !Array.isArray(spec.edges)) {
    return { pass: true, code: 'UXF008', message: 'Missing nodes or edges — skipped', skipped: true };
  }

  const decisionNodeIds = new Set(
    spec.nodes.filter(n => n.type === 'decision').map(n => n.id)
  );

  if (decisionNodeIds.size === 0) {
    return { pass: true, code: 'UXF008', message: 'No decision nodes — skipped', skipped: true };
  }

  const violations = [];

  spec.edges.forEach((edge, i) => {
    if (!decisionNodeIds.has(edge.from)) return;
    if (!edge.conditionType) {
      violations.push(
        `Edge[${i}] from decision node "${edge.from}" to "${edge.to}" missing conditionType ` +
        `(must be one of: ${[...VALID_CONDITION_TYPES].join(', ')})`
      );
    } else if (!VALID_CONDITION_TYPES.has(edge.conditionType)) {
      violations.push(
        `Edge[${i}] from "${edge.from}" to "${edge.to}" has invalid conditionType="${edge.conditionType}"`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXF008',
      message: `${violations.length} decision edge(s) with missing or invalid conditionType`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXF008',
    message: 'branch-conditions-typed: all decision edges declare conditionType',
  };
}
