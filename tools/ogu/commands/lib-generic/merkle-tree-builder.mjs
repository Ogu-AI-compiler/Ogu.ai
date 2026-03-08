/**
 * Merkle Tree Builder — build merkle trees from data blocks.
 */
export function createMerkleTreeBuilder() {
  function _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h).toString(16).padStart(8, '0');
  }
  function build(leaves) {
    if (leaves.length === 0) return { root: null, levels: [] };
    let level = leaves.map(l => _hash(String(l)));
    const levels = [level];
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        next.push(_hash(left + right));
      }
      level = next;
      levels.push(level);
    }
    return { root: level[0], levels };
  }
  function getProof(levels, index) {
    const proof = [];
    let idx = index;
    for (let i = 0; i < levels.length - 1; i++) {
      const sibling = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (sibling < levels[i].length) {
        proof.push({ hash: levels[i][sibling], side: idx % 2 === 0 ? 'right' : 'left' });
      }
      idx = Math.floor(idx / 2);
    }
    return proof;
  }
  return { build, getProof, _hash };
}
