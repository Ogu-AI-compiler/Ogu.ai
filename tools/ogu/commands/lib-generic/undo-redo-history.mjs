/**
 * Undo-Redo History — track state changes with undo/redo support.
 */
export function createUndoRedoHistory(initialState) {
  const undoStack = [];
  const redoStack = [];
  let current = JSON.parse(JSON.stringify(initialState));
  function push(state) {
    undoStack.push(JSON.parse(JSON.stringify(current)));
    current = JSON.parse(JSON.stringify(state));
    redoStack.length = 0;
  }
  function undo() {
    if (undoStack.length === 0) return null;
    redoStack.push(JSON.parse(JSON.stringify(current)));
    current = undoStack.pop();
    return JSON.parse(JSON.stringify(current));
  }
  function redo() {
    if (redoStack.length === 0) return null;
    undoStack.push(JSON.parse(JSON.stringify(current)));
    current = redoStack.pop();
    return JSON.parse(JSON.stringify(current));
  }
  function getCurrent() { return JSON.parse(JSON.stringify(current)); }
  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }
  return { push, undo, redo, getCurrent, canUndo, canRedo };
}
