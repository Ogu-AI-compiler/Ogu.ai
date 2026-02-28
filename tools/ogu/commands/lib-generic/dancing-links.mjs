/**
 * Dancing Links — column cover/uncover for Algorithm X.
 */
export function createDancingLinks(numCols) {
  const active = new Set();
  for (let i = 0; i < numCols; i++) active.add(i);
  const rows = [];
  function addRow(cols) { rows.push(cols); }
  function cover(col) { active.delete(col); }
  function uncover(col) { active.add(col); }
  function isActive(col) { return active.has(col); }
  function getActiveCols() { return [...active]; }
  return { addRow, cover, uncover, isActive, getActiveCols };
}
