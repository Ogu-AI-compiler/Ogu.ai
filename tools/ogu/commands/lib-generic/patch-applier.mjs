/**
 * Patch Applier — apply JSON patches to config objects.
 */

/**
 * Apply a list of patch operations to an object.
 *
 * @param {object} obj - Object to patch
 * @param {{ op: 'add'|'remove'|'replace', path: string, value?: any }[]} operations
 * @returns {object} Patched object (new reference)
 */
export function applyPatch(obj, operations) {
  let result = { ...obj };

  for (const op of operations) {
    // Support both formats: {op, path, value} and {type, key, newValue}
    if (op.op) {
      switch (op.op) {
        case 'add': result[op.path] = op.value; break;
        case 'remove': delete result[op.path]; break;
        case 'replace': result[op.path] = op.value; break;
      }
    } else if (op.type) {
      switch (op.type) {
        case 'added': case 'modified': result[op.key] = op.newValue; break;
        case 'removed': delete result[op.key]; break;
      }
    }
  }

  return result;
}

/**
 * Create patch operations from two objects.
 *
 * @param {object} before
 * @param {object} after
 * @returns {{ op: string, path: string, value?: any }[]}
 */
export function createPatch(before, after) {
  const ops = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const inBefore = key in before;
    const inAfter = key in after;

    if (!inBefore && inAfter) {
      ops.push({ op: 'add', path: key, value: after[key] });
    } else if (inBefore && !inAfter) {
      ops.push({ op: 'remove', path: key });
    } else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      ops.push({ op: 'replace', path: key, value: after[key] });
    }
  }

  return ops;
}
