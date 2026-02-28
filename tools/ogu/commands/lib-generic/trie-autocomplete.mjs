/**
 * Trie Autocomplete — prefix-based word suggestions.
 */
export function createTrieAutocomplete() {
  const root = {};
  function addWord(word) {
    let node = root;
    for (const ch of word) { if (!node[ch]) node[ch] = {}; node = node[ch]; }
    node._end = true;
  }
  function collect(node, prefix, results) {
    if (node._end) results.push(prefix);
    for (const [ch, child] of Object.entries(node)) {
      if (ch !== "_end") collect(child, prefix + ch, results);
    }
  }
  function suggest(prefix) {
    let node = root;
    for (const ch of prefix) { if (!node[ch]) return []; node = node[ch]; }
    const results = [];
    collect(node, prefix, results);
    return results;
  }
  return { addWord, suggest };
}
