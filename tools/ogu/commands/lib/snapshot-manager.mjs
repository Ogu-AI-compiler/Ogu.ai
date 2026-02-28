/**
 * Snapshot Manager — create and manage state snapshots.
 */
export function createSnapshotManager() {
  const snapshots = new Map();
  let nextId = 1;
  function take(state, label = '') {
    const id = nextId++;
    snapshots.set(id, { id, state: JSON.parse(JSON.stringify(state)), label, time: Date.now() });
    return id;
  }
  function restore(id) {
    const snap = snapshots.get(id);
    if (!snap) throw new Error(`Snapshot ${id} not found`);
    return JSON.parse(JSON.stringify(snap.state));
  }
  function list() { return [...snapshots.values()].map(s => ({ id: s.id, label: s.label, time: s.time })); }
  function remove(id) { snapshots.delete(id); }
  function latest() {
    if (snapshots.size === 0) return null;
    return [...snapshots.values()].pop();
  }
  return { take, restore, list, remove, latest };
}
