/**
 * Zobrist Hash — incremental position hashing via XOR.
 */
export function createZobristHash(positions, pieceTypes) {
  const table = [];
  for (let i = 0; i < positions; i++) {
    const row = [];
    for (let j = 0; j < pieceTypes; j++) {
      row.push(Math.floor(Math.random() * 0xFFFFFFFF));
    }
    table.push(row);
  }
  let hash = 0;
  function toggle(position, pieceType) { hash ^= table[position][pieceType]; }
  function getHash() { return hash; }
  function reset() { hash = 0; }
  return { toggle, getHash, reset };
}
