/**
 * Proof Verifier — verify merkle proofs and hash chain proofs.
 */
export function createProofVerifier(hashFn) {
  function verifyMerkleProof(leafHash, proof, root) {
    let current = leafHash;
    for (const step of proof) {
      if (step.side === 'left') {
        current = hashFn(step.hash + current);
      } else {
        current = hashFn(current + step.hash);
      }
    }
    return current === root;
  }
  function verifyChain(chain) {
    for (let i = 1; i < chain.length; i++) {
      if (chain[i].prev !== chain[i - 1].hash) return false;
    }
    return true;
  }
  return { verifyMerkleProof, verifyChain };
}
