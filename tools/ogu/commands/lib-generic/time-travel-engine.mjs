/**
 * Time Travel Engine — restore state to any snapshot and replay deltas.
 */

import { randomUUID } from 'node:crypto';

/**
 * Create a time travel engine.
 *
 * @returns {object} Engine with setState/getState/takeSnapshot/restoreTo/applyDelta/isReadOnly/exitReadOnly
 */
export function createTimeTravelEngine() {
  let currentState = {};
  const snapshots = new Map(); // id → { label, state, takenAt }
  let readOnly = false;

  function setState(state) {
    currentState = structuredClone(state);
  }

  function getState() {
    return structuredClone(currentState);
  }

  function takeSnapshot(label) {
    const id = randomUUID().slice(0, 12);
    snapshots.set(id, {
      id,
      label,
      state: structuredClone(currentState),
      takenAt: new Date().toISOString(),
    });
    return id;
  }

  function restoreTo(snapshotId) {
    const snap = snapshots.get(snapshotId);
    if (!snap) throw new Error(`Snapshot ${snapshotId} not found`);
    currentState = structuredClone(snap.state);
    readOnly = true;
  }

  function applyDelta(delta) {
    currentState = { ...currentState, ...delta };
  }

  function listSnapshots() {
    return Array.from(snapshots.values()).map(s => ({ id: s.id, label: s.label, takenAt: s.takenAt }));
  }

  function isReadOnly() {
    return readOnly;
  }

  function exitReadOnly() {
    readOnly = false;
  }

  return { setState, getState, takeSnapshot, restoreTo, applyDelta, listSnapshots, isReadOnly, exitReadOnly };
}
