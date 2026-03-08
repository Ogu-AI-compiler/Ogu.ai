/**
 * Gate UXF009 — contract-user-flow
 * Final contract check:
 * - version declared
 * - unique node ids
 * - at least one success terminal
 * - feature_id declared (for feature-scoped flows)
 * - entry nodes all exist in nodes array
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'user-flow-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXF009', message: 'user-flow-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXF009', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes)) {
    return { pass: true, code: 'UXF009', message: 'No nodes to check — skipped', skipped: true };
  }

  const violations = [];

  // Rule: version
  if (!spec.version) {
    violations.push('Contract: user-flow-spec.json missing field "version"');
  }

  // Rule: feature_id or flow_id declared
  if (!spec.feature_id && !spec.flow_id && !spec.id) {
    violations.push('Contract: user-flow-spec.json missing identifier field (feature_id, flow_id, or id)');
  }

  // Rule: unique node ids
  const seenIds = new Map();
  for (const node of spec.nodes) {
    if (typeof node.id !== 'string') continue;
    if (seenIds.has(node.id)) {
      violations.push(`Contract: Duplicate node id "${node.id}"`);
    } else {
      seenIds.set(node.id, true);
    }
  }

  // Rule: at least one success terminal
  const terminalNodes = spec.nodes.filter(n =>
    Array.isArray(spec.terminals) && spec.terminals.includes(n.id) && n.terminalType === 'success'
  );
  if (terminalNodes.length === 0) {
    violations.push('Contract: No success terminal node declared — every flow must have at least one success outcome');
  }

  // Rule: entry nodes exist
  if (Array.isArray(spec.entryNodes)) {
    const nodeIds = seenIds;
    for (const entryId of spec.entryNodes) {
      if (typeof entryId === 'string' && !nodeIds.has(entryId)) {
        violations.push(`Contract: entryNode "${entryId}" does not exist in the nodes array`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXF009',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXF009',
    message: 'contract-user-flow: all contract rules satisfied',
  };
}
