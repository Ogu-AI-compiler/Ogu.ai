/**
 * Trie Index — prefix tree for fast string lookup.
 */
export function createTrie() {
  const root = { children: {}, end: false };

  function insert(word) {
    let node = root;
    for (const ch of word) {
      if (!node.children[ch]) node.children[ch] = { children: {}, end: false };
      node = node.children[ch];
    }
    node.end = true;
  }

  function search(word) {
    let node = root;
    for (const ch of word) {
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return node.end;
  }

  function startsWith(prefix) {
    let node = root;
    for (const ch of prefix) {
      if (!node.children[ch]) return [];
      node = node.children[ch];
    }
    const results = [];
    collect(node, prefix, results);
    return results;
  }

  function collect(node, prefix, results) {
    if (node.end) results.push(prefix);
    for (const [ch, child] of Object.entries(node.children)) {
      collect(child, prefix + ch, results);
    }
  }

  function getWords() {
    const results = [];
    collect(root, "", results);
    return results;
  }

  return { insert, search, startsWith, getWords };
}
