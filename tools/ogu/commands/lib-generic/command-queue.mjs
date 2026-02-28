/**
 * Command Queue — ordered command execution with undo/redo support.
 */

/**
 * Create a command queue with undo/redo.
 * @returns {object} Queue with execute/undo/redo/canUndo/canRedo/history
 */
export function createCommandQueue() {
  const done = [];     // stack of executed commands
  const undone = [];   // stack of undone commands (for redo)

  function execute(command) {
    command.do();
    done.push(command);
    undone.length = 0; // Clear redo stack on new command
  }

  function undo() {
    if (done.length === 0) return false;
    const cmd = done.pop();
    cmd.undo();
    undone.push(cmd);
    return true;
  }

  function redo() {
    if (undone.length === 0) return false;
    const cmd = undone.pop();
    cmd.do();
    done.push(cmd);
    return true;
  }

  function canUndo() {
    return done.length > 0;
  }

  function canRedo() {
    return undone.length > 0;
  }

  function history() {
    return done.map(c => ({ description: c.description || 'unnamed' }));
  }

  return { execute, undo, redo, canUndo, canRedo, history };
}
