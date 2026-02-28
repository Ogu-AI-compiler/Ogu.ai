/**
 * Snapshot Restore — restore system state from snapshots with validation.
 */
export function createSnapshotRestore(validator = null) {
  const history = [];
  function restore(snapshot, target) {
    if (validator && !validator(snapshot)) {
      throw new Error('Snapshot validation failed');
    }
    const restored = JSON.parse(JSON.stringify(snapshot));
    history.push({ snapshot: restored, time: Date.now() });
    Object.assign(target, restored);
    return true;
  }
  function getHistory() { return [...history]; }
  function lastRestore() { return history.length > 0 ? history[history.length - 1] : null; }
  function restoreCount() { return history.length; }
  return { restore, getHistory, lastRestore, restoreCount };
}
