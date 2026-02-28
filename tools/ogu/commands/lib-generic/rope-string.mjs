/**
 * Rope String — efficient string with insert operations.
 */
export function createRope(initial = '') {
  let data = initial.split('');
  function insert(pos, text) { data.splice(pos, 0, ...text.split('')); }
  function deleteRange(start, end) { data.splice(start, end - start); }
  function charAt(i) { return data[i]; }
  function toString() { return data.join(''); }
  function length() { return data.length; }
  return { insert, deleteRange, charAt, toString, length };
}
