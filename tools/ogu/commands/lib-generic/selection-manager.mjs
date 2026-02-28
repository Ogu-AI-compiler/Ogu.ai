/**
 * Selection Manager — manage text/element selections.
 */
export function createSelectionManager() {
  let selection = null;
  const selections = [];
  function select(start, end, text = '') {
    selection = { start, end, text };
    selections.push({ ...selection });
  }
  function clear() { selection = null; }
  function getSelection() { return selection ? { ...selection } : null; }
  function hasSelection() { return selection !== null; }
  function getHistory() { return [...selections]; }
  function expandTo(newEnd) { if (selection) { selection.end = newEnd; } }
  return { select, clear, getSelection, hasSelection, getHistory, expandTo };
}
