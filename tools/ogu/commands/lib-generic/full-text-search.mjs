/**
 * Full Text Search — search with relevance scoring.
 */
export function createFullTextSearch() {
  const documents = new Map();
  function addDocument(id, content) { documents.set(id, content.toLowerCase()); }
  function removeDocument(id) { documents.delete(id); }
  function search(query) {
    const q = query.toLowerCase();
    const terms = q.split(/\s+/);
    const results = [];
    for (const [id, content] of documents) {
      let score = 0;
      for (const term of terms) {
        const re = new RegExp(term, 'gi');
        const matches = content.match(re);
        if (matches) score += matches.length;
      }
      if (score > 0) results.push({ id, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results;
  }
  function count() { return documents.size; }
  return { addDocument, removeDocument, search, count };
}
