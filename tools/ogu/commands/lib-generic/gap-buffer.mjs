/**
 * Gap Buffer — text buffer with a gap for efficient insertion at cursor.
 */
export function createGapBuffer(initialSize = 64) {
  let buffer = new Array(initialSize).fill(null);
  let gapStart = 0, gapEnd = initialSize;
  function moveCursor(pos) {
    while (gapStart < pos) { buffer[gapStart] = buffer[gapEnd]; buffer[gapEnd] = null; gapStart++; gapEnd++; }
    while (gapStart > pos) { gapStart--; gapEnd--; buffer[gapEnd] = buffer[gapStart]; buffer[gapStart] = null; }
  }
  function insert(text) {
    for (const ch of text) {
      if (gapStart === gapEnd) {
        const newBuf = new Array(buffer.length * 2).fill(null);
        for (let i = 0; i < gapStart; i++) newBuf[i] = buffer[i];
        const newGapEnd = gapEnd + buffer.length;
        for (let i = gapEnd; i < buffer.length; i++) newBuf[i + buffer.length] = buffer[i];
        buffer = newBuf;
        gapEnd = newGapEnd;
      }
      buffer[gapStart++] = ch;
    }
  }
  function deleteChar() {
    if (gapStart > 0) { gapStart--; buffer[gapStart] = null; }
  }
  function toString() {
    const chars = [];
    for (let i = 0; i < buffer.length; i++) {
      if (i >= gapStart && i < gapEnd) continue;
      if (buffer[i] !== null) chars.push(buffer[i]);
    }
    return chars.join('');
  }
  return { moveCursor, insert, deleteChar, toString };
}
