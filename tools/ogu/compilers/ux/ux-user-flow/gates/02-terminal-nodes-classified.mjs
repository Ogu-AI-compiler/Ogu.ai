/**
 * Gate UXF002 — terminal-nodes-classified
 * Every node listed in terminals must:
 * 1. Exist in the nodes array
 * 2. Be classified with a terminalType: success | failure | abandoned | external | cancelled
 * 3. Have type === "terminal" in the nodes array
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_TERMINAL_TYPES = new Set(['success', 'failure', 'abandoned', 'external', 'cancelled']);

export async function run({ dir }) {
  const specPath = join(dir, 'user-flow-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXF002', message: 'user-flow-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXF002', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || !Array.isArray(spec.terminals)) {
    return { pass: true, code: 'UXF002', message: 'Missing nodes or terminals — skipped', skipped: true };
  }

  const nodeMap = new Map();
  for (const node of spec.nodes) {
    if (typeof node.id === 'string') nodeMap.set(node.id, node);
  }

  const violations = [];

  for (const terminalId of spec.terminals) {
    if (typeof terminalId !== 'string') {
      violations.push(`terminals entry is not a string: ${JSON.stringify(terminalId)}`);
      continue;
    }

    const node = nodeMap.get(terminalId);
    if (!node) {
      violations.push(`Terminal "${terminalId}" does not reference an existing node`);
      continue;
    }

    if (node.type !== 'terminal') {
      violations.push(`Node "${terminalId}" is listed in terminals but has type="${node.type}" (must be "terminal")`);
    }

    if (!node.terminalType) {
      violations.push(
        `Terminal node "${terminalId}" missing terminalType classification ` +
        `(must be one of: ${[...VALID_TERMINAL_TYPES].join(', ')})`
      );
    } else if (!VALID_TERMINAL_TYPES.has(node.terminalType)) {
      violations.push(
        `Terminal node "${terminalId}" has invalid terminalType "${node.terminalType}" ` +
        `(must be one of: ${[...VALID_TERMINAL_TYPES].join(', ')})`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXF002',
      message: `${violations.length} terminal classification violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXF002',
    message: `terminal-nodes-classified: all ${spec.terminals.length} terminal(s) properly classified`,
  };
}
