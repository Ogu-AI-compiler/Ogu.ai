/**
 * Diff Engine — compute structured diffs between JSON objects and text.
 */

/**
 * Compute diff between two JSON objects (shallow).
 *
 * @param {object} before
 * @param {object} after
 * @returns {{ type: 'added'|'removed'|'changed', path: string, before?: any, after?: any }[]}
 */
export function diffJson(before, after) {
  const diffs = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const inBefore = key in before;
    const inAfter = key in after;

    if (!inBefore && inAfter) {
      diffs.push({ type: 'added', path: key, after: after[key] });
    } else if (inBefore && !inAfter) {
      diffs.push({ type: 'removed', path: key, before: before[key] });
    } else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diffs.push({ type: 'changed', path: key, before: before[key], after: after[key] });
    }
  }

  return diffs;
}

/**
 * Compute diff (simplified API: returns key-based changes).
 */
export function diff(source, target) {
  const changes = [];
  const allKeys = new Set([...Object.keys(source), ...Object.keys(target)]);
  for (const key of allKeys) {
    const inS = key in source, inT = key in target;
    if (inS && !inT) changes.push({ type: 'removed', key, oldValue: source[key] });
    else if (!inS && inT) changes.push({ type: 'added', key, newValue: target[key] });
    else if (JSON.stringify(source[key]) !== JSON.stringify(target[key]))
      changes.push({ type: 'modified', key, oldValue: source[key], newValue: target[key] });
  }
  return changes;
}

/**
 * Compute line-by-line diff between two text strings.
 *
 * @param {string} before
 * @param {string} after
 * @returns {{ type: 'same'|'added'|'removed', line: string, lineNumber: number }[]}
 */
export function diffLines(before, after) {
  const linesA = before.split('\n');
  const linesB = after.split('\n');
  const diffs = [];

  const maxLen = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLen; i++) {
    const a = i < linesA.length ? linesA[i] : undefined;
    const b = i < linesB.length ? linesB[i] : undefined;

    if (a === b) {
      diffs.push({ type: 'same', line: a, lineNumber: i + 1 });
    } else {
      if (a !== undefined && b === undefined) {
        diffs.push({ type: 'removed', line: a, lineNumber: i + 1 });
      } else if (a === undefined && b !== undefined) {
        diffs.push({ type: 'added', line: b, lineNumber: i + 1 });
      } else {
        diffs.push({ type: 'removed', line: a, lineNumber: i + 1 });
        diffs.push({ type: 'added', line: b, lineNumber: i + 1 });
      }
    }
  }

  return diffs.filter(d => d.type !== 'same');
}
