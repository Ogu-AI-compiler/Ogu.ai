/**
 * Undo Manager — execute commands with undo/redo support.
 */
export function createUndoManager() {
  const undoStack = [];
  const redoStack = [];

  function execute(command) {
    command.do();
    undoStack.push(command);
    redoStack.length = 0;
  }

  function undo() {
    if (undoStack.length === 0) return;
    const cmd = undoStack.pop();
    cmd.undo();
    redoStack.push(cmd);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const cmd = redoStack.pop();
    cmd.do();
    undoStack.push(cmd);
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  return { execute, undo, redo, canUndo, canRedo };
}
