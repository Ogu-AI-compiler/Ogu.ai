/**
 * Normalizer — L1 and L2 vector normalization.
 */
export function l2Normalize(vec) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

export function l1Normalize(vec) {
  const norm = vec.reduce((s, v) => s + Math.abs(v), 0) || 1;
  return vec.map(v => v / norm);
}
