/**
 * Compensating Transaction — execute with undo capability.
 */
export function createCompensatingTransaction() {
  const actions = [];
  const compensations = [];
  function add(action, compensation) {
    actions.push(action);
    compensations.push(compensation);
  }
  function commit() {
    for (const action of actions) action();
  }
  function rollback() {
    for (let i = compensations.length - 1; i >= 0; i--) {
      compensations[i]();
    }
  }
  return { add, commit, rollback };
}
