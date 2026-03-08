/**
 * command-queue.mjs — Undo/redo capable command queue.
 */
export function createCommandQueue({ maxHistory = 100 } = {}) {
  const pending = [], history = [], undoStack = [];

  return {
    enqueue(command) { pending.push({ ...command, enqueuedAt: new Date().toISOString() }); },
    dequeue() { return pending.shift() || null; },
    peek() { return pending[0] || null; },
    size() { return pending.length; },
    isEmpty() { return pending.length === 0; },
    commit(command) { history.push(command); if (history.length > maxHistory) history.shift(); undoStack.length = 0; },
    undo() { const cmd = history.pop(); if (cmd) { undoStack.push(cmd); return cmd; } return null; },
    redo() { const cmd = undoStack.pop(); if (cmd) { history.push(cmd); return cmd; } return null; },
    getHistory() { return [...history]; },
    clear() { pending.length = 0; },
  };
}
