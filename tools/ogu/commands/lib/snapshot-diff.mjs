/**
 * Snapshot Diff — compare two system snapshots for drift.
 */

/**
 * Diff two snapshots and return changes.
 *
 * @param {object} before
 * @param {object} after
 * @returns {{ drifted: boolean, changes: Array<{ key: string, type: string, before?: any, after?: any }> }}
 */
export function diffSnapshots(before, after) {
  const changes = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const inBefore = key in before;
    const inAfter = key in after;

    if (inBefore && !inAfter) {
      changes.push({ key, type: 'removed', before: before[key] });
    } else if (!inBefore && inAfter) {
      changes.push({ key, type: 'added', after: after[key] });
    } else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.push({ key, type: 'changed', before: before[key], after: after[key] });
    }
  }

  return { drifted: changes.length > 0, changes };
}
