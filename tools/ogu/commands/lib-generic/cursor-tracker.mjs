/**
 * Cursor Tracker — track cursor position and movement.
 */
export function createCursorTracker() {
  let line = 0, col = 0;
  const history = [];
  function moveTo(l, c) { line = l; col = c; history.push({ line, col }); }
  function moveBy(dl, dc) { line += dl; col += dc; history.push({ line, col }); }
  function getPosition() { return { line, col }; }
  function getHistory() { return [...history]; }
  function reset() { line = 0; col = 0; history.length = 0; }
  return { moveTo, moveBy, getPosition, getHistory, reset };
}
