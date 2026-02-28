/**
 * Version Comparator — compare semantic versions.
 */
export function compare(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0, vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export function gt(a, b) { return compare(a, b) > 0; }
export function lt(a, b) { return compare(a, b) < 0; }
export function eq(a, b) { return compare(a, b) === 0; }
export function gte(a, b) { return compare(a, b) >= 0; }
export function lte(a, b) { return compare(a, b) <= 0; }

export function sort(versions) {
  return [...versions].sort(compare);
}
