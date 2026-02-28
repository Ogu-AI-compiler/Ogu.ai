/**
 * Suffix Array — sorted array of all suffixes for fast substring search.
 */
export function buildSuffixArray(text) {
  const suffixes = [];
  for (let i = 0; i < text.length; i++) suffixes.push(i);
  suffixes.sort((a, b) => {
    const sa = text.substring(a);
    const sb = text.substring(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
  return suffixes;
}

export function search(text, sa, pattern) {
  let lo = 0, hi = sa.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const suffix = text.substring(sa[mid], sa[mid] + pattern.length);
    if (suffix === pattern) return true;
    if (suffix < pattern) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}
