/**
 * Rollback Engine — compensating rollback with audit trail and checkpoints.
 */

/**
 * Create a rollback engine.
 *
 * @returns {object} Engine with record/rollback/rollbackTo/checkpoint/getHistory
 */
export function createRollbackEngine() {
  const entries = []; // { action, context, compensate, rolledBack }
  const checkpoints = new Map(); // name → index
  let fullyRolledBack = false;

  function record(action, context, compensate) {
    entries.push({ action, context, compensate, rolledBack: false });
  }

  function checkpoint(name) {
    checkpoints.set(name, entries.length);
  }

  function rollback() {
    if (fullyRolledBack) return;
    fullyRolledBack = true;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (!entries[i].rolledBack) {
        entries[i].compensate();
        entries[i].rolledBack = true;
      }
    }
  }

  function rollbackTo(checkpointName) {
    const idx = checkpoints.get(checkpointName);
    if (idx == null) throw new Error(`Checkpoint "${checkpointName}" not found`);
    for (let i = entries.length - 1; i >= idx; i--) {
      if (!entries[i].rolledBack) {
        entries[i].compensate();
        entries[i].rolledBack = true;
      }
    }
  }

  function getHistory() {
    return entries.map(e => ({
      action: e.action,
      context: e.context,
      rolledBack: e.rolledBack,
    }));
  }

  return { record, rollback, rollbackTo, checkpoint, getHistory };
}
