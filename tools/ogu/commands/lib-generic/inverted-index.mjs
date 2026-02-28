/**
 * Inverted Index — word-to-document mapping.
 */
export function createInvertedIndex() {
  const index = new Map();

  function addDocument(docId, words) {
    for (const w of words) {
      if (!index.has(w)) index.set(w, []);
      const list = index.get(w);
      if (!list.includes(docId)) list.push(docId);
    }
  }

  function search(word) { return index.get(word) || []; }

  function searchAll(words) {
    if (words.length === 0) return [];
    let result = search(words[0]);
    for (let i = 1; i < words.length; i++) {
      const next = new Set(search(words[i]));
      result = result.filter(id => next.has(id));
    }
    return result;
  }

  return { addDocument, search, searchAll };
}
