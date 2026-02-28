/**
 * Suffix Tree — naive suffix tree for substring operations.
 */
export function createSuffixTree(text) {
  const root = {};

  for (let i = 0; i < text.length; i++) {
    let node = root;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (!node[ch]) node[ch] = {};
      node = node[ch];
    }
    node._end = true;
  }

  function contains(pattern) {
    let node = root;
    for (const ch of pattern) {
      if (!node[ch]) return false;
      node = node[ch];
    }
    return true;
  }

  function countOccurrences(pattern) {
    let count = 0;
    for (let i = 0; i <= text.length - pattern.length; i++) {
      if (text.substring(i, i + pattern.length) === pattern) count++;
    }
    return count;
  }

  return { contains, countOccurrences };
}
